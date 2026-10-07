"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TransactionSql } from "postgres";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { BIKE_PAYMENT_MODES } from "@/lib/expenses";
import { dateLabel } from "@/lib/format";
import { sql } from "@/lib/db";
import { DOC_CHECKLIST, EVENT_KINDS, INSURANCE_TYPES, normalizeReg, parseReg, PHOTO_KINDS } from "@/lib/regno";

type Tx = TransactionSql<Record<string, unknown>>;

export type VehicleState = { error?: string; ok?: string; id?: number; key?: number };

const text = (max: number) => z.string().trim().max(max).default("");
const money = z.coerce.number().min(0, "Amounts can't be negative.").max(100_000_000).nullable();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max).nullable();

const vehicleSchema = z.object({
  regNo: z.string().min(4, "Enter the vehicle number."),
  status: z.enum(["in_stock", "reserved", "in_service", "sold"]),
  brandId: z.coerce.number().int().positive().nullable(),
  make: text(60), model: z.string().trim().min(1, "Enter the bike model.").max(80), variant: text(80),
  mfgYear: int(1950, new Date().getFullYear() + 1), regDate: date, colour: text(40), fuel: text(20),
  engineCc: int(0, 5000), chassisNo: text(40), engineNo: text(40), odometerKm: int(0, 2_000_000), condition: text(20),
  ownerCount: z.coerce.number().int().min(0, "Owners can't be negative.").max(20),
  currentOwner: text(120), ownerPhone: text(20), ownerAddress: text(300),
  rcValidTill: date, insuranceCompany: text(80), insurancePolicyNo: text(60), insuranceValidTill: date, pucValidTill: date,
  hypothecation: text(120),
  rcStatus: z.enum(["original", "duplicate", "with_financier", "missing"]), rcType: z.enum(["smart_card", "paper"]),
  rcOwnerName: text(120), rtoOffice: text(80),
  insuranceType: z.string().refine((t) => t === "" || t in INSURANCE_TYPES, "Choose the insurance type."), insuranceIdv: money,
  pucCertNo: text(40),
  loanStatus: z.enum(["none", "active", "closed", "noc_received", "removed"]),
  loanBranch: text(120), loanAccountNo: text(40), loanAmount: money, loanEmi: money, loanTenureMonths: int(1, 120),
  loanStart: date, loanEnd: date, loanEmisPending: int(0, 120), loanClosureAmount: money,
  loanPaidBy: z.enum(["", "owner", "shop", "buyer"]), loanClosedOn: date, nocNumber: text(60), nocDate: date,
  form35Submitted: z.boolean(), loanNotes: text(500),
  docsInHand: z.array(z.string().refine((k) => DOC_CHECKLIST.some((d) => d.key === k))).max(DOC_CHECKLIST.length),
  purchasePrice: money, purchaseDate: date, purchasedFrom: text(120),
  marketPrice: money, ourPrice: money, minPrice: money,
  notes: text(2000),
});

const strOrNull = (f: FormData, k: string) => { const v = String(f.get(k) ?? "").replace(/[₹,\s]/g, ""); return v === "" ? null : v; };
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function saveVehicle(id: number | null, _: VehicleState, f: FormData): Promise<VehicleState> {
  const user = await requireUser();
  const r = vehicleSchema.safeParse({
    regNo: normalizeReg(str(f, "regNo")), status: str(f, "status") || "in_stock", brandId: strOrNull(f, "brandId"),
    make: str(f, "make"), model: str(f, "model"), variant: str(f, "variant"),
    mfgYear: strOrNull(f, "mfgYear"), regDate: strOrNull(f, "regDate"), colour: str(f, "colour"), fuel: str(f, "fuel") || "Petrol",
    engineCc: strOrNull(f, "engineCc"), chassisNo: str(f, "chassisNo").toUpperCase(), engineNo: str(f, "engineNo").toUpperCase(),
    odometerKm: strOrNull(f, "odometerKm"), condition: str(f, "condition") || "good",
    ownerCount: strOrNull(f, "ownerCount") ?? 1, currentOwner: str(f, "currentOwner"), ownerPhone: str(f, "ownerPhone"), ownerAddress: str(f, "ownerAddress"),
    rcValidTill: strOrNull(f, "rcValidTill"), insuranceCompany: str(f, "insuranceCompany"), insurancePolicyNo: str(f, "insurancePolicyNo"),
    insuranceValidTill: strOrNull(f, "insuranceValidTill"), pucValidTill: strOrNull(f, "pucValidTill"),
    hypothecation: str(f, "hypothecation"),
    rcStatus: str(f, "rcStatus") || "original", rcType: str(f, "rcType") || "smart_card",
    rcOwnerName: str(f, "rcOwnerName"), rtoOffice: str(f, "rtoOffice"),
    insuranceType: str(f, "insuranceType"), insuranceIdv: strOrNull(f, "insuranceIdv"), pucCertNo: str(f, "pucCertNo").toUpperCase(),
    docsInHand: [...new Set(f.getAll("docs").map(String))],
    loanStatus: str(f, "loanStatus") || "none", loanBranch: str(f, "loanBranch"), loanAccountNo: str(f, "loanAccountNo"),
    loanAmount: strOrNull(f, "loanAmount"), loanEmi: strOrNull(f, "loanEmi"), loanTenureMonths: strOrNull(f, "loanTenureMonths"),
    loanStart: strOrNull(f, "loanStart"), loanEnd: strOrNull(f, "loanEnd"), loanEmisPending: strOrNull(f, "loanEmisPending"),
    loanClosureAmount: strOrNull(f, "loanClosureAmount"), loanPaidBy: str(f, "loanPaidBy"), loanClosedOn: strOrNull(f, "loanClosedOn"),
    nocNumber: str(f, "nocNumber"), nocDate: strOrNull(f, "nocDate"), form35Submitted: f.get("form35Submitted") === "yes",
    loanNotes: str(f, "loanNotes"),
    purchasePrice: strOrNull(f, "purchasePrice"), purchaseDate: strOrNull(f, "purchaseDate"), purchasedFrom: str(f, "purchasedFrom"),
    marketPrice: strOrNull(f, "marketPrice"), ourPrice: strOrNull(f, "ourPrice"), minPrice: strOrNull(f, "minPrice"),
    notes: str(f, "notes"),
  });
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Check the vehicle details." };
  const d = r.data;
  if (!parseReg(d.regNo).valid) return { error: `“${d.regNo}” doesn't look like an Indian vehicle number (e.g. TN 76 AB 1234 or 22 BH 1234 AA).` };
  if (d.minPrice != null && d.ourPrice != null && d.minPrice > d.ourPrice) return { error: "The lowest price can't be above our selling price." };
  const hasLoan = d.loanStatus !== "none";
  if (hasLoan && !d.hypothecation.trim()) return { error: "Enter the financier's name for the loan." };
  if (d.loanStart && d.loanEnd && d.loanEnd < d.loanStart) return { error: "The loan end date is before its start date." };
  if (d.loanClosedOn && d.loanStart && d.loanClosedOn < d.loanStart) return { error: "The loan closed date is before the loan started." };

  const values = {
    reg_no: d.regNo, status: d.status, brand_id: d.brandId, make: d.make, model: d.model, variant: d.variant,
    mfg_year: d.mfgYear, reg_date: d.regDate, colour: d.colour, fuel: d.fuel, engine_cc: d.engineCc,
    chassis_no: d.chassisNo, engine_no: d.engineNo, odometer_km: d.odometerKm, condition: d.condition,
    owner_count: d.ownerCount, current_owner: d.currentOwner, owner_phone: d.ownerPhone, owner_address: d.ownerAddress,
    rc_valid_till: d.rcValidTill, insurance_company: d.insuranceCompany, insurance_policy_no: d.insurancePolicyNo,
    insurance_valid_till: d.insuranceValidTill, puc_valid_till: d.pucValidTill, hypothecation: hasLoan ? d.hypothecation : "",
    noc_received: d.loanStatus === "noc_received" || d.loanStatus === "removed",
    rc_status: d.rcStatus, rc_type: d.rcType, rc_owner_name: d.rcOwnerName, rto_office: d.rtoOffice,
    insurance_type: d.insuranceType, insurance_idv: d.insuranceIdv, puc_cert_no: d.pucCertNo, docs_in_hand: d.docsInHand,
    // Loan details are cleared when the bike has no loan, so stale numbers never show up.
    loan_status: d.loanStatus,
    loan_branch: hasLoan ? d.loanBranch : "", loan_account_no: hasLoan ? d.loanAccountNo : "",
    loan_amount: hasLoan ? d.loanAmount : null, loan_emi: hasLoan ? d.loanEmi : null, loan_tenure_months: hasLoan ? d.loanTenureMonths : null,
    loan_start: hasLoan ? d.loanStart : null, loan_end: hasLoan ? d.loanEnd : null,
    loan_emis_pending: d.loanStatus === "active" ? d.loanEmisPending : null,
    loan_closure_amount: hasLoan ? d.loanClosureAmount : null, loan_paid_by: hasLoan ? d.loanPaidBy : "",
    loan_closed_on: hasLoan && d.loanStatus !== "active" ? d.loanClosedOn : null,
    noc_number: hasLoan ? d.nocNumber : "", noc_date: hasLoan ? d.nocDate : null,
    form35_submitted: hasLoan && d.form35Submitted, loan_notes: hasLoan ? d.loanNotes : "",
    purchase_price: d.purchasePrice, purchase_date: d.purchaseDate, purchased_from: d.purchasedFrom,
    market_price: d.marketPrice, our_price: d.ourPrice, min_price: d.minPrice, notes: d.notes,
  };
  try {
    const vid = await sql.begin(async (tx) => {
      if (id) {
        await tx`update vehicles set ${tx(values)}, updated_at = now() where id = ${id}`;
        return id;
      }
      const [row] = await tx<{ id: number }[]>`insert into vehicles ${tx({ ...values, created_by: user.uid })} returning id`;
      await tx`insert into vehicle_events ${tx({
        vehicle_id: row.id, event_date: d.purchaseDate ?? new Date().toISOString().slice(0, 10), kind: "purchase",
        title: d.purchasedFrom ? `Bought from ${d.purchasedFrom}` : "Added to stock", odometer_km: d.odometerKm, cost: 0, user_id: user.uid,
      })}`;
      return row.id;
    });
    revalidatePath("/vehicles");
    return { ok: "Saved.", id: vid };
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "23505") {
      const [dup] = await sql<{ id: number }[]>`select id from vehicles where reg_no = ${d.regNo}`;
      return { error: `${parseReg(d.regNo).display} is already in your records.`, id: dup?.id };
    }
    console.error(e);
    return { error: "Could not save the vehicle. Please try again." };
  }
}

const touch = (id: number) => { revalidatePath(`/vehicles/${id}`); revalidatePath("/vehicles"); };

/* ---------- Fines ---------- */
const fineSchema = z.object({
  challanNo: text(40), challanDate: date, offence: z.string().trim().min(2, "Enter the offence, e.g. No helmet.").max(200),
  place: text(120), amount: z.coerce.number().positive("Enter the fine amount.").max(10_000_000), status: z.enum(["pending", "paid"]),
});
export async function addFine(vehicleId: number, _: VehicleState, f: FormData): Promise<VehicleState> {
  await requireUser();
  const r = fineSchema.safeParse({
    challanNo: str(f, "challanNo"), challanDate: strOrNull(f, "challanDate"), offence: str(f, "offence"),
    place: str(f, "place"), amount: strOrNull(f, "amount"), status: str(f, "status") || "pending",
  });
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Check the fine details." };
  const d = r.data;
  await sql`insert into vehicle_fines ${sql({
    vehicle_id: vehicleId, challan_no: d.challanNo, challan_date: d.challanDate, offence: d.offence, place: d.place,
    amount: d.amount, status: d.status, paid_on: d.status === "paid" ? new Date().toISOString().slice(0, 10) : null,
  })}`;
  touch(vehicleId);
  return { ok: "Fine added.", key: Date.now() };
}
export async function setFineStatus(vehicleId: number, fineId: number, paid: boolean) {
  await requireUser();
  await sql`update vehicle_fines set status = ${paid ? "paid" : "pending"}, paid_on = ${paid ? sql`current_date` : null}
            where id = ${fineId} and vehicle_id = ${vehicleId}`;
  touch(vehicleId);
}
export async function deleteFine(vehicleId: number, fineId: number) {
  await requireUser();
  await sql`delete from vehicle_fines where id = ${fineId} and vehicle_id = ${vehicleId}`;
  touch(vehicleId);
}

/* ---------- History ---------- */
const eventSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  kind: z.string().refine((k) => k in EVENT_KINDS, "Choose what happened."),
  title: z.string().trim().min(2, "Describe what was done.").max(300),
  odometerKm: int(0, 2_000_000), cost: z.coerce.number().min(0).max(10_000_000),
});
export async function addEvent(vehicleId: number, _: VehicleState, f: FormData): Promise<VehicleState> {
  const user = await requireUser();
  const r = eventSchema.safeParse({
    date: str(f, "date"), kind: str(f, "kind"), title: str(f, "title"), odometerKm: strOrNull(f, "odometerKm"), cost: strOrNull(f, "cost") ?? 0,
  });
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Check the details." };
  const d = r.data;
  await sql.begin(async (tx) => {
    await tx`insert into vehicle_events ${tx({ vehicle_id: vehicleId, event_date: d.date, kind: d.kind, title: d.title, odometer_km: d.odometerKm, cost: d.cost, user_id: user.uid })}`;
    // Keep the bike's reading current when a newer one is recorded.
    if (d.odometerKm != null) await tx`update vehicles set odometer_km = ${d.odometerKm}, updated_at = now() where id = ${vehicleId} and coalesce(odometer_km, 0) < ${d.odometerKm}`;
  });
  touch(vehicleId);
  return { ok: "Added to history.", key: Date.now() };
}
export async function deleteEvent(vehicleId: number, eventId: number) {
  await requireUser();
  await sql`delete from vehicle_events where id = ${eventId} and vehicle_id = ${vehicleId}`;
  touch(vehicleId);
}

/* ---------- Previous owners ---------- */
const ownerSchema = z.object({
  ownerNo: z.coerce.number().int().min(1).max(20), name: z.string().trim().min(2, "Enter the owner's name.").max(120),
  phone: text(20), fromDate: date, toDate: date, note: text(200),
});
export async function addOwner(vehicleId: number, _: VehicleState, f: FormData): Promise<VehicleState> {
  await requireUser();
  const r = ownerSchema.safeParse({
    ownerNo: strOrNull(f, "ownerNo"), name: str(f, "name"), phone: str(f, "phone"),
    fromDate: strOrNull(f, "fromDate"), toDate: strOrNull(f, "toDate"), note: str(f, "note"),
  });
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Check the owner details." };
  const d = r.data;
  if (d.fromDate && d.toDate && d.toDate < d.fromDate) return { error: "The “till” date is before the “from” date." };
  await sql`insert into vehicle_owners ${sql({ vehicle_id: vehicleId, owner_no: d.ownerNo, name: d.name, phone: d.phone, from_date: d.fromDate, to_date: d.toDate, note: d.note })}`;
  touch(vehicleId);
  return { ok: "Owner added.", key: Date.now() };
}
export async function deleteOwner(vehicleId: number, ownerId: number) {
  await requireUser();
  await sql`delete from vehicle_owners where id = ${ownerId} and vehicle_id = ${vehicleId}`;
  touch(vehicleId);
}

/* ---------- Status & sale ---------- */
export async function setVehicleStatus(vehicleId: number, status: "in_stock" | "reserved" | "in_service") {
  await requireUser();
  await sql`update vehicles set status = ${status}, sold_price = null, sold_on = null, sold_to = '', sold_phone = '', sold_payment_mode = '', updated_at = now()
            where id = ${vehicleId}`;
  touch(vehicleId);
}

const saleSchema = z.object({
  price: z.coerce.number().positive("Enter the selling price.").max(100_000_000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the sale date."),
  buyer: z.string().trim().min(2, "Enter the buyer's name.").max(120), phone: text(20),
  mode: z.string().refine((m) => BIKE_PAYMENT_MODES.includes(m), "Choose how the buyer paid."),
});
export async function markSold(vehicleId: number, _: VehicleState, f: FormData): Promise<VehicleState> {
  const user = await requireUser();
  const r = saleSchema.safeParse({ price: strOrNull(f, "price"), date: str(f, "date"), buyer: str(f, "buyer"), phone: str(f, "phone"), mode: str(f, "mode") });
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Check the sale details." };
  const d = r.data;
  await sql.begin(async (tx) => {
    await tx`update vehicles set status = 'sold', sold_price = ${d.price}, sold_on = ${d.date}, sold_to = ${d.buyer}, sold_phone = ${d.phone},
             sold_payment_mode = ${d.mode}, updated_at = now()
             where id = ${vehicleId}`;
    await tx`insert into vehicle_events ${tx({ vehicle_id: vehicleId, event_date: d.date, kind: "sale", title: `Sold to ${d.buyer} · paid by ${d.mode}`, cost: 0, user_id: user.uid })}`;
  });
  touch(vehicleId);
  return { ok: "Marked as sold.", key: Date.now() };
}

export async function deleteVehicle(vehicleId: number) {
  await requireUser("owner");
  await sql`delete from vehicles where id = ${vehicleId}`;
  revalidatePath("/vehicles");
  redirect("/vehicles?deleted=1");
}

/* ---------- Photos ---------- */
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** One photo per call (the browser resizes it first), so uploads stay well under the request size limit. */
export async function uploadPhoto(vehicleId: number, f: FormData): Promise<VehicleState> {
  const user = await requireUser();
  const photo = f.get("photo"), thumb = f.get("thumb");
  const kind = str(f, "kind");
  if (!(photo instanceof File) || !(thumb instanceof File) || !photo.size) return { error: "Choose a photo." };
  if (!(kind in PHOTO_KINDS)) return { error: "Choose what the photo shows." };
  if (!PHOTO_TYPES.includes(photo.type)) return { error: "Only JPG, PNG or WebP photos." };
  if (photo.size > 1_500_000 || thumb.size > 200_000) return { error: "That photo is too large even after shrinking. Try another." };
  if (kind === "owner") await sql`delete from vehicle_photos where vehicle_id = ${vehicleId} and kind = 'owner'`; // one owner photo
  await sql`insert into vehicle_photos ${sql({
    vehicle_id: vehicleId, kind, caption: str(f, "caption").trim().slice(0, 120), mime: photo.type,
    data: Buffer.from(await photo.arrayBuffer()), thumb: Buffer.from(await thumb.arrayBuffer()), user_id: user.uid,
  })}`;
  touch(vehicleId);
  return { ok: "Photo added." };
}
export async function deletePhoto(vehicleId: number, photoId: number) {
  await requireUser();
  await sql`delete from vehicle_photos where id = ${photoId} and vehicle_id = ${vehicleId}`;
  touch(vehicleId);
}

/* ---------- Parts condition & warranty ---------- */
const partSchema = z.object({
  part: z.string().trim().min(2, "Choose or type the part.").max(80),
  status: z.enum(["ok", "damaged", "repaired", "replaced"]),
  detail: text(200), changedOn: date, odometerKm: int(0, 2_000_000),
  cost: z.coerce.number().min(0).max(10_000_000), warrantyTill: date,
});
const partValues = (f: FormData) => ({
  part: str(f, "part"), status: str(f, "status") || "ok", detail: str(f, "detail"), changedOn: strOrNull(f, "changedOn"),
  odometerKm: strOrNull(f, "odometerKm"), cost: strOrNull(f, "cost") ?? 0, warrantyTill: strOrNull(f, "warrantyTill"),
});

/** Repaired/replaced parts go into the history too, which is where their cost is counted. */
async function partEvent(tx: Tx, vehicleId: number, userId: number, d: z.infer<typeof partSchema>) {
  if (d.status !== "repaired" && d.status !== "replaced") return null;
  const [e] = await tx<{ id: number }[]>`insert into vehicle_events ${tx({
    vehicle_id: vehicleId, event_date: d.changedOn ?? new Date().toISOString().slice(0, 10), kind: d.status === "replaced" ? "parts" : "repair",
    title: `${d.part} ${d.status}${d.detail ? ` – ${d.detail}` : ""}${d.warrantyTill ? ` (warranty till ${dateLabel(d.warrantyTill)})` : ""}`,
    odometer_km: d.odometerKm, cost: d.cost, user_id: userId,
  })} returning id`;
  return e.id;
}

export async function addPart(vehicleId: number, _: VehicleState, f: FormData): Promise<VehicleState> {
  const user = await requireUser();
  const r = partSchema.safeParse(partValues(f));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Check the part details." };
  const d = r.data;
  await sql.begin(async (tx) => {
    const eventId = await partEvent(tx, vehicleId, user.uid, d);
    await tx`insert into vehicle_parts ${tx({
      vehicle_id: vehicleId, part: d.part, status: d.status, detail: d.detail, changed_on: d.changedOn, odometer_km: d.odometerKm,
      cost: d.cost, warranty_till: d.warrantyTill, event_id: eventId,
    })}`;
  });
  touch(vehicleId);
  return { ok: `${d.part} saved.`, key: Date.now() };
}

/** A damaged part that has now been repaired or replaced. */
export async function fixPart(vehicleId: number, partId: number, _: VehicleState, f: FormData): Promise<VehicleState> {
  const user = await requireUser();
  const [cur] = await sql<{ part: string }[]>`select part from vehicle_parts where id = ${partId} and vehicle_id = ${vehicleId}`;
  if (!cur) return { error: "This part was removed." };
  const r = partSchema.safeParse({ ...partValues(f), part: cur.part });
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Check the details." };
  const d = r.data;
  await sql.begin(async (tx) => {
    const eventId = await partEvent(tx, vehicleId, user.uid, d);
    await tx`update vehicle_parts set status = ${d.status}, detail = ${d.detail}, changed_on = ${d.changedOn}, odometer_km = ${d.odometerKm},
             cost = ${d.cost}, warranty_till = ${d.warrantyTill}, event_id = coalesce(${eventId}, event_id), updated_at = now()
             where id = ${partId}`;
  });
  touch(vehicleId);
  return { ok: "Updated." };
}

export async function deletePart(vehicleId: number, partId: number) {
  await requireUser();
  await sql.begin(async (tx) => {
    const [p] = await tx<{ event_id: number | null }[]>`delete from vehicle_parts where id = ${partId} and vehicle_id = ${vehicleId} returning event_id`;
    if (p?.event_id) await tx`delete from vehicle_events where id = ${p.event_id}`;
  });
  touch(vehicleId);
}

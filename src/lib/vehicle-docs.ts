import "server-only";
import type { TransactionSql } from "postgres";
import { sql } from "./db";
import { financialYear } from "./format";
import { DOC_CHECKLIST, formatReg } from "./regno";
import { rupeesInWords } from "./words";

type Tx = TransactionSql<Record<string, unknown>>;
export type VehicleDocKind = "sale" | "purchase";

export const DOC_TITLES: Record<VehicleDocKind, string> = { sale: "Bike sale invoice", purchase: "Bike purchase receipt" };
const SERIES: Record<VehicleDocKind, string> = { sale: "BS", purchase: "BP" };

/** Standard wording printed on every document. */
const SALE_TERMS = [
  "The buyer has inspected and test-ridden the vehicle and buys it in its present condition.",
  "From the date and time of delivery shown above, the buyer is responsible for the vehicle, including traffic fines, accidents, insurance and any legal matter.",
  "Traffic fines or legal matters from before the delivery time remain the seller's responsibility.",
  "The buyer will complete the RC transfer at the RTO within 14 days, using the signed Form 29 and Form 30 handed over.",
];
const PURCHASE_DECLARATIONS = [
  "I am the registered owner of this vehicle and have the full right to sell it.",
  "Apart from any loan stated above, the vehicle has no loan, hypothecation or other claim against it.",
  "All traffic fines, accidents and legal matters up to the date and time of handover above are my responsibility.",
  "I will sign Form 29 and Form 30 and give any help needed to transfer the RC.",
];

/** The bike's identity, frozen onto the document when it is issued. */
export type BikeSnapshot = {
  reg_no: string; make: string; model: string; variant: string; mfg_year: number | null; reg_date: string | null;
  colour: string; fuel: string; engine_cc: number | null; chassis_no: string; engine_no: string; owner_count: number;
  insurance_company: string; insurance_policy_no: string; insurance_valid_till: string | null;
};

export type VehicleDocInput = {
  vehicleId: number; kind: VehicleDocKind; date: string; time: string;
  partyName: string; partyPhone: string; partyAddress: string; partyIdProof: string;
  paymentMode: string; odometerKm: number | null; papers: string[]; notes: string; userId: number;
  // Buyer's finance details (sale only)
  buyerFinanceId?: number | null; buyerFinanceName?: string;
  buyerDownPayment?: number | null; buyerTenureMonths?: number | null; buyerEmiAmount?: number | null;
  buyerDocCharge?: number | null; buyerProcessingFee?: number | null;
};

/** "2026-10-23" + "16:35" in Indian time. */
export const handoverTimestamp = (date: string, time: string) => `${date}T${/^\d{2}:\d{2}$/.test(time) ? time : "12:00"}:00+05:30`;

/**
 * Issues the next numbered document for a bike inside the caller's transaction. Amounts come from the bike
 * record (what was paid, the sale price and any seller's loan), so the document always matches the books.
 */
export async function issueVehicleDoc(tx: Tx, input: VehicleDocInput) {
  const [v] = await tx<(BikeSnapshot & {
    purchase_price: number | null; sold_price: number | null; loan_status: string; loan_paid_by: string;
    loan_closure_amount: number | null; hypothecation: string;
  })[]>`
    select reg_no, make, model, variant, mfg_year, to_char(reg_date, 'YYYY-MM-DD') as reg_date, colour, fuel, engine_cc,
           chassis_no, engine_no, owner_count, insurance_company, insurance_policy_no,
           to_char(insurance_valid_till, 'YYYY-MM-DD') as insurance_valid_till,
           purchase_price, sold_price, loan_status, loan_paid_by, loan_closure_amount, hypothecation
    from vehicles where id = ${input.vehicleId} for update`;
  if (!v) throw new DocError("This bike no longer exists.");

  const hasLoan = v.loan_status !== "none" && Number(v.loan_closure_amount ?? 0) > 0;
  const loan = hasLoan ? Number(v.loan_closure_amount) : 0;
  let price: number, paid: number;
  if (input.kind === "sale") {
    if (v.sold_price == null) throw new DocError("Mark the bike as sold first.");
    price = Number(v.sold_price);
    // A loan the buyer clears goes straight to the financier, so the shop receives that much less.
    paid = v.loan_paid_by === "buyer" ? price - loan : price;
  } else {
    if (v.purchase_price == null) throw new DocError("Enter what you paid for the bike (Edit → Prices) first.");
    paid = Number(v.purchase_price);
    // When the shop or the next buyer clears the seller's loan, the deal was worth paid + loan.
    price = paid + (hasLoan && (v.loan_paid_by === "shop" || v.loan_paid_by === "buyer") ? loan : 0);
  }

  const series = SERIES[input.kind];
  const fy = financialYear(new Date(input.date + "T00:00:00"));
  const [{ last_seq }] = await tx<{ last_seq: number }[]>`
    insert into vehicle_doc_counters (series, fy, last_seq) values (${series}, ${fy}, 1)
    on conflict (series, fy) do update set last_seq = vehicle_doc_counters.last_seq + 1
    returning last_seq`;
  const bike: BikeSnapshot = {
    reg_no: v.reg_no, make: v.make, model: v.model, variant: v.variant, mfg_year: v.mfg_year, reg_date: v.reg_date, colour: v.colour,
    fuel: v.fuel, engine_cc: v.engine_cc, chassis_no: v.chassis_no, engine_no: v.engine_no, owner_count: v.owner_count,
    insurance_company: v.insurance_company, insurance_policy_no: v.insurance_policy_no, insurance_valid_till: v.insurance_valid_till,
  };
  const [doc] = await tx<{ id: number; doc_no: string }[]>`
    insert into vehicle_invoices ${tx({
      vehicle_id: input.vehicleId, kind: input.kind, doc_no: `${series}/${fy}/${String(last_seq).padStart(4, "0")}`, fy, seq: last_seq,
      doc_date: input.date, handover_at: handoverTimestamp(input.date, input.time),
      party_name: input.partyName, party_phone: input.partyPhone, party_address: input.partyAddress, party_id_proof: input.partyIdProof,
      price, paid_amount: paid, loan_amount: loan, loan_payer: hasLoan ? v.loan_paid_by : "", loan_financier: hasLoan ? v.hypothecation : "",
      payment_mode: input.paymentMode, odometer_km: input.odometerKm, bike: tx.json(bike), papers: input.papers, notes: input.notes,
      user_id: input.userId,
      buyer_finance_id: input.buyerFinanceId ?? null,
      buyer_finance_name: input.buyerFinanceName ?? "",
      buyer_down_payment: input.buyerDownPayment ?? null,
      buyer_tenure_months: input.buyerTenureMonths ?? null,
      buyer_emi_amount: input.buyerEmiAmount ?? null,
      buyer_doc_charge: input.buyerDocCharge ?? null,
      buyer_processing_fee: input.buyerProcessingFee ?? null,
    })}
    returning id, doc_no`;
  return doc;
}

export class DocError extends Error {}

export type VehicleDoc = {
  id: number; vehicle_id: number; kind: VehicleDocKind; doc_no: string; doc_date: string; handover_at: Date;
  party_name: string; party_phone: string; party_address: string; party_id_proof: string;
  price: number; paid_amount: number; loan_amount: number; loan_payer: string; loan_financier: string;
  payment_mode: string; odometer_km: number | null; bike: BikeSnapshot; papers: string[]; notes: string;
  status: "issued" | "cancelled"; cancel_reason: string; created_by: string | null;
  buyer_finance_id: number | null; buyer_finance_name: string;
  buyer_down_payment: number | null; buyer_tenure_months: number | null; buyer_emi_amount: number | null;
  buyer_doc_charge: number | null; buyer_processing_fee: number | null;
};
export type DocShop = {
  shop_name: string; address: string; phone: string; email: string; gstin: string; logo: Buffer | null; logo_type: string | null; logo_version: number;
};

export async function loadVehicleDoc(id: number) {
  const [[doc], [shop]] = await Promise.all([
    sql<VehicleDoc[]>`
      select d.*, to_char(d.doc_date, 'YYYY-MM-DD') as doc_date, u.name as created_by
      from vehicle_invoices d left join users u on u.id = d.user_id where d.id = ${id}`,
    sql<DocShop[]>`select shop_name, address, phone, email, gstin, logo, logo_type, logo_version from settings where id = 1`,
  ]);
  return doc ? { doc, shop } : null;
}

export async function vehicleDocsFor(vehicleId: number) {
  return sql<{ id: number; kind: VehicleDocKind; doc_no: string; doc_date: string; party_name: string; price: number; status: string }[]>`
    select id, kind, doc_no, to_char(doc_date, 'YYYY-MM-DD') as doc_date, party_name, price, status
    from vehicle_invoices where vehicle_id = ${vehicleId} order by id desc`;
}

/* ---------- One description of the document, rendered both as the web page and as the PDF ---------- */

const money = (n: number) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dayTime = (d: Date) => new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export type DocParty = { role: string; name: string; lines: string[] };
export type DocModel = {
  title: string; no: string; date: string; cancelled: boolean; cancelReason: string;
  handover: [string, string];
  seller: DocParty; buyer: DocParty;
  plate: string;
  vehicle: [string, string][];
  money: [string, string][];
  total: [string, string];
  words: string;
  papers: { title: string; items: string[] };
  terms: { title: string; items: string[] };
  notes: string;
  signatures: [{ label: string; name: string }, { label: string; name: string }];
  shop: { name: string; address: string; contact: string; gstin: string };
};

export function buildDocModel(doc: VehicleDoc, shop: DocShop): DocModel {
  const b = doc.bike;
  const sale = doc.kind === "sale";
  const shopParty: DocParty = {
    role: sale ? "Seller" : "Buyer", name: shop.shop_name,
    lines: [shop.address, [shop.phone && `Ph: ${shop.phone}`, shop.email].filter(Boolean).join(" · "), shop.gstin && `GSTIN: ${shop.gstin}`].filter(Boolean) as string[],
  };
  const other: DocParty = {
    role: sale ? "Buyer" : "Seller (registered owner)", name: doc.party_name,
    lines: [doc.party_address, doc.party_phone && `Ph: ${doc.party_phone}`, doc.party_id_proof && `ID proof: ${doc.party_id_proof}`].filter(Boolean) as string[],
  };

  const vehicle: [string, string][] = ([
    ["Make and model", [b.make, b.model, b.variant].filter(Boolean).join(" ")],
    ["Year of manufacture", b.mfg_year ? String(b.mfg_year) : ""],
    ["Registration date", b.reg_date ? day(b.reg_date) : ""],
    ["Chassis number", b.chassis_no],
    ["Engine number", b.engine_no],
    ["Colour", b.colour],
    ["Fuel · engine", [b.fuel, b.engine_cc ? `${b.engine_cc} cc` : ""].filter(Boolean).join(" · ")],
    [sale ? "Odometer at delivery" : "Odometer at handover", doc.odometer_km != null ? `${doc.odometer_km.toLocaleString("en-IN")} km` : ""],
    ["Owners so far (as per RC)", b.owner_count ? String(b.owner_count) : ""],
    ["Insurance", [b.insurance_company, b.insurance_policy_no && `Policy ${b.insurance_policy_no}`, b.insurance_valid_till && `valid till ${day(b.insurance_valid_till)}`].filter(Boolean).join(" · ")],
  ] as [string, string][]).filter(([, v]) => v);

  const fin = doc.loan_financier || "the financier";
  const buyerFin = doc.buyer_finance_name || "the finance company";
  const rows: [string, string][] = [];
  const hasBuyerFinance = sale && doc.buyer_down_payment != null && Number(doc.buyer_down_payment) >= 0;
  if (sale) {
    rows.push(["Sale price", money(doc.price)]);
    if (hasBuyerFinance) {
      const remainingLoan = doc.price - Number(doc.buyer_down_payment);
      const docCharge = doc.buyer_doc_charge != null ? Number(doc.buyer_doc_charge) : 0;
      const processingFee = doc.buyer_processing_fee != null ? Number(doc.buyer_processing_fee) : 0;
      const totalLoan = remainingLoan + docCharge + processingFee;
      rows.push([`Down payment by buyer (${doc.payment_mode || "Cash"})`, money(Number(doc.buyer_down_payment))]);
      rows.push([`Remaining loan (financed by ${buyerFin})`, money(remainingLoan)]);
      if (docCharge > 0)
        rows.push([`Documentation charge (paid to ${buyerFin})`, money(docCharge)]);
      if (processingFee > 0)
        rows.push([`Processing fee (paid to ${buyerFin})`, money(processingFee)]);
      if (docCharge > 0 || processingFee > 0)
        rows.push([`Total loan amount (financed by ${buyerFin})`, money(totalLoan)]);
      if (doc.buyer_tenure_months) {
        const emiStr = doc.buyer_emi_amount ? `EMI ≈ ${money(doc.buyer_emi_amount)}/month · ` : "";
        rows.push([`Loan tenure (interest on total loan)`, `${doc.buyer_tenure_months} months · ${emiStr}${doc.buyer_tenure_months} instalments`]);
      }
    } else if (doc.loan_amount > 0 && doc.loan_payer === "buyer") {
      rows.push([`Paid by the buyer directly to ${fin} (closing the earlier owner's loan)`, money(doc.loan_amount)]);
      rows.push([`Paid to ${shop.shop_name}`, money(doc.paid_amount)]);
    }
  } else {
    if (doc.loan_amount > 0 && doc.loan_payer === "shop") {
      rows.push(["Paid to the seller", money(doc.paid_amount)]);
      rows.push([`Paid by the shop to ${fin} to close the seller's loan`, money(doc.loan_amount)]);
    } else if (doc.loan_amount > 0 && doc.loan_payer === "buyer") {
      rows.push(["Paid to the seller", money(doc.paid_amount)]);
      rows.push([`Seller's loan with ${fin}, to be cleared by the shop's buyer`, money(doc.loan_amount)]);
    } else {
      rows.push(["Paid to the seller", money(doc.paid_amount)]);
    }
  }
  if (!hasBuyerFinance && doc.payment_mode) rows.push([sale ? "Paid by" : "Paid to the seller by", doc.payment_mode]);
  const loanNote = !sale && doc.loan_amount > 0 && doc.loan_payer === "owner"
    ? `The seller will close the loan with ${fin} (${money(doc.loan_amount)}) and hand over the NOC.` : "";

  const labels = new Map(DOC_CHECKLIST.map((d) => [d.key, d.label]));
  return {
    title: DOC_TITLES[doc.kind],
    no: doc.doc_no,
    date: day(doc.doc_date),
    cancelled: doc.status === "cancelled",
    cancelReason: doc.cancel_reason,
    handover: [sale ? "Date and time of delivery" : "Date and time of handover", dayTime(doc.handover_at)],
    seller: sale ? shopParty : other,
    buyer: sale ? other : shopParty,
    plate: formatReg(b.reg_no),
    vehicle,
    money: rows,
    total: [sale ? "Total sale value" : "Total deal value", money(doc.price)],
    words: rupeesInWords(Number(doc.price)),
    papers: { title: sale ? "Papers handed over to the buyer" : "Papers received from the seller", items: doc.papers.map((k) => labels.get(k) ?? k) },
    terms: sale ? { title: "Terms of sale", items: SALE_TERMS } : { title: "Seller's declaration", items: PURCHASE_DECLARATIONS },
    notes: [loanNote, doc.notes].filter(Boolean).join(" "),
    signatures: sale
      ? [{ label: "Buyer's signature", name: doc.party_name }, { label: `For ${shop.shop_name}`, name: "Authorised signatory" }]
      : [{ label: "Seller's signature", name: doc.party_name }, { label: `For ${shop.shop_name}`, name: "Authorised signatory" }],
    shop: { name: shop.shop_name, address: shop.address, contact: [shop.phone && `Ph: ${shop.phone}`, shop.email].filter(Boolean).join(" · "), gstin: shop.gstin },
  };
}

export type VehicleDocRow = {
  id: number; vehicle_id: number; kind: VehicleDocKind; doc_no: string; doc_date: string; party_name: string; party_phone: string;
  price: number; status: string; reg_no: string; bike_name: string;
};

/**
 * All bike documents, newest first. Searches the details printed on the documents themselves (person's name and
 * phone, document number, vehicle number, bike), so a cancelled invoice or an RC-spelling of a name is still found.
 */
export async function searchVehicleDocs(f: { q?: string; kind?: string; status?: string; from?: string; to?: string; limit?: number }) {
  const limit = Math.min(f.limit ?? 200, 500);
  const conds = [sql`true`];
  const words = (f.q ?? "").toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0, 6);
  if (words.length) {
    const hay = sql`lower(d.doc_no || ' ' || d.party_name || ' ' || d.party_phone || ' ' || (d.bike->>'reg_no') || ' ' || (d.bike->>'make') || ' ' || (d.bike->>'model'))`;
    const all = words.map((w) => sql`${hay} like ${"%" + w.replace(/[\\%_]/g, "\\$&") + "%"}`).reduce((a, c) => sql`${a} and ${c}`);
    // "TN 76 AB 1234" typed with spaces still finds the stored TN76AB1234.
    const reg = words.join("").toUpperCase().replace(/[^A-Z0-9]/g, "");
    conds.push(reg.length >= 4 ? sql`((${all}) or (d.bike->>'reg_no') like ${"%" + reg + "%"})` : all);
  }
  if (f.kind === "sale" || f.kind === "purchase") conds.push(sql`d.kind = ${f.kind}`);
  if (f.status === "issued" || f.status === "cancelled") conds.push(sql`d.status = ${f.status}`);
  if (f.from) conds.push(sql`d.doc_date >= ${f.from}`);
  if (f.to) conds.push(sql`d.doc_date <= ${f.to}`);
  const where = conds.reduce((a, c) => sql`${a} and ${c}`);
  const [rows, [totals]] = await Promise.all([
    sql<VehicleDocRow[]>`
      select d.id, d.vehicle_id, d.kind, d.doc_no, to_char(d.doc_date, 'YYYY-MM-DD') as doc_date, d.party_name, d.party_phone,
             d.price, d.status, d.bike->>'reg_no' as reg_no,
             trim(concat_ws(' ', d.bike->>'make', d.bike->>'model', d.bike->>'variant')) as bike_name
      from vehicle_invoices d where ${where}
      order by d.doc_date desc, d.id desc limit ${limit + 1}`,
    sql<{ n: number; sales: number; sales_n: number; purchases: number; purchases_n: number }[]>`
      select count(*)::int as n,
             coalesce(sum(price) filter (where kind = 'sale' and status = 'issued'), 0) as sales,
             count(*) filter (where kind = 'sale' and status = 'issued')::int as sales_n,
             coalesce(sum(price) filter (where kind = 'purchase' and status = 'issued'), 0) as purchases,
             count(*) filter (where kind = 'purchase' and status = 'issued')::int as purchases_n
      from vehicle_invoices d where ${where}`,
  ]);
  return { rows: rows.slice(0, limit), more: rows.length > limit, totals };
}

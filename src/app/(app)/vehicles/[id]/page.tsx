import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, CheckCircle2, Circle, Pencil, Phone } from "lucide-react";
import { NumberPlate } from "@/components/NumberPlate";
import { Badge, Card, CardHeader, cx, LinkButton, Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { count, dateLabel, rupees } from "@/lib/format";
import { CONDITIONS, daysLeft, DOC_CHECKLIST, EVENT_KINDS, INSURANCE_TYPES, LOAN_IN_COST, LOAN_PAID_BY, LOAN_STATUS, ordinal, PART_STATUS, RC_STATUS, RC_TYPES, transferCheck, parseReg, VEHICLE_STATUS } from "@/lib/regno";
import { getVehicle, getVehicleDetails } from "@/lib/vehicles";
import {
  DeleteVehicle, EventForm, FineActions, FineForm, FixPart, OwnerForm, PartForm, RemoveEvent, RemoveOwner, RemovePart, SellForm, StatusButtons,
} from "./VehicleForms";
import { OwnerPhoto, VehiclePhotos } from "./VehiclePhotos";

export const metadata: Metadata = { title: "Bike" };

export default async function VehiclePage({ params, searchParams }: PageProps<"/vehicles/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const { saved } = await searchParams;
  if (!/^\d+$/.test(id)) notFound();
  const [v, d] = await Promise.all([getVehicle(Number(id)), getVehicleDetails(Number(id))]);
  if (!v) notFound();

  const reg = parseReg(v.reg_no);
  const st = VEHICLE_STATUS[v.status] ?? { label: v.status, tone: "neutral" as const };
  const title = [v.make, v.model, v.variant].filter(Boolean).join(" ");
  const bought = Number(v.purchase_price ?? 0);
  const loanCost = LOAN_IN_COST.includes(v.loan_paid_by) ? Number(v.loan_closure_amount ?? 0) : 0;
  const totalCost = bought + d.refurbCost + loanCost;
  const sellAt = v.status === "sold" ? Number(v.sold_price ?? 0) : Number(v.our_price ?? 0);
  const profit = sellAt ? sellAt - totalCost : null;
  const age = v.mfg_year ? new Date().getFullYear() - v.mfg_year : null;
  const accidents = d.events.filter((e) => e.kind === "accident").length;
  const damaged = d.parts.filter((p) => p.status === "damaged").length;
  const transfer = transferCheck(v, d.pendingFines);
  const loan = LOAN_STATUS[v.loan_status] ?? LOAN_STATUS.none;
  const ownerPhoto = d.photos.find((p) => p.kind === "owner")?.id ?? null;

  return (
    <>
      <Link href="/vehicles" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Used bikes</Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          <NumberPlate reg={v.reg_no} size="lg" className="self-start" />
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
              {title} <Badge tone={st.tone}>{st.label}</Badge>
              {accidents ? <Badge tone="bad">Accident history{accidents > 1 ? ` ×${accidents}` : ""}</Badge> : null}
              {damaged ? <Badge tone="warn">{damaged} damaged part{damaged === 1 ? "" : "s"}</Badge> : null}
            </h1>
            <p className="mt-1 text-sm text-ink-2">
              {[v.mfg_year && `${v.mfg_year} model${age ? ` (${age} yr${age === 1 ? "" : "s"} old)` : ""}`, v.odometer_km != null && `${count(v.odometer_km)} km`, v.colour,
                reg.valid && (reg.kind === "state" ? `${reg.state} · RTO ${reg.rto}` : "Bharat series")].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusButtons vehicleId={v.id} status={v.status} />
          <LinkButton size="sm" href={`/vehicles/${v.id}/edit`}><Pencil className="h-3.5 w-3.5" /> Edit</LinkButton>
          {user.role === "owner" ? <DeleteVehicle vehicleId={v.id} reg={reg.display} /> : null}
        </div>
      </div>
      {saved ? <div className="mb-5"><Notice tone="good">Bike saved.</Notice></div> : null}
      {d.pendingFines > 0 ? <div className="mb-5"><Notice tone="bad">{rupees(d.pendingFines)} in pending fines on this vehicle. Clear them before the RC transfer.</Notice></div> : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader title="Photos" sub={`${d.photos.filter((p) => p.kind !== "owner").length} photo${d.photos.filter((p) => p.kind !== "owner").length === 1 ? "" : "s"} · tap to enlarge`} />
            <VehiclePhotos vehicleId={v.id} photos={d.photos} />
          </Card>

          <Card>
            <CardHeader title="Vehicle details" />
            <Facts items={[
              ["Make", v.make], ["Model", v.model], ["Variant", v.variant], ["Year", v.mfg_year],
              ["Registered on", v.reg_date && dateLabel(v.reg_date)], ["Odometer", v.odometer_km != null && `${count(v.odometer_km)} km`],
              ["Colour", v.colour], ["Fuel", v.fuel], ["Engine", v.engine_cc && `${v.engine_cc} cc`],
              ["Condition", CONDITIONS.find(([k]) => k === v.condition)?.[1] ?? v.condition],
              ["Chassis no.", v.chassis_no && <span className="font-mono">{v.chassis_no}</span>],
              ["Engine no.", v.engine_no && <span className="font-mono">{v.engine_no}</span>],
            ]} />
            {v.notes ? <p className="border-t border-line px-5 py-4 text-sm whitespace-pre-line text-ink-2">{v.notes}</p> : null}
          </Card>

          <Card>
            <CardHeader title="Ownership" sub={`${v.owner_count ? ordinal(v.owner_count) : "No"} owner as per RC`} />
            <div className="grid gap-4 p-5 sm:grid-cols-[auto_1fr_auto]">
              <OwnerPhoto vehicleId={v.id} photoId={ownerPhoto} name={v.current_owner} />
              <div className="min-w-0 self-center">
                <p className="text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">Current owner</p>
                <p className="mt-1 font-semibold">{v.current_owner || "—"}</p>
                {v.owner_address ? <p className="text-sm text-ink-2">{v.owner_address}</p> : null}
              </div>
              {v.owner_phone ? (
                <a href={`tel:${v.owner_phone}`} className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-primary hover:underline">
                  <Phone className="h-4 w-4" /> {v.owner_phone}
                </a>
              ) : null}
            </div>
            {d.owners.length ? (
              <ol className="divide-y divide-line border-t border-line">
                {d.owners.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{ordinal(o.owner_no)} owner · {o.name}{o.phone ? <span className="font-normal text-ink-2"> · {o.phone}</span> : null}</p>
                      <p className="text-xs text-ink-3">
                        {[o.from_date || o.to_date ? `${o.from_date ? dateLabel(o.from_date) : "?"} – ${o.to_date ? dateLabel(o.to_date) : "?"}` : "", o.note].filter(Boolean).join(" · ") || "No dates"}
                      </p>
                    </div>
                    <RemoveOwner vehicleId={v.id} ownerId={o.id} />
                  </li>
                ))}
              </ol>
            ) : null}
            <div className="border-t border-line"><OwnerForm vehicleId={v.id} nextNo={(d.owners.at(-1)?.owner_no ?? 0) + 1} /></div>
          </Card>

          <Card>
            <CardHeader title="Papers" sub={transfer.ready ? undefined : `${transfer.missing.length} thing${transfer.missing.length === 1 ? "" : "s"} to sort out before RC transfer`}
              action={<Badge tone={transfer.ready ? "good" : "warn"}>{transfer.ready ? "Ready for RC transfer" : "Not ready for transfer"}</Badge>} />
            {!transfer.ready ? (
              <div className="border-b border-line bg-warn-soft/40 px-5 py-3 text-sm">
                <p className="font-medium text-warn">Before transferring the RC to the buyer:</p>
                <ul className="mt-1 list-disc pl-5 text-ink-2">{transfer.missing.map((m) => <li key={m}>{m}</li>)}</ul>
              </div>
            ) : null}
            <ul className="divide-y divide-line">
              <li className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">RC · {RC_TYPES[v.rc_type] ?? v.rc_type}</p>
                  <p className="truncate text-xs text-ink-3">
                    {[v.rc_owner_name && `In the name of ${v.rc_owner_name}`, v.rto_office || (reg.valid && reg.kind === "state" ? `RTO ${reg.rto}` : ""),
                      v.rc_valid_till ? `valid till ${dateLabel(v.rc_valid_till)}` : ""].filter(Boolean).join(" · ") || "No details recorded"}
                  </p>
                </div>
                <Badge tone={RC_STATUS[v.rc_status]?.tone ?? "neutral"}>{RC_STATUS[v.rc_status]?.label ?? v.rc_status}</Badge>
              </li>
              <DocRow label={`Insurance${v.insurance_type ? ` · ${INSURANCE_TYPES[v.insurance_type] ?? v.insurance_type}` : ""}`} date={v.insurance_valid_till}
                detail={[v.insurance_company, v.insurance_policy_no && `Policy ${v.insurance_policy_no}`, v.insurance_idv != null && `IDV ${rupees(v.insurance_idv)}`].filter(Boolean).join(" · ")} />
              <DocRow label="PUC certificate" date={v.puc_valid_till} detail={v.puc_cert_no ? `No. ${v.puc_cert_no}` : ""} />
              <li className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div><p className="font-medium">Loan / hypothecation</p><p className="text-xs text-ink-3">{v.hypothecation || "No loan on the RC"}</p></div>
                <Badge tone={loan.tone}>{loan.label}</Badge>
              </li>
            </ul>
            <div className="border-t border-line px-5 py-4">
              <p className="mb-2 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">Documents we have · {v.docs_in_hand.length} of {DOC_CHECKLIST.length}</p>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                {DOC_CHECKLIST.map((d) => {
                  const has = v.docs_in_hand.includes(d.key);
                  return (
                    <li key={d.key} className={cx("flex items-center gap-2", has ? "text-ink" : "text-ink-3")}>
                      {has ? <CheckCircle2 className="h-4 w-4 shrink-0 text-good" /> : <Circle className={cx("h-4 w-4 shrink-0", d.transfer && "text-warn")} />}
                      {d.label}{!has && d.transfer ? <span className="text-xs text-warn">needed for transfer</span> : null}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-ink-3">Tick documents in <Link href={`/vehicles/${v.id}/edit`} className="text-primary underline">Edit</Link>. Add photos of papers under Photos → Documents.</p>
            </div>
          </Card>

          {v.loan_status !== "none" ? (
            <Card>
              <CardHeader title="Financier / loan" sub={loan.help} action={<Badge tone={loan.tone}>{loan.label}</Badge>} />
              {v.loan_status === "active" && v.loan_tenure_months && v.loan_emis_pending != null ? (
                <div className="border-b border-line px-5 py-4">
                  <div className="mb-1.5 flex justify-between text-xs text-ink-2">
                    <span>{v.loan_tenure_months - v.loan_emis_pending} of {v.loan_tenure_months} EMIs paid</span>
                    <span>{v.loan_emis_pending} pending{v.loan_emi ? ` · ${rupees(v.loan_emis_pending * Number(v.loan_emi))} in EMIs` : ""}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="EMIs paid"
                    aria-valuemin={0} aria-valuemax={v.loan_tenure_months} aria-valuenow={v.loan_tenure_months - v.loan_emis_pending}>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, ((v.loan_tenure_months - v.loan_emis_pending) / v.loan_tenure_months) * 100)}%` }} />
                  </div>
                </div>
              ) : null}
              <Facts items={[
                ["Financier", v.hypothecation], ["Branch", v.loan_branch],
                ["Loan account no.", v.loan_account_no && <span className="font-mono">{v.loan_account_no}</span>],
                ["Loan amount", v.loan_amount != null && rupees(v.loan_amount)],
                ["EMI", v.loan_emi != null && `${rupees(v.loan_emi)} / month${v.loan_tenure_months ? ` × ${v.loan_tenure_months}` : ""}`],
                ["Loan period", (v.loan_start || v.loan_end) && `${v.loan_start ? dateLabel(v.loan_start) : "?"} – ${v.loan_end ? dateLabel(v.loan_end) : "?"}`],
                [v.loan_status === "active" ? "To close the loan" : "Closure amount", v.loan_closure_amount != null && rupees(v.loan_closure_amount)],
                [v.loan_status === "active" ? "Will be paid by" : "Paid by", LOAN_PAID_BY[v.loan_paid_by]],
                ...(v.loan_status === "active" ? [] : [["Closed on", v.loan_closed_on && dateLabel(v.loan_closed_on)] as [string, ReactNode]]),
                ...(v.loan_status === "noc_received" || v.loan_status === "removed" ? [
                  ["NOC", (v.noc_number || v.noc_date) && [v.noc_number, v.noc_date && dateLabel(v.noc_date)].filter(Boolean).join(" · ")],
                  ["Form 35 at RTO", v.form35_submitted ? "Submitted" : <span className="text-warn">Not yet</span>],
                ] as [string, ReactNode][] : []),
              ]} />
              {v.loan_notes ? <p className="border-t border-line px-5 py-3 text-sm text-ink-2">{v.loan_notes}</p> : null}
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Parts condition & warranty"
              sub={d.parts.length ? `${damaged} damaged · ${d.parts.filter((p) => p.status === "replaced").length} replaced · ${d.parts.filter((p) => (daysLeft(p.warranty_till) ?? -1) >= 0).length} under warranty` : "Damaged parts, recently replaced parts, battery and tyre warranty"} />
            {d.parts.length ? (
              <ul className="divide-y divide-line">
                {d.parts.map((p) => {
                  const ps = PART_STATUS[p.status] ?? { label: p.status, tone: "neutral" as const };
                  const w = daysLeft(p.warranty_till);
                  return (
                    <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {p.part} <Badge tone={ps.tone}>{ps.label}</Badge>
                          {w != null ? <Badge tone={w < 0 ? "neutral" : w < 30 ? "warn" : "good"}>{w < 0 ? "Warranty over" : `Warranty ${w}d left`}</Badge> : null}
                        </p>
                        <p className="text-xs text-ink-3">
                          {[p.detail, p.changed_on && `${p.status === "damaged" ? "Noted" : "Done"} ${dateLabel(p.changed_on)}`, p.odometer_km != null && `${count(p.odometer_km)} km`,
                            Number(p.cost) ? rupees(p.cost) : null, p.warranty_till && `warranty till ${dateLabel(p.warranty_till)}`].filter(Boolean).join(" · ") || "—"}
                        </p>
                        {p.status === "damaged" ? <FixPart vehicleId={v.id} partId={p.id} /> : null}
                      </div>
                      <RemovePart vehicleId={v.id} partId={p.id} />
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <div className={d.parts.length ? "border-t border-line" : ""}><PartForm vehicleId={v.id} /></div>
          </Card>

          <Card>
            <CardHeader title="History" sub={d.refurbCost ? `${rupees(d.refurbCost)} spent on service and repairs` : "Service, repairs and everything else that happened"} />
            {d.events.length ? (
              <ol className="relative px-5 pt-4">
                {d.events.map((e) => (
                  <li key={e.id} className="relative flex gap-4 pb-4 pl-6">
                    <span className={cx("absolute top-1.5 left-0 h-2.5 w-2.5 rounded-full ring-4 ring-surface",
                      e.kind === "sale" ? "bg-good" : e.kind === "accident" ? "bg-bad" : e.kind === "purchase" ? "bg-primary" : "bg-ink-3")} />
                    <span className="absolute top-4 bottom-0 left-[4.5px] w-px bg-line" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm"><span className="font-semibold">{EVENT_KINDS[e.kind] ?? e.kind}</span> · {e.title}</p>
                      <p className="text-xs text-ink-3">
                        {[dateLabel(e.event_date), e.odometer_km != null && `${count(e.odometer_km)} km`, e.user_name].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {Number(e.cost) ? <span className="num text-sm font-semibold whitespace-nowrap">{rupees(e.cost)}</span> : null}
                    {e.kind !== "sale" ? <RemoveEvent vehicleId={v.id} eventId={e.id} /> : null}
                  </li>
                ))}
              </ol>
            ) : <p className="px-5 py-4 text-sm text-ink-3">Nothing recorded yet.</p>}
            <div className="border-t border-line"><EventForm vehicleId={v.id} /></div>
          </Card>
        </div>

        <div className="flex flex-col gap-5 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader title="Price" />
            <dl className="num grid grid-cols-[1fr_auto] gap-y-2 px-5 py-4 text-sm">
              <dt className="text-ink-2">We bought for</dt><dd className="text-right">{v.purchase_price != null ? rupees(v.purchase_price) : "—"}</dd>
              <dt className="text-ink-2">Service &amp; repairs</dt><dd className="text-right">{rupees(d.refurbCost)}</dd>
              {loanCost ? <><dt className="text-ink-2">Loan closure {v.loan_paid_by === "buyer" ? "(buyer pays)" : v.loan_status === "active" ? "(we will pay)" : "(paid by us)"}</dt><dd className="text-right">{rupees(loanCost)}</dd></> : null}
              <dt className="border-t border-line pt-2 font-semibold">Total cost</dt><dd className="border-t border-line pt-2 text-right font-semibold">{rupees(totalCost)}</dd>
              <dt className="mt-2 text-ink-2">Market price</dt><dd className="mt-2 text-right">{v.market_price != null ? rupees(v.market_price) : "—"}</dd>
              <dt className="text-ink-2">Our price</dt><dd className="text-right text-base font-bold">{v.our_price != null ? rupees(v.our_price) : "—"}</dd>
              <dt className="text-ink-2">Lowest price</dt><dd className="text-right">{v.min_price != null ? rupees(v.min_price) : "—"}</dd>
              {v.status === "sold" ? <><dt className="text-ink-2">Sold for</dt><dd className="text-right font-bold">{rupees(v.sold_price)}</dd></> : null}
              {profit != null && totalCost > 0 ? (
                <>
                  <dt className={cx("border-t border-line pt-2 font-semibold", profit >= 0 ? "text-good" : "text-bad")}>{v.status === "sold" ? "Profit" : "Expected profit"}</dt>
                  <dd className={cx("border-t border-line pt-2 text-right font-semibold", profit >= 0 ? "text-good" : "text-bad")}>{rupees(profit)}</dd>
                </>
              ) : null}
            </dl>
            {v.purchased_from || v.purchase_date ? (
              <p className="border-t border-line px-5 py-3 text-xs text-ink-3">Bought {v.purchase_date ? `on ${dateLabel(v.purchase_date)}` : ""}{v.purchased_from ? ` from ${v.purchased_from}` : ""}</p>
            ) : null}
          </Card>

          <Card>
            {v.status === "sold" ? (
              <>
                <CardHeader title="Sold" />
                <div className="px-5 py-4 text-sm">
                  <p className="font-semibold">{v.sold_to}{v.sold_phone ? <span className="font-normal text-ink-2"> · {v.sold_phone}</span> : null}</p>
                  <p className="text-ink-2">{v.sold_on ? dateLabel(v.sold_on) : ""} for {rupees(v.sold_price)}{v.sold_payment_mode ? ` · paid by ${v.sold_payment_mode}` : ""}</p>
                  {v.loan_paid_by === "buyer" && Number(v.loan_closure_amount) ? (
                    <p className="mt-1 text-xs text-ink-3">Buyer paid {rupees(v.loan_closure_amount)} to {v.hypothecation || "the financier"} directly · we received {rupees(Number(v.sold_price) - Number(v.loan_closure_amount))}</p>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <CardHeader title="Sell this bike" sub="Records the buyer and closes the bike" />
                <div className="p-5"><SellForm vehicleId={v.id} ourPrice={v.our_price != null ? Number(v.our_price) : null} minPrice={v.min_price != null ? Number(v.min_price) : null}
                  buyerLoan={v.loan_paid_by === "buyer" && v.loan_status !== "none" ? { amount: Number(v.loan_closure_amount ?? 0), financier: v.hypothecation } : null} /></div>
              </>
            )}
          </Card>

          <Card>
            <CardHeader title="Fines / challans" sub={d.fines.length ? `${d.fines.filter((f) => f.status === "pending").length} pending · ${rupees(d.pendingFines)}` : "Check echallan.parivahan.gov.in and record any here"} />
            {d.fines.length ? (
              <ul className="divide-y divide-line">
                {d.fines.map((f) => (
                  <li key={f.id} className="flex items-start justify-between gap-2 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{f.offence}</p>
                      <p className="text-xs text-ink-3">{[f.challan_date && dateLabel(f.challan_date), f.place, f.challan_no].filter(Boolean).join(" · ")}</p>
                      <p className="mt-1 flex items-center gap-2">
                        <span className="num font-semibold">{rupees(f.amount)}</span>
                        <Badge tone={f.status === "paid" ? "good" : "bad"}>{f.status === "paid" ? `Paid${f.paid_on ? ` ${dateLabel(f.paid_on)}` : ""}` : "Pending"}</Badge>
                      </p>
                    </div>
                    <FineActions vehicleId={v.id} fineId={f.id} paid={f.status === "paid"} />
                  </li>
                ))}
              </ul>
            ) : null}
            <div className={d.fines.length ? "border-t border-line" : ""}><FineForm vehicleId={v.id} /></div>
          </Card>
          <p className="px-1 text-xs text-ink-3">Added {dateLabel(v.created_at)}{v.created_by_name ? ` by ${v.created_by_name}` : ""} · last changed {dateLabel(v.updated_at)}</p>
        </div>
      </div>
    </>
  );
}

function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 sm:grid-cols-3 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">{label}</dt>
          <dd className="mt-0.5 truncate text-sm font-medium">{value || <span className="text-ink-3">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

function DocRow({ label, date, detail }: { label: string; date: string | null; detail?: string }) {
  const left = daysLeft(date);
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        <p className="truncate text-xs text-ink-3">{[date ? `Valid till ${dateLabel(date)}` : "Expiry date not recorded", detail].filter(Boolean).join(" · ")}</p>
      </div>
      {left == null ? <Badge>Unknown</Badge>
        : left < 0 ? <Badge tone="bad">Expired {-left}d ago</Badge>
        : left < 15 ? <Badge tone="warn">{left === 0 ? "Expires today" : `${left} days left`}</Badge>
        : <Badge tone="good">Valid</Badge>}
    </li>
  );
}


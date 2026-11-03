"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Plus, RotateCcw, Trash2, Wrench, X } from "lucide-react";
import { DatePicker } from "@/components/DatePicker";
import { Button, ConfirmDialog, Field, Input, Notice, Select } from "@/components/ui";
import { isoDate } from "@/lib/format";
import { COMMON_PARTS, EVENT_KINDS, PART_STATUS, VEHICLE_STATUS } from "@/lib/regno";
import {
  addEvent, addFine, addOwner, addPart, deleteEvent, deleteFine, deleteOwner, deletePart, deleteVehicle, fixPart, markSold, setFineStatus, setVehicleStatus,
  type VehicleState,
} from "../actions";
import type { Financier } from "@/lib/financiers";
import { EXCHANGE_BALANCE_MODES } from "@/lib/expenses";
import { DocFields, PaymentModeSelect } from "./VehicleDocs";

type Action = (id: number, s: VehicleState, f: FormData) => Promise<VehicleState>;

/** A collapsible "+ Add …" form that resets itself after each successful save. */
function AddForm({ vehicleId, action, label, children, submit }: {
  vehicleId: number; action: Action; label: string; submit: string; children: (key: number) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, run, pending] = useActionState<VehicleState, FormData>(action.bind(null, vehicleId), {});
  if (!open) {
    return (
      <div className="px-5 py-3">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {label}</Button>
        {state.ok ? <span className="ml-2 text-xs text-good">{state.ok}</span> : null}
      </div>
    );
  }
  return (
    <form action={run} key={state.key} className="flex flex-col gap-3 border-t border-line bg-surface-2/50 p-5">
      {children(state.key ?? 0)}
      {state.error ? <Notice tone="bad">{state.error}</Notice> : state.ok ? <p className="text-xs text-good">{state.ok} Add another, or close.</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
        <Button size="sm" variant="primary" disabled={pending}>{pending ? "Saving…" : submit}</Button>
      </div>
    </form>
  );
}

export function FineForm({ vehicleId }: { vehicleId: number }) {
  return (
    <AddForm vehicleId={vehicleId} action={addFine} label="Add fine / challan" submit="Add fine">
      {() => (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Offence" className="sm:col-span-2"><Input name="offence" required placeholder="e.g. Riding without helmet" autoFocus /></Field>
          <Field label="Amount ₹"><Input name="amount" inputMode="decimal" required /></Field>
          <Field label="Challan date"><DatePicker name="challanDate" max={isoDate()} ariaLabel="Challan date" /></Field>
          <Field label="Challan no."><Input name="challanNo" className="font-mono" /></Field>
          <Field label="Place"><Input name="place" /></Field>
          <Field label="Status">
            <Select name="status" defaultValue="pending"><option value="pending">Pending</option><option value="paid">Paid</option></Select>
          </Field>
        </div>
      )}
    </AddForm>
  );
}

export function EventForm({ vehicleId }: { vehicleId: number }) {
  return (
    <AddForm vehicleId={vehicleId} action={addEvent} label="Add to history" submit="Add entry">
      {() => (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="What happened">
            <Select name="kind" defaultValue="service">
              {Object.entries(EVENT_KINDS).filter(([k]) => k !== "sale" && k !== "purchase").map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Date"><DatePicker name="date" defaultValue={isoDate()} max={isoDate()} ariaLabel="Date" /></Field>
          <Field label="Details" className="sm:col-span-2"><Input name="title" required placeholder="e.g. Engine oil, chain set and brake shoes changed" autoFocus /></Field>
          <Field label="Cost ₹" hint="Money we spent"><Input name="cost" inputMode="decimal" defaultValue="0" /></Field>
          <Field label="Odometer (km)"><Input name="odometerKm" inputMode="numeric" /></Field>
        </div>
      )}
    </AddForm>
  );
}

export function OwnerForm({ vehicleId, nextNo }: { vehicleId: number; nextNo: number }) {
  return (
    <AddForm vehicleId={vehicleId} action={addOwner} label="Add earlier owner" submit="Add owner">
      {() => (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[90px_1fr_1fr]">
          <Field label="Owner no."><Input name="ownerNo" inputMode="numeric" defaultValue={nextNo} /></Field>
          <Field label="Name"><Input name="name" required autoFocus /></Field>
          <Field label="Phone"><Input name="phone" type="tel" /></Field>
          <Field label="Owned from"><DatePicker name="fromDate" max={isoDate()} ariaLabel="Owned from" /></Field>
          <Field label="Owned till"><DatePicker name="toDate" max={isoDate()} ariaLabel="Owned till" /></Field>
          <Field label="Note"><Input name="note" placeholder="e.g. Used for office commute" /></Field>
        </div>
      )}
    </AddForm>
  );
}

export function SellForm({ vehicleId, ourPrice, minPrice, buyerLoan, nowTime, odometerKm, papers, financiers, totalCost, bought, refurbCost, loanCost }: {
  vehicleId: number; ourPrice: number | null; minPrice: number | null; buyerLoan: { amount: number; financier: string } | null;
  nowTime: string; odometerKm: number | null; papers: string[]; financiers: Financier[];
  totalCost: number; bought: number; refurbCost: number; loanCost: number;
}) {
  // On success the server action redirects to the new sale invoice.
  const [state, run, pending] = useActionState<VehicleState, FormData>(markSold.bind(null, vehicleId), {});
  const [price, setPrice] = useState(ourPrice != null ? String(ourPrice) : "");
  const [mode, setMode] = useState("Cash");
  const [exValue, setExValue] = useState("");
  const [paidNow, setPaidNow] = useState("");
  const below = minPrice != null && Number(price) > 0 && Number(price) < minPrice;
  const salePrice = parseFloat(price) || undefined;
  const numPrice = Number(price) || 0;
  const isExchange = mode === "Exchange";
  const isFinance = mode === "Finance";
  const isPayLater = mode === "Pay Later";
  const exNum = isExchange ? (parseFloat(exValue) || 0) : 0;
  const effectiveSale = numPrice - exNum;
  const profit = totalCost > 0 && numPrice > 0 ? effectiveSale - totalCost : null;
  const paidNowNum = parseFloat(paidNow) || 0;
  const dueNum = isPayLater ? numPrice : (paidNowNum > 0 && paidNowNum < numPrice ? numPrice - paidNowNum : 0);
  const showPartial = !isExchange && !isFinance && !isPayLater;
  const fmt = (v: number) => "₹" + v.toLocaleString("en-IN");
  return (
    <form action={run} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={buyerLoan?.amount ? "Sold for ₹ (incl. loan)" : "Sold for ₹"} error={below ? `Below the lowest price ₹${(minPrice ?? 0).toLocaleString("en-IN")}` : undefined}>
          <Input name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </Field>
        <Field label="Date"><DatePicker name="date" defaultValue={isoDate()} max={isoDate()} ariaLabel="Sale date" /></Field>
        {totalCost > 0 && (
          <div className={`col-span-2 rounded-lg border px-4 py-3 text-[13px] ${profit == null ? "border-line bg-surface-2" : profit >= 0 ? "border-good/30 bg-good-soft/50" : "border-bad/30 bg-bad-soft/50"}`}>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
              {bought > 0 && <><dt className="text-ink-3">We bought for</dt><dd className="text-right font-medium text-ink">{fmt(bought)}</dd></>}
              {refurbCost > 0 && <><dt className="text-ink-3">Service &amp; repairs</dt><dd className="text-right font-medium text-ink">{fmt(refurbCost)}</dd></>}
              {loanCost > 0 && <><dt className="text-ink-3">Loan (shop paid)</dt><dd className="text-right font-medium text-ink">{fmt(loanCost)}</dd></>}
              <dt className="border-t border-line pt-1.5 mt-0.5 text-ink-2 font-medium">Total cost</dt>
              <dd className="border-t border-line pt-1.5 mt-0.5 text-right font-semibold text-ink">{fmt(totalCost)}</dd>
              {isExchange && exNum > 0 && <><dt className="text-ink-3 pt-0.5">Exchange allowance</dt><dd className="text-right font-medium text-ink pt-0.5">−{fmt(exNum)}</dd></>}
              {profit != null && (
                <>
                  <dt className={`border-t border-line/60 pt-1.5 mt-0.5 font-semibold ${profit >= 0 ? "text-good" : "text-bad"}`}>Profit</dt>
                  <dd className={`border-t border-line/60 pt-1.5 mt-0.5 text-right font-bold text-[15px] ${profit >= 0 ? "text-good" : "text-bad"}`}>{profit >= 0 ? "" : "−"}{fmt(Math.abs(profit))}</dd>
                </>
              )}
              {profit == null && numPrice === 0 && (
                <><dt className="border-t border-line pt-1.5 mt-0.5 text-ink-3 col-span-2">Enter the sale price to see profit</dt></>
              )}
            </dl>
          </div>
        )}
        <Field label="Buyer name"><Input name="buyer" required /></Field>
        <Field label="Buyer phone"><Input name="phone" type="tel" /></Field>
        <Field label="Paid by" hint="Exchange = customer gives their old bike as part-payment" className="col-span-2">
          <PaymentModeSelect defaultValue="Cash" financiers={financiers} salePrice={salePrice} onModeChange={setMode} />
        </Field>
        {isExchange && (
          <div className="col-span-2 rounded-lg border border-info/30 bg-info-soft/40 p-3 space-y-3">
            <p className="text-[12px] font-semibold text-ink-2">Exchange bike details</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Reg number" className="col-span-2">
                <Input name="exchangeRegNo" placeholder="TN 76 XX 1234" required={isExchange} className="font-mono uppercase" />
              </Field>
              <Field label="Make"><Input name="exchangeMake" placeholder="Honda" /></Field>
              <Field label="Model"><Input name="exchangeModel" placeholder="Activa 6G" /></Field>
              <Field label="Year"><Input name="exchangeYear" inputMode="numeric" placeholder="2020" /></Field>
              <Field label="Exchange value ₹" hint="What we are paying for their bike">
                <Input name="exchangeValue" inputMode="decimal" value={exValue} onChange={(e) => setExValue(e.target.value)} required={isExchange} />
              </Field>
            </div>
            {numPrice > 0 && exNum > 0 && (
              <div className="rounded border border-line bg-surface px-3 py-2 text-[12.5px]">
                <span className="text-ink-3">Balance due from buyer: </span>
                <span className="font-semibold text-ink">{fmt(Math.max(0, numPrice - exNum))}</span>
              </div>
            )}
            <Field label="Balance paid by">
              <Select name="exchangeBalanceMode" defaultValue="Cash">
                {EXCHANGE_BALANCE_MODES.map((m) => <option key={m}>{m}</option>)}
              </Select>
            </Field>
          </div>
        )}
        {isPayLater && numPrice > 0 && (
          <div className="col-span-2 space-y-3">
            <input type="hidden" name="amountPaidNow" value="0" />
            <div className="rounded-lg border border-warn/40 bg-warn-soft/30 px-3 py-2.5 text-[13px] text-warn">
              Customer will pay later — {fmt(numPrice)} will be recorded as <strong>Payment Due</strong>.
            </div>
            <Field label="Balance due by">
              <DatePicker name="dueDate" ariaLabel="Balance due by" />
            </Field>
          </div>
        )}
        {showPartial && numPrice > 0 && (
          <div className="col-span-2 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount paid now ₹" hint="Leave blank if full amount received">
                <Input name="amountPaidNow" inputMode="decimal" value={paidNow} onChange={(e) => setPaidNow(e.target.value)} placeholder={fmt(numPrice)} />
              </Field>
              {dueNum > 0 && (
                <Field label="Balance due by">
                  <DatePicker name="dueDate" ariaLabel="Balance due by" />
                </Field>
              )}
            </div>
            {dueNum > 0 && (
              <div className="rounded border border-warn/30 bg-warn-soft/40 px-3 py-2 text-[12.5px]">
                <span className="text-ink-3">Balance due from buyer: </span>
                <span className="font-semibold text-warn">{fmt(dueNum)}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <p className="-mb-1 border-t border-line pt-3 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">For the sale invoice</p>
      <DocFields who="Buyer" nowTime={nowTime} odometerKm={odometerKm} papers={papers} papersLabel="Papers handed over" />
      {buyerLoan && buyerLoan.amount ? (
        <Notice tone="info">
          The buyer pays ₹{buyerLoan.amount.toLocaleString("en-IN")} to {buyerLoan.financier || "the financier"} directly.
          {Number(price) ? <> You collect <b>₹{Math.max(0, Number(price) - buyerLoan.amount).toLocaleString("en-IN")}</b>.</> : null}
        </Notice>
      ) : null}
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <Button variant="primary" disabled={pending}>{pending ? "Saving…" : "Mark as sold and create invoice"}</Button>
    </form>
  );
}

export function StatusButtons({ vehicleId, status }: { vehicleId: number; status: string }) {
  const [pending, start] = useTransition();
  const [confirmUndo, setConfirmUndo] = useState(false);
  if (status === "sold") {
    return (
      <>
        <ConfirmDialog open={confirmUndo} title="Undo sale?" message="This will put the bike back in stock." confirmLabel="Undo sale" variant="secondary" onConfirm={() => { setConfirmUndo(false); start(() => setVehicleStatus(vehicleId, "in_stock")); }} onCancel={() => setConfirmUndo(false)} />
        <Button size="sm" disabled={pending} onClick={() => setConfirmUndo(true)}>
          <RotateCcw className="h-3.5 w-3.5" /> Undo sale
        </Button>
      </>
    );
  }
  const options = (["in_stock", "reserved", "in_service"] as const).filter((s) => s !== status);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((s) => (
        <Button key={s} size="sm" disabled={pending} onClick={() => start(() => setVehicleStatus(vehicleId, s))}>
          Mark {VEHICLE_STATUS[s].label.toLowerCase()}
        </Button>
      ))}
    </div>
  );
}

export function FineActions({ vehicleId, fineId, paid }: { vehicleId: number; fineId: number; paid: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => setFineStatus(vehicleId, fineId, !paid))}
        title={paid ? "Mark as pending" : "Mark as paid"}>
        {paid ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}{paid ? "Unpaid" : "Paid"}
      </Button>
      <RemoveButton label="this fine" onRemove={() => deleteFine(vehicleId, fineId)} />
    </div>
  );
}

export function RemoveEvent({ vehicleId, eventId }: { vehicleId: number; eventId: number }) {
  return <RemoveButton label="this history entry" onRemove={() => deleteEvent(vehicleId, eventId)} />;
}
export function RemoveOwner({ vehicleId, ownerId }: { vehicleId: number; ownerId: number }) {
  return <RemoveButton label="this owner" onRemove={() => deleteOwner(vehicleId, ownerId)} />;
}

function RemoveButton({ label, onRemove }: { label: string; onRemove: () => Promise<void> }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  return (
    <>
      <ConfirmDialog open={open} title={`Remove ${label}?`} confirmLabel="Remove" onConfirm={() => { setOpen(false); start(onRemove); }} onCancel={() => setOpen(false)} />
      <button type="button" disabled={pending} aria-label={`Remove ${label}`} title="Remove"
        onClick={() => setOpen(true)}
        className="rounded-md p-1.5 text-ink-3 hover:bg-bad-soft hover:text-bad disabled:opacity-40">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </>
  );
}

export function DeleteVehicle({ vehicleId, reg }: { vehicleId: number; reg: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <ConfirmDialog open={open} title={`Delete ${reg}?`} message="This will permanently remove the bike with all its owners, fines and history. This can't be undone." confirmLabel="Delete" onConfirm={() => { setOpen(false); start(async () => { const r = await deleteVehicle(vehicleId); if (r?.error) setError(r.error); }); }} onCancel={() => setOpen(false)} />
      {error && <Notice tone="bad">{error}</Notice>}
      <Button size="sm" variant="danger" disabled={pending} onClick={() => setOpen(true)}>
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </Button>
    </>
  );
}

/** Cost, date, km and warranty — shared by "add part" and "fix damaged part". */
function PartWorkFields({ status }: { status: string }) {
  const done = status === "repaired" || status === "replaced";
  return (
    <>
      <Field label={status === "damaged" ? "What's wrong" : status === "ok" ? "Brand / note" : "Brand / what was done"} className="sm:col-span-2">
        <Input name="detail" placeholder={status === "damaged" ? "e.g. Cracked, from accident on left side" : "e.g. Exide 5Ah, new"} />
      </Field>
      {done ? (
        <>
          <Field label="Done on"><DatePicker name="changedOn" defaultValue={isoDate()} max={isoDate()} ariaLabel="Done on" /></Field>
          <Field label="Cost ₹" hint="Added to the bike's total cost"><Input name="cost" inputMode="decimal" defaultValue="0" /></Field>
          <Field label="Odometer (km)"><Input name="odometerKm" inputMode="numeric" /></Field>
        </>
      ) : null}
      {status !== "damaged" ? <Field label="Warranty till" hint="Battery, tyres, etc."><DatePicker name="warrantyTill" ariaLabel="Warranty till" /></Field> : null}
    </>
  );
}

export function PartForm({ vehicleId }: { vehicleId: number }) {
  const [status, setStatus] = useState("damaged");
  return (
    <AddForm vehicleId={vehicleId} action={addPart} label="Add part condition" submit="Save part">
      {() => (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Part">
            <Input name="part" list="common-parts" required autoFocus placeholder="e.g. Battery" />
            <datalist id="common-parts">{COMMON_PARTS.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
          <Field label="Condition">
            <Select name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(PART_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
          <PartWorkFields status={status} />
        </div>
      )}
    </AddForm>
  );
}

/** For a damaged part: record that it has been repaired or replaced. */
export function FixPart({ vehicleId, partId }: { vehicleId: number; partId: number }) {
  const [status, setStatus] = useState<"repaired" | "replaced" | null>(null);
  const [state, run, pending] = useActionState<VehicleState, FormData>(fixPart.bind(null, vehicleId, partId), {});
  if (!status) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setStatus("replaced")}><Wrench className="h-3.5 w-3.5" /> Fixed</Button>
    );
  }
  return (
    <form action={run} className="mt-2 grid w-full grid-cols-1 gap-3 rounded-lg border border-line bg-surface-2/50 p-3 sm:grid-cols-2">
      <Field label="Fixed by">
        <Select name="status" value={status} onChange={(e) => setStatus(e.target.value as "repaired" | "replaced")}>
          <option value="replaced">Replaced with new</option><option value="repaired">Repaired</option>
        </Select>
      </Field>
      <PartWorkFields status={status} />
      {state.error ? <div className="sm:col-span-2"><Notice tone="bad">{state.error}</Notice></div> : null}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setStatus(null)}>Cancel</Button>
        <Button size="sm" variant="primary" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}

export function RemovePart({ vehicleId, partId }: { vehicleId: number; partId: number }) {
  return <RemoveButton label="this part (and its history entry)" onRemove={() => deletePart(vehicleId, partId)} />;
}

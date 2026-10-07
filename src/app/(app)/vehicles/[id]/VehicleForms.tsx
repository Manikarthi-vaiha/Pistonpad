"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Plus, RotateCcw, Trash2, Wrench, X } from "lucide-react";
import { DatePicker } from "@/components/DatePicker";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { BIKE_PAYMENT_MODES } from "@/lib/expenses";
import { isoDate } from "@/lib/format";
import { COMMON_PARTS, EVENT_KINDS, PART_STATUS, VEHICLE_STATUS } from "@/lib/regno";
import {
  addEvent, addFine, addOwner, addPart, deleteEvent, deleteFine, deleteOwner, deletePart, deleteVehicle, fixPart, markSold, setFineStatus, setVehicleStatus,
  type VehicleState,
} from "../actions";

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

export function SellForm({ vehicleId, ourPrice, minPrice, buyerLoan }: {
  vehicleId: number; ourPrice: number | null; minPrice: number | null; buyerLoan: { amount: number; financier: string } | null;
}) {
  const [state, run, pending] = useActionState<VehicleState, FormData>(markSold.bind(null, vehicleId), {});
  const [price, setPrice] = useState(ourPrice != null ? String(ourPrice) : "");
  const below = minPrice != null && Number(price) > 0 && Number(price) < minPrice;
  return (
    <form action={run} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={buyerLoan?.amount ? "Sold for ₹ (incl. loan)" : "Sold for ₹"} error={below ? `Below the lowest price ₹${(minPrice ?? 0).toLocaleString("en-IN")}` : undefined}>
          <Input name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </Field>
        <Field label="Date"><DatePicker name="date" defaultValue={isoDate()} max={isoDate()} ariaLabel="Sale date" /></Field>
        <Field label="Buyer name"><Input name="buyer" required /></Field>
        <Field label="Buyer phone"><Input name="phone" type="tel" /></Field>
        <Field label="Paid by" hint="Finance = buyer's loan company pays us" className="col-span-2">
          <Select name="mode" defaultValue="Cash">{BIKE_PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}</Select>
        </Field>
      </div>
      {buyerLoan && buyerLoan.amount ? (
        <Notice tone="info">
          The buyer pays ₹{buyerLoan.amount.toLocaleString("en-IN")} to {buyerLoan.financier || "the financier"} directly.
          {Number(price) ? <> You collect <b>₹{Math.max(0, Number(price) - buyerLoan.amount).toLocaleString("en-IN")}</b>.</> : null}
        </Notice>
      ) : null}
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <Button variant="primary" disabled={pending}>{pending ? "Saving…" : "Mark as sold"}</Button>
    </form>
  );
}

export function StatusButtons({ vehicleId, status }: { vehicleId: number; status: string }) {
  const [pending, start] = useTransition();
  if (status === "sold") {
    return (
      <Button size="sm" disabled={pending} onClick={() => { if (confirm("Undo the sale and put this bike back in stock?")) start(() => setVehicleStatus(vehicleId, "in_stock")); }}>
        <RotateCcw className="h-3.5 w-3.5" /> Undo sale
      </Button>
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
  return (
    <button type="button" disabled={pending} aria-label={`Remove ${label}`} title="Remove"
      onClick={() => { if (confirm(`Remove ${label}?`)) start(onRemove); }}
      className="rounded-md p-1.5 text-ink-3 hover:bg-bad-soft hover:text-bad disabled:opacity-40">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

export function DeleteVehicle({ vehicleId, reg }: { vehicleId: number; reg: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="danger" disabled={pending}
      onClick={() => { if (confirm(`Delete ${reg} with all its owners, fines and history? This can't be undone.`)) start(() => deleteVehicle(vehicleId)); }}>
      <Trash2 className="h-3.5 w-3.5" /> Delete
    </Button>
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

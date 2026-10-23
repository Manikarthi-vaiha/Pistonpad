"use client";

import { useActionState, useState, useTransition } from "react";
import { Ban, Check, FileDown, Loader2, MessageCircle, Printer, Share2 } from "lucide-react";
import { DatePicker } from "@/components/DatePicker";
import { Button, cx, Field, Input, Notice, Select } from "@/components/ui";
import { BIKE_PAYMENT_MODES } from "@/lib/expenses";
import { isoDate } from "@/lib/format";
import { DOC_CHECKLIST } from "@/lib/regno";
import { cancelVehicleDoc, createVehicleDoc, type VehicleState } from "../actions";

/** Tap to tick the papers handed over (sale) or received (purchase). Starts with the papers the shop holds. */
export function PapersPicker({ initial, label }: { initial: string[]; label: string }) {
  const [on, setOn] = useState(new Set(initial));
  const toggle = (k: string) => setOn((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-[13px] font-medium text-ink-2">{label} <span className="font-normal text-ink-3">· {on.size}</span></legend>
      <div className="flex flex-wrap gap-1.5">
        {DOC_CHECKLIST.map((d) => (
          <button key={d.key} type="button" aria-pressed={on.has(d.key)} onClick={() => toggle(d.key)}
            className={cx("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
              on.has(d.key) ? "border-primary bg-primary text-primary-ink" : "border-line-2 bg-surface text-ink-2 hover:border-ink-3 hover:text-ink")}>
            {on.has(d.key) ? <Check className="h-3 w-3" /> : null}{d.label}
          </button>
        ))}
      </div>
      {[...on].map((k) => <input key={k} type="hidden" name="papers" value={k} />)}
    </fieldset>
  );
}

/** Fields printed on the document besides names and money: time, address, ID proof, km, papers, note. */
export function DocFields({ who, nowTime, odometerKm, papers, address = "", idProof = "", papersLabel }: {
  who: string; nowTime: string; odometerKm: number | null; papers: string[]; address?: string; idProof?: string; papersLabel: string;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Time" hint="When the bike changed hands"><Input name="time" type="time" defaultValue={nowTime} required /></Field>
        <Field label="Odometer (km)"><Input name="odometerKm" inputMode="numeric" defaultValue={odometerKm ?? ""} /></Field>
        <Field label={`${who} address`} className="col-span-2"><Input name="address" defaultValue={address} /></Field>
        <Field label={`${who} ID proof`} hint="Last 4 digits are enough, e.g. Aadhaar ••••1234" className="col-span-2">
          <Input name="idProof" defaultValue={idProof} placeholder="Aadhaar ••••1234" />
        </Field>
      </div>
      <PapersPicker initial={papers} label={papersLabel} />
      <Field label="Note on the document (optional)"><Input name="docNotes" placeholder="e.g. Second key to be handed over on Monday" /></Field>
    </>
  );
}

/** Issue a purchase receipt, or a sale invoice for a bike sold before invoices existed. */
export function DocForm({ vehicleId, kind, defaults, nowTime, summary }: {
  vehicleId: number; kind: "sale" | "purchase"; nowTime: string; summary: string;
  defaults: { date: string; party: string; phone: string; address: string; idProof: string; mode: string; odometerKm: number | null; papers: string[] };
}) {
  const [open, setOpen] = useState(false);
  // On success the server action redirects to the new document.
  const [state, run, pending] = useActionState<VehicleState, FormData>(createVehicleDoc.bind(null, vehicleId, kind), {});
  const sale = kind === "sale";
  if (!open) {
    return <Button size="sm" variant={sale ? "primary" : "secondary"} onClick={() => setOpen(true)}>{sale ? "Create sale invoice" : "Create purchase receipt"}</Button>;
  }
  return (
    <form action={run} className="flex w-full flex-col gap-3 rounded-xl border border-line bg-surface-2/50 p-4">
      <p className="text-[13px] text-ink-2">{summary}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label={sale ? "Sale date" : "Purchase date"}><DatePicker name="date" defaultValue={defaults.date || isoDate()} max={isoDate()} ariaLabel="Date" /></Field>
        <Field label={sale ? "Paid by" : "We paid the seller by"}>
          <Select name="mode" defaultValue={defaults.mode || "Cash"}>{BIKE_PAYMENT_MODES.filter((m) => sale || m !== "Finance").map((m) => <option key={m}>{m}</option>)}</Select>
        </Field>
        <Field label={sale ? "Buyer name" : "Seller name (as on RC)"} className="col-span-2"><Input name="party" defaultValue={defaults.party} required /></Field>
        <Field label={sale ? "Buyer phone" : "Seller phone"} className="col-span-2"><Input name="phone" type="tel" defaultValue={defaults.phone} /></Field>
      </div>
      <DocFields who={sale ? "Buyer" : "Seller"} nowTime={nowTime} odometerKm={defaults.odometerKm} papers={defaults.papers}
        address={defaults.address} idProof={defaults.idProof} papersLabel={sale ? "Papers handed over" : "Papers received"} />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
        <Button size="sm" variant="primary" disabled={pending}>{pending ? "Issuing…" : sale ? "Issue sale invoice" : "Issue purchase receipt"}</Button>
      </div>
    </form>
  );
}

/** Print, PDF, share and (owner) cancel, on the document page. */
export function DocActions({ vehicleId, docId, pdfPath, phone, shareText, cancelled, isOwner }: {
  vehicleId: number; docId: number; pdfPath: string; phone: string; shareText: string; cancelled: boolean; isOwner: boolean;
}) {
  const [sharing, setSharing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const digits = phone.replace(/\D/g, "");
  const waNumber = digits.length === 10 ? "91" + digits : digits;
  const openWhatsApp = () => {
    const text = `${shareText}\n\nView or download (PDF):\n${window.location.origin}${pdfPath}`;
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };
  // On phones, share the PDF file itself; elsewhere fall back to a WhatsApp message with the link.
  const sharePdf = async () => {
    setError("");
    setSharing(true);
    try {
      const res = await fetch(pdfPath);
      if (!res.ok) throw new Error("pdf");
      const name = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "document.pdf";
      const file = new File([await res.blob()], name, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: name, text: shareText.replace(/\*/g, "") });
      else openWhatsApp();
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Couldn't prepare the PDF. Check the connection and try again.");
    } finally {
      setSharing(false);
    }
  };
  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
        <Button onClick={sharePdf} disabled={sharing}>{sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Share PDF</Button>
        <Button onClick={openWhatsApp}><MessageCircle className="h-4 w-4" /> WhatsApp</Button>
        <a href={`${pdfPath}?download=1`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-2 bg-surface px-4 text-sm font-semibold hover:bg-surface-2">
          <FileDown className="h-4 w-4" /> PDF
        </a>
        {isOwner && !cancelled ? <Button variant="danger" onClick={() => setCancelOpen((o) => !o)}><Ban className="h-4 w-4" /> Cancel</Button> : null}
      </div>
      {cancelOpen ? (
        <form className="flex w-full max-w-xl flex-col gap-3 rounded-xl border border-bad/30 bg-bad-soft p-4"
          onSubmit={(e) => { e.preventDefault(); start(async () => { await cancelVehicleDoc(vehicleId, docId, reason); setCancelOpen(false); }); }}>
          <p className="text-sm font-medium text-bad">Cancel this document? It keeps its number and shows CANCELLED. You can then issue a new one.</p>
          <div className="flex gap-2">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. wrong buyer address" />
            <Button variant="danger" disabled={pending}>{pending ? "Cancelling…" : "Yes, cancel"}</Button>
          </div>
        </form>
      ) : null}
      {error ? <Notice tone="bad">{error}</Notice> : null}
    </div>
  );
}

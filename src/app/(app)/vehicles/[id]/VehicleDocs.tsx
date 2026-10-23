"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Ban, Check, FileDown, Loader2, MessageCircle, Printer, Share2 } from "lucide-react";
import { DatePicker } from "@/components/DatePicker";
import { Button, cx, Field, Input, Notice, Select } from "@/components/ui";
import { BIKE_PAYMENT_MODES } from "@/lib/expenses";
import { isoDate } from "@/lib/format";
import type { Financier } from "@/lib/financiers";
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

/**
 * Finance section shown on a SALE invoice when the buyer takes a loan.
 * Total loan = (price − down payment) + doc charge + processing fee.
 * EMI interest is calculated on the total loan amount.
 */
export function FinanceSection({ financiers, salePrice }: { financiers: Financier[]; salePrice?: number }) {
  const [finId, setFinId] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [tenure, setTenure] = useState("24");
  const [docChargeInput, setDocChargeInput] = useState("");
  const [processingFeeInput, setProcessingFeeInput] = useState("");

  const selectedFin = useMemo(() => financiers.find((f) => String(f.id) === finId), [financiers, finId]);
  const price = salePrice ?? 0;
  const down = parseFloat(downPayment) || 0;
  const remainingLoan = price > 0 && down >= 0 && down < price ? price - down : null;

  const docChargeNum = parseFloat(docChargeInput) || 0;
  const processingFeeNum = parseFloat(processingFeeInput) || 0;
  // Total loan = remaining loan + charges (both rolled into the financed amount)
  const totalLoan = remainingLoan != null ? remainingLoan + docChargeNum + processingFeeNum : null;

  // Pre-populate charge inputs when the financier selection changes
  const handleFinancierChange = (newId: string) => {
    setFinId(newId);
    const fin = financiers.find((f) => String(f.id) === newId);
    if (fin) {
      setDocChargeInput(fin.doc_charge != null ? String(fin.doc_charge) : "");
      const curDown = parseFloat(downPayment) || 0;
      const curRemaining = price > 0 && curDown >= 0 && curDown < price ? price - curDown : 0;
      if (fin.processing_fee_pct != null && curRemaining > 0) {
        const pf = Math.round(curRemaining * Number(fin.processing_fee_pct) / 100 * 100) / 100;
        setProcessingFeeInput(String(pf));
      } else {
        setProcessingFeeInput("");
      }
    } else {
      setDocChargeInput("");
      setProcessingFeeInput("");
    }
  };

  const emi = useMemo(() => {
    if (!totalLoan || !selectedFin?.interest_rate || !tenure) return null;
    const n = parseInt(tenure);
    const r = Number(selectedFin.interest_rate) / 100 / 12;
    let e: number;
    if (selectedFin.rate_type === "flat") {
      e = (totalLoan + totalLoan * Number(selectedFin.interest_rate) / 100 * n / 12) / n;
    } else {
      if (r === 0) e = totalLoan / n;
      else e = (totalLoan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    }
    if (selectedFin.round_to > 0) e = Math.ceil(e / selectedFin.round_to) * selectedFin.round_to;
    return Math.round(e);
  }, [totalLoan, selectedFin, tenure]);

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  // Hint shows the default % calculation so user knows the suggested value
  const procHint = selectedFin?.processing_fee_pct != null && remainingLoan != null
    ? `Default: ${selectedFin.processing_fee_pct}% of ₹${remainingLoan.toLocaleString("en-IN")} = ₹${Math.round(remainingLoan * Number(selectedFin.processing_fee_pct) / 100).toLocaleString("en-IN")}`
    : undefined;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-info/40 bg-info-soft p-4">
      <p className="text-[13px] font-semibold text-info">Finance / loan details</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Finance company" className="col-span-2">
          <Select name="buyerFinanceId" value={finId} onChange={(e) => handleFinancierChange(e.target.value)}>
            <option value="">— Select or type below —</option>
            {financiers.filter((f) => f.active).map((f) => <option key={f.id} value={String(f.id)}>{f.name}</option>)}
          </Select>
        </Field>
        {!finId && (
          <Field label="Finance company name (free text)" className="col-span-2">
            <Input name="buyerFinanceName" placeholder="e.g. Bajaj Finance" />
          </Field>
        )}
        {finId && <input type="hidden" name="buyerFinanceName" value={selectedFin?.name ?? ""} />}
        <Field label="Down payment ₹" hint={remainingLoan != null ? `Remaining loan: ₹${remainingLoan.toLocaleString("en-IN")}` : price > 0 ? "Enter down payment" : undefined}>
          <Input name="buyerDownPayment" inputMode="decimal" value={downPayment} onChange={(e) => setDownPayment(e.target.value)}
            placeholder={price > 0 ? `e.g. ${Math.round(price * 0.3).toLocaleString("en-IN")}` : "0"} />
        </Field>
        <Field label="Tenure (months)" hint={emi ? `EMI ≈ ₹${emi.toLocaleString("en-IN")}/month` : undefined}>
          <Select name="buyerTenureMonths" value={tenure} onChange={(e) => setTenure(e.target.value)}>
            {[6, 12, 18, 24, 30, 36, 48, 60, 72, 84].map((n) => <option key={n} value={String(n)}>{n} months</option>)}
          </Select>
        </Field>
        <Field label="Documentation charge ₹" hint="Flat fee — edit if needed">
          <Input name="buyerDocCharge" inputMode="decimal" value={docChargeInput}
            onChange={(e) => setDocChargeInput(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Processing fee ₹" hint={procHint ?? "Flat amount — edit if needed"}>
          <Input name="buyerProcessingFee" inputMode="decimal" value={processingFeeInput}
            onChange={(e) => setProcessingFeeInput(e.target.value)} placeholder="0" />
        </Field>
      </div>

      {/* Total loan breakdown — shown once we have a remaining loan */}
      {totalLoan != null && totalLoan > 0 && (
        <div className="rounded-lg border border-info/30 bg-white/50 dark:bg-white/5 px-4 py-3 text-[13px]">
          <p className="mb-1.5 font-semibold text-ink-2">Total loan breakdown</p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1">
            {remainingLoan != null && <>
              <dt className="text-ink-3">Remaining loan (price − down payment)</dt>
              <dd className="text-right font-semibold">{fmt(remainingLoan)}</dd>
            </>}
            {docChargeNum > 0 && <>
              <dt className="text-ink-3">Documentation charge</dt>
              <dd className="text-right font-semibold">{fmt(docChargeNum)}</dd>
            </>}
            {processingFeeNum > 0 && <>
              <dt className="text-ink-3">Processing fee</dt>
              <dd className="text-right font-semibold">{fmt(processingFeeNum)}</dd>
            </>}
            <dt className="border-t border-info/20 pt-1 font-semibold text-ink">Total loan amount</dt>
            <dd className="border-t border-info/20 pt-1 text-right font-bold text-ink">{fmt(totalLoan)}</dd>
          </dl>
          {emi && (
            <p className="mt-2 text-[12px] text-ink-3">
              Interest on total loan · EMI ≈ <b className="text-ink">₹{emi.toLocaleString("en-IN")}/month</b> for {tenure} months
            </p>
          )}
        </div>
      )}

      {/* Hidden input carries the calculated EMI to the server */}
      {emi && <input type="hidden" name="buyerEmiAmount" value={String(emi)} />}
    </div>
  );
}

/**
 * Payment mode select that also controls the FinanceSection.
 * Use this in forms that need the finance section.
 */
export function PaymentModeSelect({ defaultValue, financiers, salePrice, name = "mode" }: {
  defaultValue?: string; financiers: Financier[]; salePrice?: number; name?: string;
}) {
  const [mode, setMode] = useState(defaultValue ?? "Cash");
  return (
    <>
      <Select name={name} value={mode} onChange={(e) => setMode(e.target.value)}>
        {BIKE_PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
      </Select>
      {mode === "Finance" && <FinanceSection financiers={financiers} salePrice={salePrice} />}
    </>
  );
}

/** Issue a purchase receipt, or a sale invoice for a bike sold before invoices existed. */
export function DocForm({ vehicleId, kind, defaults, nowTime, summary, financiers, salePrice }: {
  vehicleId: number; kind: "sale" | "purchase"; nowTime: string; summary: string;
  financiers: Financier[]; salePrice?: number;
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
          {sale
            ? <PaymentModeSelect defaultValue={defaults.mode || "Cash"} financiers={financiers} salePrice={salePrice} />
            : <Select name="mode" defaultValue={defaults.mode || "Cash"}>{BIKE_PAYMENT_MODES.filter((m) => m !== "Finance").map((m) => <option key={m}>{m}</option>)}</Select>}
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

/** Compact WhatsApp button for a document row: opens a chat with that person and a link to the PDF. */
export function WhatsAppDoc({ pdfPath, phone, text }: { pdfPath: string; phone: string; text: string }) {
  const digits = phone.replace(/\D/g, "");
  const wa = digits.length === 10 ? "91" + digits : digits;
  return (
    <button type="button" title={phone ? `WhatsApp ${phone}` : "Choose a WhatsApp contact"} aria-label="Send on WhatsApp"
      onClick={() => window.open(`https://wa.me/${wa}?text=${encodeURIComponent(`${text}\n\nView or download (PDF):\n${window.location.origin}${pdfPath}`)}`, "_blank", "noopener")}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-2.5 text-[13px] font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink">
      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
    </button>
  );
}

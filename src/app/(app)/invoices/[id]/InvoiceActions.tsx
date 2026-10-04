"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, FileDown, IndianRupee, Loader2, MessageCircle, Printer, ReceiptIndianRupee, Share2 } from "lucide-react";
import { Button, Field, Input, LinkButton, Notice, Select } from "@/components/ui";
import { rupees } from "@/lib/format";
import { addPayment, voidInvoice } from "../actions";

export function InvoiceActions({ invoiceId, status, due, isOwner, phone, shareText, pdfPath }: {
  invoiceId: number; status: string; due: number; isOwner: boolean; phone: string; shareText: string; pdfPath: string;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<"" | "pay" | "cancel">("");
  const [amount, setAmount] = useState(String(due));
  const [mode, setMode] = useState("Cash");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const [sharing, setSharing] = useState(false);

  // WhatsApp chat with the customer (or a contact picker if there's no phone), with a link to the PDF.
  const digits = phone.replace(/\D/g, "");
  const waNumber = digits.length === 10 ? "91" + digits : digits;
  const pdfUrl = () => `${window.location.origin}${pdfPath}`;
  const openWhatsApp = () => {
    const text = `${shareText}\n\nView or download your invoice (PDF):\n${pdfUrl()}`;
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  // On phones, share the PDF file itself (WhatsApp, email…); elsewhere fall back to the link.
  const sharePdf = async () => {
    setError("");
    setSharing(true);
    try {
      const res = await fetch(pdfPath);
      if (!res.ok) throw new Error("pdf");
      const name = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "invoice.pdf";
      const file = new File([await res.blob()], name, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name, text: shareText.replace(/\*/g, "") });
      } else {
        openWhatsApp();
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Couldn't prepare the PDF. Check the connection and try again.");
    } finally {
      setSharing(false);
    }
  };

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (r.ok) { setPanel(""); router.refresh(); } else setError(r.error ?? "Could not save.");
    });

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex flex-wrap justify-end gap-2">
        {status !== "cancelled" && due > 0 ? (
          <Button variant="primary" onClick={() => { setPanel(panel === "pay" ? "" : "pay"); setAmount(String(due)); }}>
            <IndianRupee className="h-4 w-4" /> Receive payment
          </Button>
        ) : null}
        <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
        <Button onClick={sharePdf} disabled={sharing} title="Send the PDF to WhatsApp or any app (phones)">
          {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Share PDF
        </Button>
        <Button onClick={openWhatsApp} title={phone ? `Open WhatsApp chat with ${phone}` : "Choose a WhatsApp contact"}>
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </Button>
        <a href={`${pdfPath}?download=1`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-2 bg-surface px-4 text-sm font-semibold hover:bg-surface-2">
          <FileDown className="h-4 w-4" /> PDF
        </a>
        {isOwner && status !== "cancelled" ? <Button variant="danger" onClick={() => setPanel(panel === "cancel" ? "" : "cancel")}><Ban className="h-4 w-4" /> Cancel</Button> : null}
        <LinkButton href="/billing" variant="secondary"><ReceiptIndianRupee className="h-4 w-4" /> Next bill</LinkButton>
      </div>

      {panel === "pay" ? (
        <form className="grid w-full max-w-xl grid-cols-1 gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end"
          onSubmit={(e) => { e.preventDefault(); run(() => addPayment(invoiceId, Number(amount), mode, note)); }}>
          <Field label={`Amount (due ${rupees(due)})`}><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
          <Field label="Mode"><Select value={mode} onChange={(e) => setMode(e.target.value)}>{["Cash", "UPI", "Card", "Bank", "Cheque"].map((m) => <option key={m}>{m}</option>)}</Select></Field>
          <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="UPI ref, cheque no…" /></Field>
          <Button variant="primary" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        </form>
      ) : null}
      {panel === "cancel" ? (
        <form className="flex w-full max-w-xl flex-col gap-3 rounded-xl border border-bad/30 bg-bad-soft p-4"
          onSubmit={(e) => { e.preventDefault(); run(() => voidInvoice(invoiceId, note || "No reason given")); }}>
          <p className="text-sm font-medium text-bad">Cancel this invoice? All its parts go back into stock. This can&apos;t be undone.</p>
          <div className="flex gap-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason, e.g. wrong part billed" />
            <Button variant="danger" disabled={pending}>{pending ? "Cancelling…" : "Yes, cancel invoice"}</Button>
          </div>
        </form>
      ) : null}
      {error ? <Notice tone="bad">{error}</Notice> : null}
    </div>
  );
}

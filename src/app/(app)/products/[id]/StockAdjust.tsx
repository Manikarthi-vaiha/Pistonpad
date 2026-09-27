"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { adjustStock } from "../actions";

export function StockAdjust({ productId }: { productId: number }) {
  const router = useRouter();
  const [change, setChange] = useState("");
  const [reason, setReason] = useState<"purchase" | "adjust">("purchase");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="mt-5 flex flex-col gap-3 border-t border-line pt-5"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(change);
        start(async () => {
          const r = await adjustStock(productId, n, reason, note);
          if (r.ok) { setMsg({ tone: "good", text: `Stock ${n > 0 ? "added" : "removed"}.` }); setChange(""); setNote(""); router.refresh(); }
          else setMsg({ tone: "bad", text: r.error ?? "Could not update stock." });
        });
      }}
    >
      <p className="text-sm font-semibold">Quick stock change</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Add (+) or remove (−)"><Input inputMode="numeric" value={change} onChange={(e) => setChange(e.target.value.replace(/[^\d-]/g, ""))} placeholder="+10 or -2" /></Field>
        <Field label="Reason">
          <Select value={reason} onChange={(e) => setReason(e.target.value as "purchase" | "adjust")}>
            <option value="purchase">Received stock</option>
            <option value="adjust">Correction / damage</option>
          </Select>
        </Field>
      </div>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (supplier bill no., reason…)" />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Button variant="secondary" disabled={pending || !change}>{pending ? "Saving…" : "Update stock"}</Button>
      <p className="text-xs text-ink-3">For many parts from one supplier bill, use <a className="text-primary underline" href="/stock-in">Stock in</a>.</p>
    </form>
  );
}

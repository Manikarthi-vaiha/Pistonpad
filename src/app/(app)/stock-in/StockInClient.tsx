"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { PartPicker, type PickedPart } from "@/components/PartPicker";
import { DatePicker } from "@/components/DatePicker";
import { Button, Card, CardHeader, cx, Field, Input, inputClass, Notice } from "@/components/ui";
import { isoDate, rupees2 } from "@/lib/format";
import { savePurchase } from "./actions";

type Line = { part: PickedPart; qty: number; cost: number };

export function StockInClient({ suppliers, isOwner }: { suppliers: string[]; isOwner: boolean }) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [supplier, setSupplier] = useState("");
  const [billRef, setBillRef] = useState("");
  const [date, setDate] = useState(isoDate());
  const [updateCost, setUpdateCost] = useState(true);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const add = (p: PickedPart) => setLines((ls) => {
    const i = ls.findIndex((l) => l.part.id === p.id);
    if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
    return [...ls, { part: p, qty: 1, cost: p.cost_price }];
  });
  const total = lines.reduce((s, l) => s + l.qty * l.cost, 0);

  const save = () => start(async () => {
    setMsg(null);
    const r = await savePurchase({ supplier, billRef, date, updateCost, items: lines.map((l) => ({ productId: l.part.id, qty: l.qty, cost: l.cost })) });
    if (r.ok) {
      setMsg({ tone: "good", text: `Stock added for ${lines.length} part${lines.length === 1 ? "" : "s"} (${lines.reduce((s, l) => s + l.qty, 0)} units).` });
      setLines([]); setBillRef("");
      router.refresh();
    } else setMsg({ tone: "bad", text: r.error });
  });

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Card>
          <CardHeader title="Find parts" sub="Out-of-stock parts can be added here" />
          <div className="p-5"><PartPicker onPick={add} allowOutOfStock priceField={isOwner ? "cost_price" : "sale_price"} /></div>
        </Card>
        <Card>
          <CardHeader title={`Received items (${lines.length})`} />
          {lines.length ? (
            <div className="overflow-x-auto">
              <table className="num w-full min-w-[560px] text-sm">
                <thead><tr className="text-left text-[11.5px] tracking-wider text-ink-3 uppercase">
                  <th className="px-5 py-2.5 font-semibold">Part</th><th className="px-2 py-2.5 font-semibold">Now</th><th className="px-2 py-2.5 font-semibold">Qty received</th>
                  {isOwner ? <th className="px-2 py-2.5 font-semibold">Cost ₹</th> : null}<th className="w-10" />
                </tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.part.id} className="border-t border-line">
                      <td className="px-5 py-3"><p className="font-medium">{l.part.name}</p><p className="font-mono text-xs text-ink-3">{l.part.sku}</p></td>
                      <td className="px-2 py-3 text-ink-2">{l.part.stock}</td>
                      <td className="px-2 py-3"><input className={cx(inputClass, "h-9 w-24")} inputMode="numeric" value={l.qty}
                        onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, qty: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) } : x))} aria-label="Quantity received" /></td>
                      {isOwner ? <td className="px-2 py-3"><input className={cx(inputClass, "h-9 w-28")} inputMode="decimal" defaultValue={l.cost}
                        onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, cost: Number(e.target.value) || 0 } : x))} aria-label="Cost price" /></td> : null}
                      <td className="pr-3"><button onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-ink-3 hover:bg-bad-soft hover:text-bad" aria-label="Remove"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="px-5 py-10 text-center text-sm text-ink-2">Search above and press Enter to add each part from the supplier&apos;s bill.</p>}
        </Card>
      </div>
      <Card className="xl:sticky xl:top-6 xl:self-start">
        <CardHeader title="Supplier bill" />
        <div className="flex flex-col gap-4 p-5">
          <Field label="Supplier">
            <Input list="suppliers" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. Sundaram Auto Distributors" />
            <datalist id="suppliers">{suppliers.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bill no."><Input value={billRef} onChange={(e) => setBillRef(e.target.value)} /></Field>
            <div className="flex min-w-0 flex-col gap-1.5"><span className="text-[13px] font-medium text-ink-2">Date</span><DatePicker value={date} onChange={setDate} max={isoDate()} ariaLabel="Supplier bill date" /></div>
          </div>
          {isOwner ? (
            <>
              <label className="flex items-center gap-2 text-sm text-ink-2"><input type="checkbox" checked={updateCost} onChange={(e) => setUpdateCost(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" /> Update each part&apos;s cost price</label>
              <div className="flex items-end justify-between border-t border-line pt-3"><span className="text-sm text-ink-2">Bill value (before GST)</span><span className="num text-xl font-bold">{rupees2(total)}</span></div>
            </>
          ) : null}
          {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
          <Button variant="primary" size="lg" onClick={save} disabled={pending || !lines.length}>{pending ? "Saving…" : "Add to stock"}</Button>
        </div>
      </Card>
    </div>
  );
}

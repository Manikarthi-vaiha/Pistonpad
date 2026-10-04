"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Minus, Plus, Store, Trash2, UserRound, X } from "lucide-react";
import { PartPicker, type PartPickerHandle, type PickedPart } from "@/components/PartPicker";
import { Badge, Button, Card, CardHeader, cx, Field, Input, inputClass, Kbd, Notice } from "@/components/ui";
import { calcBill } from "@/lib/billing-calc";
import { GSTIN_RE, GST_STATES, rupees, rupees2 } from "@/lib/format";
import { saveBill } from "../invoices/actions";

type Source = "stock" | "outside";
type PriceType = "wholesale" | "showroom";
type Line = { key: string; part: PickedPart; qty: number; rate: number; discountPct: number; source: Source; outsideCost: number | null };

/** Selling rate for the chosen rate list; showroom falls back to wholesale when no showroom rate is set. */
const rateFor = (p: PickedPart, t: PriceType) => (t === "showroom" ? (p.retail_price ?? p.sale_price) : p.sale_price);
type Customer = { id?: number; name: string; phone: string; gstin: string; due?: number; limit?: number };
type CustomerHit = { id: number; name: string; phone: string | null; gstin: string; state_code: string; due: number; credit_limit: number };

const MODES = ["Cash", "UPI", "Card", "Bank"] as const;

export function BillingClient({ shopState }: { shopState: string }) {
  const router = useRouter();
  const picker = useRef<PartPickerHandle>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState<Customer>({ name: "", phone: "", gstin: "" });
  const [mode, setMode] = useState<(typeof MODES)[number]>("Cash");
  const [paidInput, setPaidInput] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [priceType, setPriceType] = useState<PriceType>("wholesale");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const gstState = customer.gstin.length >= 2 ? customer.gstin.slice(0, 2) : "";
  const [interstateOverride, setInterstateOverride] = useState<boolean | null>(null);
  const interstate = interstateOverride ?? (!!gstState && gstState !== shopState);

  const bill = useMemo(
    () => calcBill(lines.map((l) => ({ qty: l.qty, rate: l.rate, discountPct: l.discountPct, gstRate: l.part.gst_rate })), interstate),
    [lines, interstate],
  );
  const paid = paidInput === null ? bill.total : Number(paidInput) || 0;

  useEffect(() => {
    picker.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); picker.current?.focus(); }
      if (e.key === "F9") { e.preventDefault(); document.getElementById("save-bill")?.click(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const add = (p: PickedPart) => {
    setError("");
    setLines((ls) => {
      const i = ls.findIndex((l) => l.part.id === p.id);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
      // Out of stock → assume it's being fetched from a showroom / outside market for this sale.
      return [...ls, {
        key: `${p.id}-${Date.now()}`, part: p, qty: 1, rate: rateFor(p, priceType), discountPct: 0,
        source: p.stock > 0 ? "stock" : "outside", outsideCost: p.showroom_cost,
      }];
    });
  };
  const update = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));
  const switchPriceType = (t: PriceType) => {
    setPriceType(t);
    setLines((ls) => ls.map((l) => ({ ...l, rate: rateFor(l.part, t) })));
  };
  const reset = () => {
    setLines([]); setCustomer({ name: "", phone: "", gstin: "" }); setMode("Cash"); setPaidInput(null); setNotes(""); setError(""); setInterstateOverride(null);
    picker.current?.focus();
  };

  const overStock = lines.filter((l) => l.source === "stock" && l.qty > l.part.stock);
  const outsideMissingCost = lines.filter((l) => l.source === "outside" && !l.outsideCost);
  const gstinBad = customer.gstin.length > 0 && !GSTIN_RE.test(customer.gstin);

  const submit = () => {
    setError("");
    if (!lines.length) return setError("Add at least one part to the bill.");
    if (overStock.length) return setError(`Not enough stock for ${overStock.map((l) => l.part.name).join(", ")}. Lower the quantity, add stock, or mark it “Bought outside”.`);
    if (outsideMissingCost.length) return setError(`Enter what you paid outside for ${outsideMissingCost.map((l) => l.part.name).join(", ")}.`);
    if (gstinBad) return setError("The GSTIN doesn't look right. It should be 15 characters, like 33ABCDE1234F1Z5.");
    if (paid < bill.total) return setError(`Collect the full amount of ${rupees(bill.total)} before saving — bills can't be left on credit.`);
    start(async () => {
      const r = await saveBill({
        customer: { id: customer.id, name: customer.name.trim(), phone: customer.phone.trim(), gstin: customer.gstin.trim().toUpperCase() },
        items: lines.map((l) => ({
          productId: l.part.id, qty: l.qty, rate: l.rate, discountPct: l.discountPct,
          source: l.source, outsideCost: l.source === "outside" ? l.outsideCost ?? undefined : undefined,
        })),
        interstate,
        priceType,
        paymentMode: mode,
        amountPaid: bill.total,
        notes,
      });
      if (r.ok) router.push(`/invoices/${r.data.id}?new=1`);
      else setError(r.error);
    });
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Card>
          <CardHeader title="Add parts" sub="Search by part number, name, or pick the customer's bike" />
          <div className="p-5"><PartPicker ref={picker} onPick={add} allowOutOfStock priceField={priceType === "showroom" ? "retail_price" : "sale_price"} /></div>
        </Card>

        <Card>
          <CardHeader
            title={<span className="flex items-center gap-2">Bill items <Badge tone="primary">{lines.length}</Badge></span>}
            action={
              <div className="flex items-center gap-2">
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1" role="radiogroup" aria-label="Rate list">
                  {(["wholesale", "showroom"] as const).map((t) => (
                    <button key={t} role="radio" aria-checked={priceType === t} onClick={() => switchPriceType(t)}
                      className={cx("rounded-md px-3 py-1.5 text-[12.5px] font-semibold", priceType === t ? "bg-surface text-ink shadow-sm ring-1 ring-line-2" : "text-ink-2 hover:text-ink")}>
                      {t === "wholesale" ? "Wholesale rate" : "Showroom rate"}
                    </button>
                  ))}
                </div>
                {lines.length ? <Button size="sm" variant="ghost" onClick={() => setLines([])}>Clear</Button> : null}
              </div>
            }
          />
          {lines.length ? (
            <div className="overflow-x-auto">
              <table className="num w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-[11.5px] tracking-wider text-ink-3 uppercase">
                    <th className="px-5 py-2.5 font-semibold">Part</th>
                    <th className="px-2 py-2.5 text-center font-semibold">Qty</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Rate ₹</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Disc %</th>
                    <th className="px-2 py-2.5 text-right font-semibold">GST</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Amount</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const c = bill.lines[i];
                    const over = l.source === "stock" && l.qty > l.part.stock;
                    return (
                      <tr key={l.key} className="border-t border-line align-top">
                        <td className="px-5 py-3">
                          <p className="font-medium">{l.part.name}</p>
                          <p className="font-mono text-xs text-ink-3">{l.part.sku}{l.part.rack ? ` · Rack ${l.part.rack}` : ""}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <div className="inline-flex rounded-md border border-line-2 p-0.5 text-[11.5px] font-semibold" role="radiogroup" aria-label={`Source of ${l.part.name}`}>
                              {(["stock", "outside"] as const).map((src) => (
                                <button key={src} role="radio" aria-checked={l.source === src} onClick={() => update(l.key, { source: src })}
                                  className={cx("flex items-center gap-1 rounded px-2 py-1 whitespace-nowrap", l.source === src ? (src === "outside" ? "bg-warn-soft text-warn" : "bg-primary-soft text-primary") : "text-ink-3 hover:text-ink")}>
                                  {src === "outside" ? <Store className="h-3 w-3" /> : null}{src === "stock" ? `Stock (${l.part.stock})` : "Bought outside"}
                                </button>
                              ))}
                            </div>
                            {l.source === "outside" ? (
                              <label className="flex items-center gap-1.5 text-xs whitespace-nowrap text-ink-2">
                                Paid ₹
                                <input className={cx(inputClass, "h-7 w-20 px-2 text-right text-xs", !l.outsideCost && "border-bad")} inputMode="decimal"
                                  defaultValue={l.outsideCost ?? ""} placeholder="0" aria-label={`Price paid outside for ${l.part.name}`}
                                  onChange={(e) => update(l.key, { outsideCost: Number(e.target.value) > 0 ? Number(e.target.value) : null })} />
                                each
                              </label>
                            ) : null}
                          </div>
                          {over ? <p className="mt-1 flex items-center gap-1 text-xs font-medium text-bad"><AlertCircle className="h-3.5 w-3.5" /> Only {l.part.stock} in stock — or mark “Bought outside”</p> : null}
                        </td>
                        <td className="px-2 py-3">
                          <div className="mx-auto flex w-[118px] items-center rounded-lg border border-line-2">
                            <button className="grid h-9 w-9 place-items-center text-ink-2 hover:text-ink" onClick={() => update(l.key, { qty: Math.max(1, l.qty - 1) })} aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
                            <input className="h-9 w-10 min-w-0 flex-1 bg-transparent text-center font-semibold focus:outline-none" inputMode="numeric" value={l.qty}
                              onChange={(e) => update(l.key, { qty: Math.max(1, Math.floor(Number(e.target.value.replace(/\D/g, "")) || 1)) })} aria-label="Quantity" />
                            <button className="grid h-9 w-9 place-items-center text-ink-2 hover:text-ink" onClick={() => update(l.key, { qty: l.qty + 1 })} aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
                          </div>
                          <p className="mt-1 text-center text-[11px] text-ink-3">{l.part.unit}</p>
                        </td>
                        <td className="px-2 py-3">
                          <input key={priceType} className={cx(inputClass, "h-9 w-24 text-right")} inputMode="decimal" defaultValue={l.rate}
                            onChange={(e) => update(l.key, { rate: Math.max(0, Number(e.target.value) || 0) })} aria-label="Rate" />
                        </td>
                        <td className="px-2 py-3">
                          <input className={cx(inputClass, "h-9 w-16 text-right")} inputMode="decimal" defaultValue={l.discountPct || ""} placeholder="0"
                            onChange={(e) => update(l.key, { discountPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} aria-label="Discount percent" />
                        </td>
                        <td className="px-2 py-3 pt-5 text-right text-ink-2">{l.part.gst_rate}%</td>
                        <td className="px-5 py-3 pt-5 text-right font-semibold">{rupees2(c.total)}</td>
                        <td className="py-3 pt-4 pr-3">
                          <button onClick={() => remove(l.key)} className="rounded-md p-1.5 text-ink-3 hover:bg-bad-soft hover:text-bad" aria-label={`Remove ${l.part.name}`}><Trash2 className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center text-sm text-ink-2">
              No parts on this bill yet. Search above and press <Kbd>Enter</Kbd> to add.
            </div>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-5 xl:sticky xl:top-6 xl:self-start">
        <CustomerCard customer={customer} setCustomer={setCustomer} gstinBad={gstinBad} />

        <Card>
          <CardHeader title="Payment" />
          <div className="flex flex-col gap-4 p-5">
            <dl className="num grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
              <dt className="text-ink-2">Subtotal</dt><dd className="text-right">{rupees2(bill.subtotal)}</dd>
              {bill.discount ? <><dt className="text-ink-2">Discount</dt><dd className="text-right text-good">− {rupees2(bill.discount)}</dd></> : null}
              <dt className="text-ink-2">Taxable value</dt><dd className="text-right">{rupees2(bill.taxable)}</dd>
              {interstate ? (
                <><dt className="text-ink-2">IGST</dt><dd className="text-right">{rupees2(bill.igst)}</dd></>
              ) : (
                <><dt className="text-ink-2">CGST</dt><dd className="text-right">{rupees2(bill.cgst)}</dd><dt className="text-ink-2">SGST</dt><dd className="text-right">{rupees2(bill.sgst)}</dd></>
              )}
              <dt className="text-ink-3">Round off</dt><dd className="text-right text-ink-3">{rupees2(bill.roundOff)}</dd>
            </dl>
            <div className="flex items-end justify-between border-t-2 border-ink pt-3">
              <span className="text-sm font-semibold">Total</span>
              <span className="num text-[32px] leading-none font-bold tracking-tight">{rupees(bill.total)}</span>
            </div>

            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <input type="checkbox" checked={interstate} onChange={(e) => setInterstateOverride(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              Customer is in another state (charge IGST)
              {gstState && GST_STATES[gstState] ? <span className="text-ink-3">· {GST_STATES[gstState]}</span> : null}
            </label>

            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-2">Paid by</p>
              <div className="grid grid-cols-4 gap-1 rounded-lg bg-surface-2 p-1">
                {MODES.map((m) => (
                  <button key={m} onClick={() => { setMode(m); setPaidInput(null); }}
                    className={cx("rounded-md py-2 text-[13px] font-semibold transition-colors", mode === m ? "bg-surface text-ink shadow-sm ring-1 ring-line-2" : "text-ink-2 hover:text-ink")}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount received ₹">
                <Input inputMode="decimal" value={paidInput ?? String(paid)} onChange={(e) => setPaidInput(e.target.value.replace(/[^\d.]/g, ""))} />
              </Field>
              <div className="flex flex-col justify-end pb-2 text-right text-sm">
                {paid < bill.total ? (
                  <span className="font-semibold text-bad">Short by {rupees(bill.total - paid)}</span>
                ) : paid > bill.total ? (
                  <span className="font-semibold text-good">Return {rupees2(paid - bill.total)}</span>
                ) : <span className="text-ink-3">Fully paid</span>}
              </div>
            </div>
            <Field label="Note on bill (optional)">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Vehicle no., mechanic name…" />
            </Field>

            {error ? <Notice tone="bad">{error}</Notice> : null}
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Button variant="secondary" size="lg" onClick={reset} disabled={pending}>New</Button>
              <Button id="save-bill" variant="primary" size="lg" onClick={submit} disabled={pending || !lines.length}>
                {pending ? "Saving…" : <>Save bill <span className="ml-1 rounded bg-white/20 px-1.5 font-mono text-[11px]">F9</span></>}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function CustomerCard({ customer, setCustomer, gstinBad }: { customer: Customer; setCustomer: (c: Customer) => void; gstinBad: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [open, setOpen] = useState(false);

  const lookup = !customer.id && q.trim().length >= 2;
  const shownHits = lookup ? hits : [];
  useEffect(() => {
    if (!lookup) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/customers/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json()).then((d) => { setHits(d.rows ?? []); setOpen(true); }).catch(() => {});
    }, 180);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, lookup]);

  if (customer.id) {
    return (
      <Card>
        <CardHeader title="Customer" action={<Button size="sm" variant="ghost" onClick={() => { setCustomer({ name: "", phone: "", gstin: "" }); setQ(""); }}><X className="h-4 w-4" /> Change</Button>} />
        <div className="flex items-center gap-3 p-5">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary-soft text-primary"><UserRound className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{customer.name}</p>
            <p className="text-xs text-ink-3">{[customer.phone, customer.gstin].filter(Boolean).join(" · ") || "No phone saved"}</p>
          </div>
          {customer.due ? <Badge tone="warn">Owes {rupees(customer.due)}</Badge> : null}
        </div>
        {customer.limit && (customer.due ?? 0) > customer.limit ? (
          <div className="px-5 pb-5"><Notice tone="bad">Over the credit limit of {rupees(customer.limit)}. Collect payment before giving more credit.</Notice></div>
        ) : null}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Customer" sub="Leave empty for a walk-in cash sale" />
      <div className="flex flex-col gap-3 p-5">
        <div className="relative">
          <Field label="Name or phone">
            <Input
              value={customer.name}
              onChange={(e) => { setCustomer({ ...customer, name: e.target.value }); setQ(e.target.value); }}
              onFocus={() => shownHits.length && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Search saved customers or type a new name"
            />
          </Field>
          {open && shownHits.length ? (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
              {shownHits.map((h) => (
                <li key={h.id}>
                  <button className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-primary-soft"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setCustomer({ id: h.id, name: h.name, phone: h.phone ?? "", gstin: h.gstin, due: h.due, limit: h.credit_limit }); setOpen(false); }}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{h.name}</span>
                      <span className="text-xs text-ink-3">{h.phone || "No phone"}{h.gstin ? ` · ${h.gstin}` : ""}</span>
                    </span>
                    {h.due > 0 ? <Badge tone="warn">Owes {rupees(h.due)}</Badge> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <Input inputMode="tel" value={customer.phone} onChange={(e) => { setCustomer({ ...customer, phone: e.target.value }); setQ(e.target.value); }} />
          </Field>
          <Field label="GSTIN" error={gstinBad ? "Check the GSTIN" : undefined}>
            <Input className="font-mono uppercase" maxLength={15} value={customer.gstin} onChange={(e) => setCustomer({ ...customer, gstin: e.target.value.toUpperCase() })} />
          </Field>
        </div>
      </div>
    </Card>
  );
}

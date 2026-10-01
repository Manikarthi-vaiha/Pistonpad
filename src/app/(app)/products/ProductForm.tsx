"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button, Card, CardHeader, cx, Field, Input, Notice, Select } from "@/components/ui";
import type { Catalog } from "@/lib/products";
import { saveProduct, type FormState } from "./actions";

export type ProductFormValues = {
  id?: number; sku: string; name: string; brand_id: number | null; category_id: number | null; hsn: string; unit: string;
  cost_price: number; showroom_cost: number | null; sale_price: number; retail_price: number | null; mrp: number | null; gst_rate: number; reorder_level: number; rack: string;
  model_ids: number[]; active: boolean;
};

const UNITS = ["pcs", "set", "pair", "kit", "box", "litre", "metre"];

export function ProductForm({ catalog, initial, isOwner }: { catalog: Catalog; initial?: ProductFormValues; isOwner: boolean }) {
  const router = useRouter();
  const isNew = !initial?.id;
  const [state, action, pending] = useActionState<FormState, FormData>(saveProduct.bind(null, initial?.id ?? null), {});
  const [brandId, setBrandId] = useState(initial?.brand_id ? String(initial.brand_id) : "");
  const [picked, setPicked] = useState<Set<number>>(new Set(initial?.model_ids ?? []));
  const [filter, setFilter] = useState("");
  const [cost, setCost] = useState(String(initial?.cost_price ?? ""));
  const [price, setPrice] = useState(String(initial?.sale_price ?? ""));
  const [showroomCost, setShowroomCost] = useState(initial?.showroom_cost != null ? String(initial.showroom_cost) : "");
  const [retail, setRetail] = useState(initial?.retail_price != null ? String(initial.retail_price) : "");

  useEffect(() => {
    if (state.ok && state.id) router.push(`/products/${state.id}?saved=1`);
  }, [state, router]);

  const brand = catalog.brands.find((b) => String(b.id) === brandId);
  const brandModels = useMemo(() => catalog.models.filter((m) => String(m.brand_id) === brandId), [catalog, brandId]);
  const shown = brandModels.filter((m) => m.name.toLowerCase().includes(filter.toLowerCase()));
  const otherPicked = catalog.models.filter((m) => picked.has(m.id) && String(m.brand_id) !== brandId);
  const marginOf = (sell: string, buy: string) => (Number(sell) && Number(buy) ? `${(((Number(sell) - Number(buy)) / Number(sell)) * 100).toFixed(1)}%` : null);
  const margin = marginOf(price, cost);

  const toggle = (id: number) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <form action={action} className="flex flex-col gap-5">
      {[...picked].map((id) => <input key={id} type="hidden" name="modelIds" value={id} />)}
      <Card>
        <CardHeader title="Part details" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Part number"><Input name="sku" defaultValue={initial?.sku} required className="font-mono" autoFocus={isNew} /></Field>
          <Field label="Part name" className="sm:col-span-2 lg:col-span-3"><Input name="name" defaultValue={initial?.name} required placeholder="e.g. Clutch plate set – Bajaj Pulsar 150" /></Field>
          <Field label="Bike brand">
            <Select name="brandId" value={brandId} onChange={(e) => { setBrandId(e.target.value); setFilter(""); }} required>
              <option value="">Choose brand…</option>
              {catalog.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Category">
            <Select name="categoryId" defaultValue={initial?.category_id ?? ""}>
              <option value="">—</option>
              {catalog.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="HSN code"><Input name="hsn" defaultValue={initial?.hsn ?? "8714"} className="font-mono" /></Field>
          <Field label="Rack / bin"><Input name="rack" defaultValue={initial?.rack} placeholder="R12-B" /></Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Fits bike models"
          sub={brand?.is_universal ? "Universal parts show up for every bike." : brand ? `${picked.size} model${picked.size === 1 ? "" : "s"} selected` : "Choose a brand to see its models."}
          action={brandModels.length ? (
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => setPicked((s) => new Set([...s, ...shown.map((m) => m.id)]))}>Select all</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPicked((s) => new Set([...s].filter((id) => !brandModels.some((m) => m.id === id))))}>Clear</Button>
            </div>
          ) : null}
        />
        <div className="p-5">
          {brandModels.length > 12 ? <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Filter ${brand?.name} models…`} className="mb-4 max-w-xs" /> : null}
          {brand && !brand.is_universal ? (
            shown.length ? (
              <div className="flex flex-wrap gap-2">
                {shown.map((m) => {
                  const on = picked.has(m.id);
                  return (
                    <button key={m.id} type="button" onClick={() => toggle(m.id)} aria-pressed={on}
                      className={cx("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                        on ? "border-primary bg-primary text-primary-ink" : "border-line-2 bg-surface text-ink-2 hover:border-ink-3 hover:text-ink")}>
                      {on ? <Check className="h-3.5 w-3.5" /> : null}{m.name}
                    </button>
                  );
                })}
              </div>
            ) : <p className="text-sm text-ink-3">No models match. Add models in Settings → Brands &amp; models.</p>
          ) : null}
          {otherPicked.length ? (
            <p className="mt-4 text-[13px] text-ink-2">Also fits: {otherPicked.map((m) => `${catalog.brands.find((b) => b.id === m.brand_id)?.name} ${m.name}`).join(", ")}</p>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="Price, tax and stock" sub="All prices before GST" />
        <div className="grid grid-cols-1 gap-6 p-5 2xl:grid-cols-[2fr_3fr]">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">Buying prices</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {isOwner ? (
                <Field label="Cost price ₹" hint="From your regular supplier"><Input name="costPrice" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
              ) : <input type="hidden" name="costPrice" value={cost} />}
              <Field label="Showroom cost ₹" hint="When you buy it from a showroom / outside market">
                <Input name="showroomCost" inputMode="decimal" value={showroomCost} onChange={(e) => setShowroomCost(e.target.value)} placeholder="Optional" />
              </Field>
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">Selling prices</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Wholesale rate ₹" hint={isOwner && margin ? `Mechanics & dealers · margin ${margin}` : "Mechanics & dealers"}>
                <Input name="salePrice" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
              </Field>
              <Field label="Showroom rate ₹" hint={isOwner && marginOf(retail, cost) ? `Walk-in customers · margin ${marginOf(retail, cost)}` : "Walk-in customers"}>
                <Input name="retailPrice" inputMode="decimal" value={retail} onChange={(e) => setRetail(e.target.value)} placeholder={price || "Optional"} />
              </Field>
              <Field label="MRP ₹" hint="Optional"><Input name="mrp" inputMode="decimal" defaultValue={initial?.mrp ?? ""} /></Field>
            </div>
          </fieldset>
        </div>
        {Number(showroomCost) && (Number(retail) || Number(price)) ? (
          <p className="mx-5 -mt-2 mb-4 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-ink-2">
            Bought outside at {showroomCost} and sold at the showroom rate {retail || price}: profit ₹{(Number(retail || price) - Number(showroomCost)).toFixed(2)} each
            {Number(retail || price) < Number(showroomCost) ? <span className="font-semibold text-bad"> (a loss)</span> : null}.
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-4 border-t border-line p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="GST rate">
            <Select name="gstRate" defaultValue={initial?.gst_rate ?? 18}>
              {[0, 5, 12, 18, 28].map((g) => <option key={g} value={g}>{g}%</option>)}
            </Select>
          </Field>
          <Field label="Unit">
            <Select name="unit" defaultValue={initial?.unit ?? "pcs"}>{UNITS.map((u) => <option key={u}>{u}</option>)}</Select>
          </Field>
          {isNew ? <Field label="Opening stock"><Input name="openingStock" inputMode="numeric" defaultValue="0" /></Field> : null}
          <Field label="Reorder when stock is at or below"><Input name="reorderLevel" inputMode="numeric" defaultValue={initial?.reorder_level ?? 5} /></Field>
          {!isNew ? (
            <Field label="Status">
              <Select name="active" defaultValue={initial?.active === false ? "off" : "on"}>
                <option value="on">Active — can be billed</option>
                <option value="off">Disabled — hidden from billing</option>
              </Select>
            </Field>
          ) : null}
        </div>
        {isOwner && Number(price) < Number(cost) ? (
          <label className="mx-5 mb-5 flex items-center gap-2 text-sm text-warn">
            <input type="checkbox" name="confirmLoss" value="yes" className="h-4 w-4" /> Sell below cost (wholesale rate is lower than cost price)
          </label>
        ) : null}
      </Card>

      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button variant="primary" disabled={pending}>{pending ? "Saving…" : isNew ? "Add part" : "Save changes"}</Button>
      </div>
    </form>
  );
}

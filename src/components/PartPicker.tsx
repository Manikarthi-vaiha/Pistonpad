"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, Loader2, Plus, Search, X } from "lucide-react";
import { useCatalog } from "./useCatalog";
import { Badge, cx, inputClass, Kbd, StockBadge } from "./ui";
import { rupees2 } from "@/lib/format";

export type PickedPart = {
  id: number; sku: string; name: string; brand: string | null; unit: string; hsn: string;
  sale_price: number; retail_price: number | null; cost_price: number; showroom_cost: number | null; gst_rate: number; stock: number; reorder_level: number;
  rack: string; fits: string[]; fits_count: number; is_universal: boolean;
};

export type PartPickerHandle = { focus: () => void };

/**
 * Search box + "customer's bike" filter + keyboard-navigable results.
 * ↑/↓ to move, Enter to pick, Esc to clear.
 */
export const PartPicker = forwardRef<PartPickerHandle, { onPick: (p: PickedPart) => void; allowOutOfStock?: boolean; priceField?: "sale_price" | "retail_price" | "cost_price" }>(
  function PartPicker({ onPick, allowOutOfStock, priceField = "sale_price" }, ref) {
    const catalog = useCatalog();
    const [q, setQ] = useState("");
    const [brandId, setBrandId] = useState("");
    const [modelId, setModelId] = useState("");
    const [results, setRows] = useState<PickedPart[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchError, setError] = useState("");
    const [active, setActive] = useState(0);
    const router = useRouter();
    const input = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));

    const models = useMemo(() => (catalog?.models ?? []).filter((m) => String(m.brand_id) === brandId), [catalog, brandId]);
    const bikeLabel = useMemo(() => {
      const b = catalog?.brands.find((x) => String(x.id) === brandId);
      const m = catalog?.models.find((x) => String(x.id) === modelId);
      return m && b ? `${b.name} ${m.name}` : "";
    }, [catalog, brandId, modelId]);
    const searching = q.trim().length > 0 || !!modelId;

    useEffect(() => {
      if (!searching) return;
      const ctrl = new AbortController();
      const t = setTimeout(async () => {
        setLoading(true);
        try {
          const params = new URLSearchParams({ q: q.trim(), limit: "25" });
          if (modelId) params.set("model", modelId);
          else if (brandId) params.set("brand", brandId);
          const r = await fetch(`/api/products/search?${params}`, { signal: ctrl.signal });
          if (r.status === 401) { router.push("/login"); return; }
          const d = await r.json();
          setRows(d.rows ?? []);
          setActive(0);
          setError("");
        } catch (e) {
          if ((e as Error).name !== "AbortError") setError("Search failed. Check the connection and try again.");
        } finally {
          if (!ctrl.signal.aborted) setLoading(false);
        }
      }, 140);
      return () => { clearTimeout(t); ctrl.abort(); };
    }, [q, brandId, modelId, searching, router]);
    const rows = searching ? results : [];
    const error = searching ? searchError : "";

    useEffect(() => {
      listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
    }, [active]);

    const pick = (p: PickedPart) => {
      if (!allowOutOfStock && p.stock <= 0) return;
      onPick(p);
      setQ("");
      input.current?.focus();
    };

    const onKey = (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, rows.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); if (rows[active]) pick(rows[active]); }
      else if (e.key === "Escape") { setQ(""); }
    };

    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_minmax(0,1fr)]">
          <select aria-label="Bike brand" className={inputClass} value={brandId} onChange={(e) => { setBrandId(e.target.value); setModelId(""); }}>
            <option value="">All brands</option>
            {catalog?.brands.filter((b) => !b.is_universal).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select aria-label="Bike model" className={inputClass} value={modelId} disabled={!brandId} onChange={(e) => setModelId(e.target.value)}>
            <option value="">{brandId ? "Any model — pick the customer's bike" : "Pick a brand to choose the bike model"}</option>
            {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-ink-3" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={bikeLabel ? `Search parts for ${bikeLabel}…` : "Search part no. or name — e.g. “clutch plate pulsar”"}
            className={cx(inputClass, "h-12 pl-11 pr-24 text-[15px]")}
            autoComplete="off"
            aria-label="Search parts"
          />
          <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-ink-3" /> : null}
            {q ? (
              <button onClick={() => { setQ(""); input.current?.focus(); }} className="rounded p-1 text-ink-3 hover:text-ink" aria-label="Clear search"><X className="h-4 w-4" /></button>
            ) : <Kbd>F2</Kbd>}
          </div>
        </div>
        {bikeLabel ? (
          <div className="flex items-center gap-2 text-[13px] text-ink-2">
            <Bike className="h-4 w-4 text-primary" /> Showing parts that fit <b className="text-ink">{bikeLabel}</b>, plus universal parts
            <button className="ml-1 text-primary hover:underline" onClick={() => { setBrandId(""); setModelId(""); }}>Clear bike</button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-bad">{error}</p> : null}
        {searching && !loading && !rows.length && !error ? (
          <p className="rounded-lg border border-dashed border-line-2 px-4 py-6 text-center text-sm text-ink-2">
            No parts found{q ? <> for “{q}”</> : null}{bikeLabel ? <> that fit {bikeLabel}</> : null}. Try fewer words or a part number.
          </p>
        ) : null}

        {rows.length ? (
          <ul ref={listRef} className="max-h-[420px] overflow-y-auto rounded-xl border border-line" role="listbox" aria-label="Search results">
            {rows.map((p, i) => {
              const disabled = !allowOutOfStock && p.stock <= 0;
              return (
                <li
                  key={p.id}
                  data-i={i}
                  role="option"
                  aria-selected={i === active}
                  aria-disabled={disabled}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(p)}
                  className={cx(
                    "grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]",
                    i === active ? "bg-primary-soft" : "bg-surface",
                    disabled && "cursor-not-allowed opacity-55",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12.5px] font-semibold text-primary">{p.sku}</span>
                      {p.brand ? <Badge tone={p.is_universal ? "info" : "neutral"}>{p.brand}</Badge> : null}
                      {p.rack ? <span className="text-xs text-ink-3">Rack {p.rack}</span> : null}
                    </div>
                    <p className="truncate text-[14px] font-medium text-ink">{p.name}</p>
                    {p.fits.length ? (
                      <p className="truncate text-xs text-ink-3">
                        Fits {p.fits.join(", ")}{p.fits_count > p.fits.length ? ` +${p.fits_count - p.fits.length} more` : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="hidden sm:block"><StockBadge stock={p.stock} reorder={p.reorder_level} /></div>
                  <p className="num text-right text-[15px] font-semibold">{rupees2(p[priceField] ?? p.sale_price)}<span className="block text-[11px] font-normal text-ink-3">+{p.gst_rate}% GST</span></p>
                  <span className={cx("hidden h-8 w-8 place-items-center rounded-lg sm:grid", i === active ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink-3")}>
                    <Plus className="h-4 w-4" />
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
        {!searching ? (
          <p className="text-[13px] text-ink-3">
            Type to search, or pick the customer&apos;s bike to list every part that fits it. <Kbd>↑</Kbd> <Kbd>↓</Kbd> to move, <Kbd>Enter</Kbd> to add.
          </p>
        ) : null}
      </div>
    );
  },
);

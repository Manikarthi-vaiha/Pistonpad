"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui";
import type { Catalog } from "@/lib/products";

export function ProductFilters({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp);
    next.delete("after");
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    start(() => router.replace(`${path}?${next}`));
  };

  useEffect(() => {
    if (q === (sp.get("q") ?? "")) return;
    const t = setTimeout(() => set({ q }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const brand = sp.get("brand") ?? "";
  const models = useMemo(() => catalog.models.filter((m) => String(m.brand_id) === brand), [catalog, brand]);
  const any = ["q", "brand", "model", "category", "stock", "show"].some((k) => sp.get(k));

  return (
    <div className="grid grid-cols-1 gap-3 border-b border-line p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_140px_180px_160px_140px_150px_auto]">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Part no. or name — e.g. “piston kit splendor”" className="pr-9 pl-9" aria-label="Search parts" />
        {pending ? <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-ink-3" /> : null}
      </div>
      <Select value={brand} onChange={(e) => set({ brand: e.target.value, model: "" })} aria-label="Brand">
        <option value="">All brands</option>
        {catalog.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </Select>
      <Select value={sp.get("model") ?? ""} onChange={(e) => set({ model: e.target.value })} disabled={!models.length} aria-label="Bike model">
        <option value="">{brand ? "All models" : "Choose brand first"}</option>
        {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </Select>
      <Select value={sp.get("category") ?? ""} onChange={(e) => set({ category: e.target.value })} aria-label="Category">
        <option value="">All categories</option>
        {catalog.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      <Select value={sp.get("show") ?? ""} onChange={(e) => set({ show: e.target.value })} aria-label="Show active or disabled parts">
        <option value="">Active parts</option>
        <option value="disabled">Disabled parts</option>
        <option value="all">All parts</option>
      </Select>
      <Select value={sp.get("stock") ?? ""} onChange={(e) => set({ stock: e.target.value })} aria-label="Stock level">
        <option value="">Any stock</option>
        <option value="in">In stock</option>
        <option value="low">Low / reorder</option>
        <option value="out">Out of stock</option>
      </Select>
      {any ? (
        <button onClick={() => { setQ(""); start(() => router.replace(path)); }} className="flex h-10 items-center justify-center gap-1 rounded-lg px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2">
          <X className="h-4 w-4" /> Clear
        </button>
      ) : <span className="hidden xl:block" />}
    </div>
  );
}

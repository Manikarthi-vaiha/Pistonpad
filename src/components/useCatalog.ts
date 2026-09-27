"use client";

import { useEffect, useState } from "react";

export type CatalogData = {
  brands: { id: number; name: string; is_universal: boolean }[];
  models: { id: number; brand_id: number; name: string }[];
  categories: { id: number; name: string }[];
};

let cached: Promise<CatalogData> | null = null;

/** Brands, bike models and categories — loaded once per page session. */
export function useCatalog() {
  const [data, setData] = useState<CatalogData | null>(null);
  useEffect(() => {
    cached ??= fetch("/api/catalog").then((r) => {
      if (!r.ok) throw new Error("catalog");
      return r.json();
    });
    let live = true;
    cached.then((d) => live && setData(d)).catch(() => { cached = null; });
    return () => { live = false; };
  }, []);
  return data;
}

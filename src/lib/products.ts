import "server-only";
import { sql } from "./db";

export type ProductRow = {
  id: number;
  sku: string;
  name: string;
  brand: string | null;
  brand_id: number | null;
  category: string | null;
  unit: string;
  hsn: string;
  cost_price: number;
  showroom_cost: number | null;
  sale_price: number;
  retail_price: number | null;
  mrp: number | null;
  gst_rate: number;
  stock: number;
  reorder_level: number;
  rack: string;
  active: boolean;
  is_universal: boolean;
  fits: string[];
  fits_count: number;
};

export type ProductFilter = {
  q?: string;
  brandId?: number;
  modelId?: number;
  categoryId?: number;
  stock?: "low" | "out" | "in";
  includeInactive?: boolean;
  onlyInactive?: boolean; // disabled parts only
  after?: number; // keyset cursor: last id of previous page
  limit?: number;
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);

/**
 * Fast search over millions of parts.
 * - Every word must appear in "part no + name" (trigram GIN index on products.search).
 * - Brand / category / model filters use their own indexes.
 * - Keyset pagination (id < cursor) instead of OFFSET, so page 1,000 is as fast as page 1.
 */
export async function searchProducts(f: ProductFilter) {
  const limit = Math.min(Math.max(f.limit ?? 50, 1), 200);
  const words = (f.q ?? "").toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0, 6);

  const conds = [sql`true`];
  for (const w of words) conds.push(sql`p.search like ${"%" + escapeLike(w) + "%"}`);
  if (f.onlyInactive) conds.push(sql`not p.active`);
  else if (!f.includeInactive) conds.push(sql`p.active`);
  if (f.brandId) conds.push(sql`p.brand_id = ${f.brandId}`);
  if (f.categoryId) conds.push(sql`p.category_id = ${f.categoryId}`);
  if (f.modelId)
    conds.push(sql`(exists (select 1 from product_models pm where pm.model_id = ${f.modelId} and pm.product_id = p.id)
                   or p.brand_id in (select id from brands where is_universal))`);
  if (f.stock === "out") conds.push(sql`p.stock <= 0`);
  if (f.stock === "low") conds.push(sql`p.stock <= p.reorder_level`);
  if (f.stock === "in") conds.push(sql`p.stock > 0`);
  if (f.after) conds.push(sql`p.id < ${f.after}`);
  const where = conds.reduce((a, c) => sql`${a} and ${c}`);

  // Exact part-number hit goes to the top of the first page.
  const exact =
    words.length === 1 && !f.after
      ? await sql<{ id: number }[]>`select id from products p where lower(sku) = ${words[0]} and ${where} limit 1`
      : [];

  const rows = await sql<ProductRow[]>`
    select p.id, p.sku, p.name, b.name::text as brand, p.brand_id, c.name::text as category, p.unit, p.hsn,
           p.cost_price, p.showroom_cost, p.sale_price, p.retail_price, p.mrp, p.gst_rate, p.stock, p.reorder_level, p.rack, p.active,
           coalesce(b.is_universal, false) as is_universal,
           coalesce(f.fits, '{}') as fits, coalesce(f.n, 0)::int as fits_count
    from (
      select p.id from products p where ${where}
      order by p.id desc limit ${limit + 1}
    ) page
    join products p on p.id = page.id
    left join brands b on b.id = p.brand_id
    left join categories c on c.id = p.category_id
    left join lateral (
      select (array_agg(m.name order by m.name))[1:4] as fits, count(*) as n
      from product_models pm join bike_models m on m.id = pm.model_id
      where pm.product_id = p.id
    ) f on true
    order by (p.id = any(${exact.map((e) => e.id)}::bigint[])) desc, p.id desc`;

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  if (exact.length && !page.some((r) => r.id === exact[0].id)) {
    const [hit] = await sql<ProductRow[]>`
      select p.id, p.sku, p.name, b.name::text as brand, p.brand_id, c.name::text as category, p.unit, p.hsn,
             p.cost_price, p.showroom_cost, p.sale_price, p.retail_price, p.mrp, p.gst_rate, p.stock, p.reorder_level, p.rack, p.active,
             coalesce(b.is_universal, false) as is_universal, '{}'::text[] as fits, 0 as fits_count
      from products p left join brands b on b.id = p.brand_id left join categories c on c.id = p.category_id
      where p.id = ${exact[0].id}`;
    if (hit) page.unshift(hit);
  }
  return { rows: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}

/** Fast approximate row count from planner statistics (exact count(*) on millions of rows is slow). */
export async function estimatedProductCount() {
  const [r] = await sql<{ n: number }[]>`select greatest(reltuples, 0)::bigint as n from pg_class where oid = 'products'::regclass`;
  if (r && r.n > 0) return r.n;
  const [c] = await sql<{ n: number }[]>`select count(*)::bigint as n from products`;
  return c.n;
}

export async function getProduct(id: number) {
  const [p] = await sql<(ProductRow & { category_id: number | null; model_ids: number[]; created_at: Date })[]>`
    select p.*, b.name::text as brand, c.name::text as category, coalesce(b.is_universal, false) as is_universal,
           coalesce((select array_agg(model_id) from product_models where product_id = p.id), '{}') as model_ids
    from products p left join brands b on b.id = p.brand_id left join categories c on c.id = p.category_id
    where p.id = ${id}`;
  return p ?? null;
}

export async function getCatalog() {
  const brands = await sql<{ id: number; name: string; is_universal: boolean }[]>`
    select id, name::text as name, is_universal from brands order by sort_order, name`;
  const models = await sql<{ id: number; brand_id: number; name: string }[]>`
    select id, brand_id, name from bike_models where active order by brand_id, name`;
  const categories = await sql<{ id: number; name: string }[]>`select id, name::text as name from categories order by name`;
  return { brands, models, categories };
}
export type Catalog = Awaited<ReturnType<typeof getCatalog>>;

/* ---------- Part number suggestions ---------- */

const CATEGORY_CODES: Record<string, string> = {
  engine: "ENG", brakes: "BRK", clutch: "CLU", transmission: "TRN", electricals: "ELE", lights: "LGT",
  suspension: "SUS", cables: "CBL", "body parts": "BDY", filters: "FLT", "tyres & tubes": "TYR",
  bearings: "BRG", fasteners: "FST", wheels: "WHL", "fuel system": "FUE",
};

/** Brand code: initials for multi-word names (Royal Enfield → RE), else first two letters (Hero → HE). */
export function brandCode(name: string) {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  if (!words.length) return "PT";
  return words.length > 1 ? words.map((w) => w[0]).join("").slice(0, 3) : words[0].slice(0, 2);
}

export function categoryCode(name: string | null | undefined) {
  if (!name) return "GEN";
  return CATEGORY_CODES[name.toLowerCase()] ?? (name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "GEN");
}

/** Next free part number like HE-BRK-0004 for a brand + category. Uses the sku prefix index. */
export async function suggestSku(brandId: number, categoryId: number | null) {
  const [[b], [c]] = await Promise.all([
    sql<{ name: string }[]>`select name::text as name from brands where id = ${brandId}`,
    categoryId ? sql<{ name: string }[]>`select name::text as name from categories where id = ${categoryId}` : Promise.resolve([undefined]),
  ]);
  if (!b) return null;
  const prefix = `${brandCode(b.name)}-${categoryCode(c?.name)}-`;
  const like = prefix.toLowerCase().replace(/[\\%_]/g, "\\$&") + "%";
  const [{ n }] = await sql<{ n: number | null }[]>`
    select max(substring(sku from ${prefix.length + 1}::int)::int) as n
    from products where lower(sku) like ${like} and substring(sku from ${prefix.length + 1}::int) ~ '^[0-9]{1,9}$'`;
  return `${prefix}${String((n ?? 0) + 1).padStart(4, "0")}`;
}

export async function findBySku(sku: string) {
  const [p] = await sql<{ id: number; name: string }[]>`select id, name from products where lower(sku) = ${sku.trim().toLowerCase()} limit 1`;
  return p ?? null;
}

/**
 * Bulk product import, shared by the web upload and `npm run import -- file.csv`.
 * Rows are upserted by part number in batches of 2,000 inside short transactions,
 * so millions of rows import without holding locks or memory for long.
 */
import type { Sql } from "postgres";
import { CsvParser } from "./csv";

export const IMPORT_COLUMNS = ["sku", "name", "brand", "category", "models", "hsn", "unit", "cost_price", "showroom_cost", "sale_price", "retail_price", "mrp", "gst_rate", "stock", "reorder_level", "rack"] as const;
export const IMPORT_TEMPLATE =
  IMPORT_COLUMNS.join(",") + "\n" +
  `HR-BS-001,Brake shoe set,Hero,Brakes,Splendor Plus|Passion Pro|HF Deluxe,8714,set,95,130,125,145,160,18,40,10,R4-B\n` +
  `TV-VB-010,Drive belt,TVS,Transmission,Jupiter|Jupiter 110|Wego,8714,pcs,480,560,590,650,720,18,12,5,R9-A\n` +
  `UN-HRN-12,Horn 12V,Universal,Electricals,,8714,pcs,85,,120,140,150,18,100,20,U1\n`;

export type ImportStats = { rows: number; inserted: number; updated: number; skipped: number; errors: string[] };
type Row = Record<(typeof IMPORT_COLUMNS)[number], string>;

const BATCH = 2000;
const num = (v: string) => { const n = Number(String(v).replace(/[₹,\s]/g, "")); return Number.isFinite(n) ? n : null; };

export async function importProductsCsv(sql: Sql<Record<string, unknown>>, chunks: AsyncIterable<string>, userId: number | null, onProgress?: (s: ImportStats) => void) {
  const stats: ImportStats = { rows: 0, inserted: 0, updated: 0, skipped: 0, errors: [] };
  const err = (m: string) => { if (stats.errors.length < 50) stats.errors.push(m); };

  const brands = new Map<string, number>();
  for (const b of await sql<{ id: number; name: string }[]>`select id, lower(name::text) as name from brands`) brands.set(b.name, b.id);
  const cats = new Map<string, number>();
  for (const c of await sql<{ id: number; name: string }[]>`select id, lower(name::text) as name from categories`) cats.set(c.name, c.id);
  const models = new Map<string, number>();
  for (const m of await sql<{ id: number; brand_id: number; name: string }[]>`select id, brand_id, lower(name) as name from bike_models`) models.set(`${m.brand_id}|${m.name}`, m.id);

  const brandId = async (name: string) => {
    const k = name.trim().toLowerCase();
    if (!k) return null;
    if (!brands.has(k)) {
      const [b] = await sql<{ id: number }[]>`insert into brands (name) values (${name.trim()}) on conflict (name) do update set name = excluded.name returning id`;
      brands.set(k, b.id);
    }
    return brands.get(k)!;
  };
  const catId = async (name: string) => {
    const k = name.trim().toLowerCase();
    if (!k) return null;
    if (!cats.has(k)) {
      const [c] = await sql<{ id: number }[]>`insert into categories (name) values (${name.trim()}) on conflict (name) do update set name = excluded.name returning id`;
      cats.set(k, c.id);
    }
    return cats.get(k)!;
  };
  const modelId = async (bid: number, name: string) => {
    const k = `${bid}|${name.trim().toLowerCase()}`;
    if (!models.has(k)) {
      const [m] = await sql<{ id: number }[]>`insert into bike_models (brand_id, name) values (${bid}, ${name.trim()}) on conflict (brand_id, name) do update set active = true returning id`;
      models.set(k, m.id);
    }
    return models.get(k)!;
  };

  let header: string[] | null = null;
  let pending: Row[] = [];

  const flush = async (rows: Row[]) => {
    if (!rows.length) return;
    const prepared: { values: Record<string, unknown>; stock: number | null; modelIds: number[] }[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const sku = r.sku?.trim();
      const name = r.name?.trim();
      if (!sku || !name) { stats.skipped++; continue; }
      const key = sku.toLowerCase();
      if (seen.has(key)) { stats.skipped++; err(`Part no. ${sku} appears twice in one batch — kept the first.`); continue; }
      seen.add(key);
      const bid = await brandId(r.brand ?? "");
      const gst = num(r.gst_rate ?? "") ?? 18;
      if (![0, 5, 12, 18, 28].includes(gst)) { stats.skipped++; err(`${sku}: GST rate ${r.gst_rate} is not 0, 5, 12, 18 or 28.`); continue; }
      const mids: number[] = [];
      if (bid && r.models?.trim()) for (const m of r.models.split(/[|;]/)) if (m.trim()) mids.push(await modelId(bid, m));
      prepared.push({
        values: {
          sku, name, brand_id: bid, category_id: await catId(r.category ?? ""),
          hsn: r.hsn?.trim() || "8714", unit: r.unit?.trim() || "pcs",
          cost_price: num(r.cost_price ?? "") ?? 0, sale_price: num(r.sale_price ?? "") ?? 0, mrp: num(r.mrp ?? ""),
          showroom_cost: num(r.showroom_cost ?? ""), retail_price: num(r.retail_price ?? ""),
          gst_rate: gst, reorder_level: Math.max(0, Math.round(num(r.reorder_level ?? "") ?? 0)), rack: r.rack?.trim() ?? "",
        },
        stock: r.stock?.trim() ? Math.round(num(r.stock) ?? 0) : null,
        modelIds: mids,
      });
    }
    if (!prepared.length) return;

    await sql.begin(async (tx) => {
      const keys = prepared.map((p) => String(p.values.sku).toLowerCase());
      const before = new Map((await tx<{ k: string; stock: number }[]>`select lower(sku) as k, stock from products where lower(sku) = any(${keys})`).map((r) => [r.k, r.stock]));
      // Rows with a stock value set it; rows with the stock cell left empty keep today's stock.
      const upsert = (group: typeof prepared, setStock: boolean) =>
        group.length
          ? tx<{ id: number; k: string; stock: number; inserted: boolean }[]>`
              insert into products ${tx(group.map((p) => ({ ...p.values, stock: p.stock ?? 0 })))}
              on conflict (lower(sku)) do update set
                name = excluded.name, brand_id = coalesce(excluded.brand_id, products.brand_id),
                category_id = coalesce(excluded.category_id, products.category_id), hsn = excluded.hsn, unit = excluded.unit,
                cost_price = excluded.cost_price, sale_price = excluded.sale_price, mrp = excluded.mrp, gst_rate = excluded.gst_rate,
                showroom_cost = coalesce(excluded.showroom_cost, products.showroom_cost), retail_price = coalesce(excluded.retail_price, products.retail_price),
                reorder_level = excluded.reorder_level, rack = excluded.rack, updated_at = now()
                ${setStock ? tx`, stock = excluded.stock` : tx``}
              returning id, lower(sku) as k, stock, (xmax = 0) as inserted`
          : Promise.resolve([]);
      const saved = [
        ...(await upsert(prepared.filter((p) => p.stock !== null), true)),
        ...(await upsert(prepared.filter((p) => p.stock === null), false)),
      ];
      const byKey = new Map(saved.map((s) => [s.k, s]));
      const moves = [];
      const links: { model_id: number; product_id: number }[] = [];
      for (const p of prepared) {
        const s = byKey.get(String(p.values.sku).toLowerCase());
        if (!s) continue;
        if (s.inserted) stats.inserted++; else stats.updated++;
        const diff = s.stock - (before.get(s.k) ?? 0);
        if (diff !== 0) moves.push({ product_id: s.id, change: diff, balance: s.stock, reason: "import", note: "CSV import", user_id: userId });
        for (const m of p.modelIds) links.push({ model_id: m, product_id: s.id });
      }
      if (moves.length) await tx`insert into stock_movements ${tx(moves)}`;
      if (links.length) await tx`insert into product_models ${tx(links)} on conflict do nothing`;
    });
    onProgress?.(stats);
  };

  const parser = new CsvParser((cells) => {
    if (!header) {
      header = cells.map((h) => h.trim().toLowerCase().replace(/^\ufeff/, "").replace(/\s+/g, "_"));
      const missing = ["sku", "name"].filter((c) => !header!.includes(c));
      if (missing.length) throw new Error(`The file needs columns named ${missing.join(" and ")}. Download the template to see the format.`);
      return;
    }
    stats.rows++;
    const r = {} as Row;
    header.forEach((h, i) => { (r as Record<string, string>)[h] = cells[i] ?? ""; });
    pending.push(r);
  });

  const drain = async (all: boolean) => {
    while (pending.length >= BATCH || (all && pending.length)) {
      const batch = pending.slice(0, BATCH);
      pending = pending.slice(BATCH);
      await flush(batch);
    }
  };
  for await (const chunk of chunks) {
    parser.push(chunk);
    await drain(false);
  }
  parser.end();
  await drain(true);
  return stats;
}

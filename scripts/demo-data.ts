/**
 * Generates realistic demo data for load-testing and trying the app.
 *
 *   npm run db:demo              -> 1,000,000 parts + 90 days of sales
 *   npm run db:demo -- 250000    -> custom part count
 *   npm run db:demo -- --purge   -> delete all demo data
 *
 * Everything created here has is_demo = true, so it can be removed safely
 * without touching real parts, customers or invoices.
 */
import { connect } from "./_db";

const sql = connect();
const args = process.argv.slice(2);

const PARTS: [string, string, string, number][] = [
  ["Brake shoe set", "Brakes", "set", 95], ["Front disc brake pad", "Brakes", "pair", 180],
  ["Rear disc brake pad", "Brakes", "pair", 170], ["Brake cable", "Cables", "pcs", 60],
  ["Clutch cable", "Cables", "pcs", 70], ["Accelerator cable", "Cables", "pcs", 55],
  ["Speedometer cable", "Cables", "pcs", 65], ["Choke cable", "Cables", "pcs", 45],
  ["Clutch plate set", "Clutch", "set", 420], ["Clutch pressure plate", "Clutch", "pcs", 380],
  ["Clutch assembly", "Clutch", "set", 1450], ["Chain sprocket kit", "Transmission", "kit", 780],
  ["Drive belt", "Transmission", "pcs", 520], ["Roller weight set", "Transmission", "set", 160],
  ["Gear shift lever", "Transmission", "pcs", 140], ["Piston kit", "Engine", "kit", 1150],
  ["Cylinder block kit", "Engine", "kit", 2650], ["Cam shaft", "Engine", "pcs", 690],
  ["Timing chain", "Engine", "pcs", 310], ["Valve set", "Engine", "set", 240],
  ["Gasket kit", "Engine", "kit", 210], ["Crankshaft oil seal", "Engine", "pcs", 45],
  ["Connecting rod kit", "Engine", "kit", 980], ["Spark plug", "Electricals", "pcs", 60],
  ["Ignition coil", "Electricals", "pcs", 420], ["CDI unit", "Electricals", "pcs", 780],
  ["Regulator rectifier", "Electricals", "pcs", 520], ["Self starter motor", "Electricals", "pcs", 1650],
  ["Starter relay", "Electricals", "pcs", 190], ["Wiring harness", "Electricals", "pcs", 890],
  ["Handle bar switch", "Electricals", "pcs", 260], ["Headlight assembly", "Lights", "pcs", 640],
  ["Tail light assembly", "Lights", "pcs", 280], ["Indicator set", "Lights", "set", 190],
  ["Front fork assembly", "Suspension", "set", 3200], ["Fork oil seal kit", "Suspension", "kit", 150],
  ["Rear shock absorber", "Suspension", "pair", 1650], ["Swing arm bush kit", "Suspension", "kit", 130],
  ["Air filter", "Filters", "pcs", 120], ["Oil filter", "Filters", "pcs", 90],
  ["Fuel filter", "Filters", "pcs", 40], ["Carburettor", "Fuel system", "pcs", 1250],
  ["Fuel tap", "Fuel system", "pcs", 150], ["Front mudguard", "Body parts", "pcs", 360],
  ["Rear view mirror set", "Body parts", "pair", 120], ["Side panel set", "Body parts", "set", 540],
  ["Seat cover", "Body parts", "pcs", 180], ["Chain cover", "Body parts", "pcs", 260],
  ["Wheel bearing", "Bearings", "pcs", 130], ["Steering cone set", "Bearings", "set", 210],
  ["Front wheel rim", "Wheels", "pcs", 1450], ["Alloy wheel", "Wheels", "pcs", 2900],
  ["Engine mounting bolt kit", "Fasteners", "kit", 90],
];
const UNIVERSAL: [string, string, string, number][] = [
  ["Horn 12V", "Electricals", "pcs", 85], ["LED indicator pair", "Lights", "pair", 70],
  ["Tube 2.75-18", "Tyres & Tubes", "pcs", 165], ["Tube 3.00-10", "Tyres & Tubes", "pcs", 150],
  ["Headlight bulb 12V 35/35W", "Lights", "pcs", 38], ["Fuse set", "Electricals", "set", 25],
  ["Grip set", "Body parts", "pair", 80], ["Valve cap set", "Tyres & Tubes", "set", 15],
];

async function purge() {
  console.log("Removing demo data…");
  await sql`delete from invoices where is_demo`;
  await sql`delete from customers where is_demo`;
  let n = 0;
  for (;;) {
    const r = await sql`delete from products where id in (select id from products where is_demo limit 50000)`;
    n += r.count;
    if (!r.count) break;
    process.stdout.write(`\r  ${n.toLocaleString("en-IN")} demo parts deleted`);
  }
  console.log("\nDone.");
}

async function products(total: number) {
  const [{ has }] = await sql`select exists(select 1 from products where is_demo) as has`;
  if (has) { console.log("Demo parts already exist — skipping parts. Run with --purge first to regenerate."); return; }

  // Lookup tables for the generator
  await sql`drop table if exists _parts, _bm`;
  await sql`create temp table _parts (i int, name text, category_id int, unit text, cost numeric)`;
  const cats = new Map((await sql<{ id: number; name: string }[]>`select id, name from categories`).map((c) => [c.name, c.id]));
  await sql`insert into _parts ${sql(PARTS.map(([name, cat, unit, cost], i) => ({ i, name, category_id: cats.get(cat)!, unit, cost })))}`;
  await sql`
    create temp table _bm as
    select (row_number() over (order by b.sort_order, m.id) - 1)::int as k,
           b.id as brand_id, b.name::text as brand, m.id as model_id, m.name as model,
           lead(m.id) over (partition by b.id order by m.id) as next_model_id,
           upper(left(regexp_replace(b.name::text, '[^A-Za-z]', '', 'g'), 2)) as pfx
    from bike_models m join brands b on b.id = m.brand_id`;
  const [{ nparts }] = await sql`select count(*)::int as nparts from _parts`;
  const [{ nbm }] = await sql`select count(*)::int as nbm from _bm`;

  const batch = 100_000;
  const t0 = Date.now();
  for (let start = 1; start <= total; start += batch) {
    const end = Math.min(total, start + batch - 1);
    await sql`
      with src as (
        select g,
          bm.model_id, bm.next_model_id, bm.brand_id,
          bm.pfx || '-' || lpad(g::text, 7, '0') as sku,
          p.name || ' – ' || bm.brand || ' ' || bm.model as name,
          p.category_id, p.unit,
          round(p.cost * (0.85 + ((g * 37) % 40) / 100.0), 2) as cost
        from generate_series(${start}::bigint, ${end}::bigint) g
        join _parts p on p.i = (g * 7919) % ${nparts}
        join _bm bm on bm.k = (g * 104729) % ${nbm}
      ),
      ins as (
        insert into products (sku, name, brand_id, category_id, unit, cost_price, sale_price, mrp,
                              gst_rate, stock, reorder_level, rack, is_demo)
        select sku, name, brand_id, category_id, unit, cost,
               round(cost * 1.22, 0), round(cost * 1.55, 0), 18,
               case when g % 37 = 0 then 0 else (g * 17) % 140 end,
               5 + (g % 4) * 5,
               'R' || (g % 40 + 1) || '-' || chr((65 + g % 6)::int), true
        from src
        returning id, sku
      )
      insert into product_models (model_id, product_id)
      select s.model_id, i.id from ins i join src s on s.sku = i.sku
      union all
      select s.next_model_id, i.id from ins i join src s on s.sku = i.sku
      where s.next_model_id is not null and s.g % 2 = 0`;
    const rate = Math.round(end / ((Date.now() - t0) / 1000));
    process.stdout.write(`\r  ${end.toLocaleString("en-IN")} / ${total.toLocaleString("en-IN")} parts (${rate.toLocaleString("en-IN")}/s)`);
  }
  console.log();

  // A few universal parts that fit every bike
  const [uni] = await sql`select id from brands where is_universal limit 1`;
  if (uni) {
    await sql`insert into products ${sql(UNIVERSAL.map(([name, cat, unit, cost], i) => ({
      sku: `UN-${String(i + 1).padStart(4, "0")}`, name, brand_id: uni.id, category_id: cats.get(cat)!, unit,
      cost_price: cost, sale_price: Math.round(cost * 1.3), mrp: Math.round(cost * 1.6), gst_rate: 18,
      stock: 150, reorder_level: 30, rack: "U1", is_demo: true,
    })))} on conflict do nothing`;
  }
  console.log("  Updating planner statistics…");
  await sql`vacuum analyze products`;
  await sql`vacuum analyze product_models`;
}

const FIRST = ["Sri Murugan", "Balaji", "Ganesh", "Lakshmi", "Sai", "Annai", "Kannan", "Raja", "Vinayaga", "Selvam", "Arun", "Kumar", "Shiva", "Durga", "Anand", "Velan"];
const LAST = ["Auto Works", "Motors", "Two Wheeler Service", "Bike Point", "Auto Garage", "Service Centre", "Auto Spares", "Motor Works"];

async function sales(days: number) {
  const [{ has }] = await sql`select exists(select 1 from invoices where is_demo) as has`;
  if (has) { console.log("Demo sales already exist — skipping."); return; }
  const [settings] = await sql`select invoice_prefix from settings where id = 1`;

  const customers = await sql<{ id: number; name: string; phone: string }[]>`
    insert into customers ${sql(Array.from({ length: 120 }, (_, i) => ({
      name: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}${i >= 64 ? ` ${Math.floor(i / 16)}` : ""}`,
      phone: `9${String(840000000 + i * 7919).slice(0, 9)}`,
      address: "Chennai", state_code: "33", is_demo: true, credit_limit: 25000,
    })))} returning id, name, phone`;

  const pool = await sql<{ id: number; sku: string; name: string; hsn: string; unit: string; sale_price: number; cost_price: number; gst_rate: number; brand: string }[]>`
    select p.id, p.sku, p.name, p.hsn, p.unit, p.sale_price, p.cost_price, p.gst_rate, coalesce(b.name::text, '') as brand
    from products p left join brands b on b.id = p.brand_id
    where p.is_demo and p.stock > 0 and p.id % 97 = 0 limit 4000`;
  if (!pool.length) return;

  let seq = 0;
  const rnd = mulberry32(42);
  const today = new Date();
  for (let d = days; d >= 0; d--) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - d);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    if (date.getDay() === 0 && rnd() < 0.7) continue; // most Sundays closed
    const fy = fyOf(date);
    const count = 18 + Math.floor(rnd() * 30);
    await sql.begin(async (tx) => {
      for (let n = 0; n < count; n++) {
        seq++;
        const cust = rnd() < 0.7 ? customers[Math.floor(rnd() * customers.length)] : null;
        const lines = Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => {
          const p = pool[Math.floor(rnd() * pool.length)];
          const qty = 1 + Math.floor(rnd() * (p.sale_price > 1000 ? 2 : 10));
          const taxable = r2(qty * p.sale_price);
          const tax = r2(taxable * p.gst_rate / 100);
          return { p, qty, taxable, tax, total: r2(taxable + tax), cost: r2(qty * p.cost_price) };
        });
        const taxable = r2(lines.reduce((s, l) => s + l.taxable, 0));
        const tax = r2(lines.reduce((s, l) => s + l.tax, 0));
        const raw = taxable + tax, total = Math.round(raw);
        const mode = cust && rnd() < 0.25 ? "Credit" : ["Cash", "UPI", "UPI", "Card"][Math.floor(rnd() * 4)];
        const paid = mode === "Credit" ? (d > 30 && rnd() < 0.8 ? total : 0) : total;
        const [inv] = await tx`
          insert into invoices (invoice_no, fy, seq, invoice_date, created_at, customer_id, customer_name, customer_phone,
            subtotal, taxable, cgst, sgst, round_off, total, cost_total, amount_paid, payment_mode, status, is_demo)
          values (${`DEMO/${fy}/${String(seq).padStart(6, "0")}`}, ${"DEMO-" + fy}, ${seq}, ${dateStr},
            ${new Date(date.getTime() + (9 + rnd() * 11) * 3600_000)}, ${cust?.id ?? null},
            ${cust?.name ?? "Walk-in customer"}, ${cust?.phone ?? ""},
            ${taxable}, ${taxable}, ${r2(tax / 2)}, ${r2(tax - r2(tax / 2))}, ${r2(total - raw)}, ${total},
            ${r2(lines.reduce((s, l) => s + l.cost, 0))}, ${paid}, ${mode},
            ${paid >= total ? "paid" : "due"}, true)
          returning id`;
        await tx`insert into invoice_items ${tx(lines.map((l) => ({
          invoice_id: inv.id, product_id: l.p.id, sku: l.p.sku, name: l.p.name, hsn: l.p.hsn, brand: l.p.brand,
          unit: l.p.unit, qty: l.qty, rate: l.p.sale_price, taxable: l.taxable, gst_rate: l.p.gst_rate,
          tax: l.tax, total: l.total, cost: l.cost,
        })))}`;
      }
    });
    process.stdout.write(`\r  ${seq.toLocaleString("en-IN")} demo invoices`);
  }
  void settings;
  console.log();
}

const r2 = (n: number) => Math.round(n * 100) / 100;
function fyOf(d: Date) {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  if (args.includes("--purge")) return purge();
  const total = Number(args.find((a) => /^\d+$/.test(a)) ?? 1_000_000);
  console.log(`Generating ${total.toLocaleString("en-IN")} demo parts…`);
  await products(total);
  console.log("Generating 90 days of demo sales…");
  await sales(90);
  const [{ n }] = await sql`select count(*)::int as n from products`;
  console.log(`Done. ${n.toLocaleString("en-IN")} parts in the database.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());

import "server-only";
import { sql } from "./db";
import { BUDGETS, FINANCE_FILTERS, normalizeReg, REFURB_KINDS } from "./regno";

export type VehicleRow = {
  id: number; reg_no: string; status: string; make: string; model: string; variant: string;
  mfg_year: number | null; odometer_km: number | null; owner_count: number; current_owner: string;
  our_price: number | null; purchase_price: number | null; sold_price: number | null; colour: string;
  insurance_valid_till: string | null; puc_valid_till: string | null;
  pending_fines: number; pending_fine_amount: number;
  cover_photo_id: number | null; damaged_parts: number; accidents: number; loan_status: string;
};

export type Vehicle = {
  id: number; reg_no: string; status: string; brand_id: number | null; make: string; model: string; variant: string;
  mfg_year: number | null; reg_date: string | null; colour: string; fuel: string; engine_cc: number | null;
  chassis_no: string; engine_no: string; odometer_km: number | null; condition: string;
  owner_count: number; current_owner: string; owner_phone: string; owner_address: string;
  rc_valid_till: string | null; insurance_company: string; insurance_policy_no: string; insurance_valid_till: string | null;
  puc_valid_till: string | null; hypothecation: string; noc_received: boolean;
  rc_status: string; rc_type: string; rc_owner_name: string; rto_office: string;
  insurance_type: string; insurance_idv: number | null; puc_cert_no: string; docs_in_hand: string[];
  loan_status: string; loan_branch: string; loan_account_no: string; loan_amount: number | null; loan_emi: number | null;
  loan_tenure_months: number | null; loan_start: string | null; loan_end: string | null; loan_emis_pending: number | null;
  loan_closure_amount: number | null; loan_paid_by: string; loan_closed_on: string | null; noc_number: string; noc_date: string | null;
  form35_submitted: boolean; loan_notes: string;
  purchase_price: number | null; purchase_date: string | null; purchased_from: string;
  market_price: number | null; our_price: number | null; min_price: number | null;
  sold_price: number | null; sold_on: string | null; sold_to: string; sold_phone: string; sold_payment_mode: string;
  notes: string; created_at: Date; updated_at: Date; created_by_name: string | null;
};

export type VehiclePhoto = { id: number; kind: string; caption: string; created_at: Date };
export type VehiclePart = {
  id: number; part: string; status: string; detail: string; changed_on: string | null; odometer_km: number | null;
  cost: number; warranty_till: string | null;
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);

/** Vehicle list with keyset paging. Words match reg no, bike, owner, phone, chassis or engine number. */
export async function searchVehicles(f: { q?: string; status?: string; budget?: string; finance?: string; after?: number; limit?: number }) {
  const limit = Math.min(Math.max(f.limit ?? 50, 1), 200);
  const words = (f.q ?? "").toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0, 6);
  const conds = [sql`true`];
  if (words.length) {
    // Every word must match somewhere — or the whole query is part of a reg no typed with spaces/dashes ("TN 76 AB").
    const allWords = words.map((w) => sql`v.search like ${"%" + escapeLike(w) + "%"}`).reduce((a, c) => sql`${a} and ${c}`);
    const whole = normalizeReg(words.join(""));
    conds.push(whole.length >= 3 ? sql`((${allWords}) or v.reg_no like ${"%" + whole + "%"})` : allWords);
  }
  if (f.status === "available") conds.push(sql`v.status <> 'sold'`);
  else if (f.status) conds.push(sql`v.status = ${f.status}`);
  const band = BUDGETS.find((b) => b.key === f.budget);
  if (band) conds.push(band.max == null ? sql`v.our_price >= ${band.min}` : sql`v.our_price >= ${band.min} and v.our_price < ${band.max}`);
  const fin = FINANCE_FILTERS.find((x) => x.key === f.finance);
  if (fin) conds.push(sql`v.loan_status in ${sql(fin.statuses)}`);
  if (f.after) conds.push(sql`v.id < ${f.after}`);
  const where = conds.reduce((a, c) => sql`${a} and ${c}`);

  const rows = await sql<VehicleRow[]>`
    select v.id, v.reg_no, v.status, v.make, v.model, v.variant, v.mfg_year, v.odometer_km, v.owner_count, v.current_owner,
           v.our_price, v.purchase_price, v.sold_price, v.colour, v.loan_status,
           to_char(v.insurance_valid_till, 'YYYY-MM-DD') as insurance_valid_till, to_char(v.puc_valid_till, 'YYYY-MM-DD') as puc_valid_till,
           coalesce(f.n, 0)::int as pending_fines, coalesce(f.amount, 0) as pending_fine_amount,
           (select min(id) from vehicle_photos where vehicle_id = v.id and kind = 'vehicle') as cover_photo_id,
           (select count(*) from vehicle_parts where vehicle_id = v.id and status = 'damaged')::int as damaged_parts,
           (select count(*) from vehicle_events where vehicle_id = v.id and kind = 'accident')::int as accidents
    from vehicles v
    left join lateral (select count(*) as n, sum(amount) as amount from vehicle_fines where vehicle_id = v.id and status = 'pending') f on true
    where ${where}
    order by v.id desc limit ${limit + 1}`;
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { rows: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}

export async function findVehicleByReg(reg: string) {
  const [v] = await sql<{ id: number }[]>`select id from vehicles where reg_no = ${normalizeReg(reg)}`;
  return v ?? null;
}

const dateCols = (cols: string[]) => cols.map((c) => `to_char(v.${c}, 'YYYY-MM-DD') as ${c}`).join(", ");

export async function getVehicle(id: number) {
  const [v] = await sql<Vehicle[]>`
    select v.*, ${sql.unsafe(dateCols(["reg_date", "rc_valid_till", "insurance_valid_till", "puc_valid_till", "purchase_date", "sold_on", "loan_start", "loan_end", "loan_closed_on", "noc_date"]))},
           u.name as created_by_name
    from vehicles v left join users u on u.id = v.created_by where v.id = ${id}`;
  return v ?? null;
}

export async function getVehicleDetails(id: number) {
  const [owners, fines, events, photos, parts] = await Promise.all([
    sql<{ id: number; owner_no: number; name: string; phone: string; from_date: string | null; to_date: string | null; note: string }[]>`
      select id, owner_no, name, phone, to_char(from_date, 'YYYY-MM-DD') as from_date, to_char(to_date, 'YYYY-MM-DD') as to_date, note
      from vehicle_owners where vehicle_id = ${id} order by owner_no, id`,
    sql<{ id: number; challan_no: string; challan_date: string | null; offence: string; place: string; amount: number; status: string; paid_on: string | null }[]>`
      select id, challan_no, to_char(challan_date, 'YYYY-MM-DD') as challan_date, offence, place, amount, status, to_char(paid_on, 'YYYY-MM-DD') as paid_on
      from vehicle_fines where vehicle_id = ${id} order by (status = 'pending') desc, challan_date desc nulls last, id desc`,
    sql<{ id: number; event_date: string; kind: string; title: string; odometer_km: number | null; cost: number; user_name: string | null }[]>`
      select e.id, to_char(e.event_date, 'YYYY-MM-DD') as event_date, e.kind, e.title, e.odometer_km, e.cost, u.name as user_name
      from vehicle_events e left join users u on u.id = e.user_id
      where e.vehicle_id = ${id} order by e.event_date desc, e.id desc`,
    sql<VehiclePhoto[]>`
      select id, kind, caption, created_at from vehicle_photos where vehicle_id = ${id} order by id`,
    sql<VehiclePart[]>`
      select id, part, status, detail, to_char(changed_on, 'YYYY-MM-DD') as changed_on, odometer_km, cost,
             to_char(warranty_till, 'YYYY-MM-DD') as warranty_till
      from vehicle_parts where vehicle_id = ${id}
      order by (status = 'damaged') desc, changed_on desc nulls last, id desc`,
  ]);
  const refurbCost = events.filter((e) => REFURB_KINDS.includes(e.kind)).reduce((s, e) => s + Number(e.cost), 0);
  const pendingFines = fines.filter((f) => f.status === "pending").reduce((s, f) => s + Number(f.amount), 0);
  return { owners, fines, events, photos, parts, refurbCost, pendingFines };
}

/**
 * What a bike cost us, as a lateral subquery on `v` (vehicles). Use as `cross join lateral (${bikeCost()}) c`.
 * - total: bought price + service/repairs + the seller's loan when it was cleared as part of the deal
 *   (by us, or by the customer who bought it from us); this is what profit is measured against.
 * - cash: the part that is our own money (a loan the buyer clears never passes through the shop).
 * - buyer_loan: the loan the buyer pays straight to the financier, so we receive that much less at sale.
 * A function, not a constant, so importing this module never opens a database connection.
 */
export const bikeCost = () => sql`
  select r.refurb, l.loan, l.buyer_loan, coalesce(v.purchase_price, 0) + r.refurb + l.loan as total,
         coalesce(v.purchase_price, 0) + r.refurb + l.loan - l.buyer_loan as cash
  from (select coalesce(sum(e.cost), 0) as refurb from vehicle_events e where e.vehicle_id = v.id and e.kind in ${sql(REFURB_KINDS)}) r,
       (select case when v.loan_paid_by in ('shop', 'buyer') then coalesce(v.loan_closure_amount, 0) else 0 end as loan,
               case when v.loan_paid_by = 'buyer' then coalesce(v.loan_closure_amount, 0) else 0 end as buyer_loan) l`;

/** Headline numbers for the vehicles page. */
export async function vehicleSummary() {
  const [s] = await sql<{ available: number; reserved: number; in_service: number; invested: number; asking: number; sold_month: number; profit_month: number; docs_due: number }[]>`
    select
      count(*) filter (where v.status <> 'sold')::int as available,
      count(*) filter (where v.status = 'reserved')::int as reserved,
      count(*) filter (where v.status = 'in_service')::int as in_service,
      coalesce(sum(c.cash) filter (where v.status <> 'sold'), 0) as invested,
      coalesce(sum(v.our_price) filter (where v.status <> 'sold'), 0) as asking,
      count(*) filter (where v.status = 'sold' and v.sold_on >= date_trunc('month', current_date))::int as sold_month,
      coalesce(sum(v.sold_price - c.total) filter (where v.status = 'sold' and v.sold_on >= date_trunc('month', current_date)), 0) as profit_month,
      count(*) filter (where v.status <> 'sold' and (v.insurance_valid_till < current_date + 15 or v.puc_valid_till < current_date + 15))::int as docs_due
    from vehicles v cross join lateral (${bikeCost()}) c`;
  return s;
}

/** How many unsold bikes fall in each budget band (by our asking price). */
export async function budgetCounts() {
  const [r] = await sql<Record<string, number>[]>`
    select ${sql.unsafe(BUDGETS.map((b, i) =>
      `count(*) filter (where our_price >= ${b.min}${b.max == null ? "" : ` and our_price < ${b.max}`})::int as b${i}`).join(", "))}
    from vehicles where status <> 'sold'`;
  return Object.fromEntries(BUDGETS.map((b, i) => [b.key, r[`b${i}`] ?? 0])) as Record<string, number>;
}

/** Unsold bikes per finance category, with the financiers involved and what it would take to clear them. */
export async function financeSummary() {
  const rows = await sql<{ loan_status: string; financier: string; n: number; to_close: number; shop_pays: number; buyer_pays: number }[]>`
    select loan_status, coalesce(nullif(hypothecation, ''), '') as financier, count(*)::int as n,
           coalesce(sum(loan_closure_amount), 0) as to_close,
           coalesce(sum(loan_closure_amount) filter (where loan_paid_by = 'shop'), 0) as shop_pays,
           coalesce(sum(loan_closure_amount) filter (where loan_paid_by = 'buyer'), 0) as buyer_pays
    from vehicles where status <> 'sold' group by 1, 2 order by n desc`;
  return FINANCE_FILTERS.map((f) => {
    const mine = rows.filter((r) => f.statuses.includes(r.loan_status));
    return {
      ...f,
      n: mine.reduce((a, r) => a + r.n, 0),
      toClose: mine.reduce((a, r) => a + Number(r.to_close), 0),
      shopPays: mine.reduce((a, r) => a + Number(r.shop_pays), 0),
      buyerPays: mine.reduce((a, r) => a + Number(r.buyer_pays), 0),
      financiers: mine.filter((r) => r.financier).map((r) => ({ name: r.financier, n: r.n, toClose: Number(r.to_close) })),
    };
  });
}

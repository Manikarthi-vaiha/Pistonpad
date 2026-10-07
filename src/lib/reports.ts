import "server-only";
import { sql } from "./db";
import { REFURB_KINDS } from "./regno";
import { bikeCost } from "./vehicles";

export async function salesReport(from: string, to: string) {
  const range = sql`i.invoice_date between ${from} and ${to} and i.status <> 'cancelled'`;
  const [[summary], daily, modes, gst, b2b, topParts, brands, categories, expenses, priceTypes, [outside], outsideParts] = await Promise.all([
    sql<{ bills: number; total: number; taxable: number; cgst: number; sgst: number; igst: number; cost: number; paid: number; discount: number; cancelled: number }[]>`
      select count(*)::int as bills, coalesce(sum(total), 0) as total, coalesce(sum(taxable), 0) as taxable,
             coalesce(sum(cgst), 0) as cgst, coalesce(sum(sgst), 0) as sgst, coalesce(sum(igst), 0) as igst,
             coalesce(sum(cost_total), 0) as cost, coalesce(sum(amount_paid), 0) as paid, coalesce(sum(discount), 0) as discount,
             (select count(*)::int from invoices x where x.invoice_date between ${from} and ${to} and x.status = 'cancelled') as cancelled
      from invoices i where ${range}`,
    sql<{ date: string; value: number }[]>`
      select to_char(d, 'YYYY-MM-DD') as date, coalesce(sum(i.total), 0) as value
      from generate_series(${from}::date, ${to}::date, '1 day') d
      left join invoices i on i.invoice_date = d::date and i.status <> 'cancelled'
      group by d order by d`,
    sql<{ label: string; value: number; n: number }[]>`
      select payment_mode as label, sum(total) as value, count(*)::int as n from invoices i where ${range} group by 1 order by 2 desc`,
    sql<{ rate: number; taxable: number; tax: number }[]>`
      select it.gst_rate as rate, sum(it.taxable) as taxable, sum(it.tax) as tax
      from invoice_items it join invoices i on i.id = it.invoice_id where ${range} group by 1 order by 1`,
    sql<{ kind: string; bills: number; taxable: number; tax: number }[]>`
      select case when customer_gstin <> '' then 'B2B (with GSTIN)' else 'B2C' end as kind, count(*)::int as bills,
             sum(taxable) as taxable, sum(cgst + sgst + igst) as tax
      from invoices i where ${range} group by 1 order by 1`,
    sql<{ product_id: number; sku: string; name: string; qty: number; amount: number; profit: number }[]>`
      select it.product_id, min(it.sku) as sku, min(it.name) as name, sum(it.qty)::int as qty,
             sum(it.taxable) as amount, sum(it.taxable - it.cost) as profit
      from invoice_items it join invoices i on i.id = it.invoice_id where ${range}
      group by it.product_id order by amount desc limit 15`,
    sql<{ label: string; value: number; qty: number }[]>`
      select coalesce(nullif(it.brand, ''), 'Other') as label, sum(it.taxable) as value, sum(it.qty)::int as qty
      from invoice_items it join invoices i on i.id = it.invoice_id where ${range}
      group by 1 order by 2 desc limit 12`,
    sql<{ label: string; value: number; qty: number }[]>`
      select coalesce(c.name::text, 'Uncategorised') as label, sum(it.taxable) as value, sum(it.qty)::int as qty
      from invoice_items it join invoices i on i.id = it.invoice_id
      join products p on p.id = it.product_id left join categories c on c.id = p.category_id
      where ${range} group by 1 order by 2 desc limit 12`,
    sql<{ label: string; value: number; n: number }[]>`
      select category as label, sum(amount) as value, count(*)::int as n
      from expenses where expense_date between ${from} and ${to} and business = 'parts' group by 1 order by 2 desc`,
    // Wholesale-rate vs showroom-rate bills
    sql<{ price_type: string; bills: number; taxable: number; profit: number }[]>`
      select price_type, count(*)::int as bills, coalesce(sum(taxable), 0) as taxable, coalesce(sum(taxable - cost_total), 0) as profit
      from invoices i where ${range} group by 1 order by 1 desc`,
    // Parts bought from a showroom / outside market and sold on
    sql<{ lines: number; qty: number; cost: number; sales: number; profit: number }[]>`
      select count(*)::int as lines, coalesce(sum(it.qty), 0)::int as qty, coalesce(sum(it.cost), 0) as cost,
             coalesce(sum(it.taxable), 0) as sales, coalesce(sum(it.taxable - it.cost), 0) as profit
      from invoice_items it join invoices i on i.id = it.invoice_id where ${range} and it.source = 'outside'`,
    sql<{ product_id: number; sku: string; name: string; qty: number; cost: number; sales: number; profit: number; times: number }[]>`
      select it.product_id, min(it.sku) as sku, min(it.name) as name, sum(it.qty)::int as qty, sum(it.cost) as cost,
             sum(it.taxable) as sales, sum(it.taxable - it.cost) as profit, count(*)::int as times
      from invoice_items it join invoices i on i.id = it.invoice_id where ${range} and it.source = 'outside'
      group by it.product_id order by times desc, sales desc limit 15`,
  ]);
  const expenseTotal = expenses.reduce((s, e) => s + e.value, 0);
  const grossProfit = summary.taxable - summary.cost;
  return { summary, daily, modes, gst, b2b, topParts, brands, categories, expenses, priceTypes, outside, outsideParts, expenseTotal, grossProfit, netProfit: grossProfit - expenseTotal };
}

export const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Bank", "Cheque"] as const;

/**
 * Money actually received in a period, by payment method — from the payments ledger, so credit
 * collected later counts on the day it was collected. Payments on cancelled bills are left out
 * (the money is treated as returned). Used-bike sales count on their sale day, by how the buyer paid.
 * Expenses paid by each method are shown alongside.
 */
export async function collectionsReport(from: string, to: string) {
  const live = sql`p.paid_on between ${from} and ${to} and i.status <> 'cancelled'`;
  const [byMode, daily, expensesByMode, bikesByMode, bikesDaily] = await Promise.all([
    sql<{ mode: string; total: number; n: number; at_billing: number; collected_later: number }[]>`
      select p.mode, sum(p.amount) as total, count(*)::int as n,
             coalesce(sum(p.amount) filter (where p.created_at <= i.created_at + interval '2 minutes'), 0) as at_billing,
             coalesce(sum(p.amount) filter (where p.created_at > i.created_at + interval '2 minutes'), 0) as collected_later
      from payments p join invoices i on i.id = p.invoice_id
      where ${live} group by 1`,
    sql<{ date: string; mode: string; total: number }[]>`
      select to_char(p.paid_on, 'YYYY-MM-DD') as date, p.mode, sum(p.amount) as total
      from payments p join invoices i on i.id = p.invoice_id
      where ${live} group by 1, 2 order by 1 desc`,
    sql<{ mode: string; total: number }[]>`
      select payment_mode as mode, sum(amount) as total from expenses
      where expense_date between ${from} and ${to} group by 1`,
    sql<{ mode: string; total: number; n: number }[]>`
      select coalesce(nullif(sold_payment_mode, ''), 'Not recorded') as mode, sum(sold_price - case when loan_paid_by = 'buyer' then coalesce(loan_closure_amount, 0) else 0 end) as total, count(*)::int as n
      from vehicles where status = 'sold' and sold_on between ${from} and ${to} group by 1`,
    sql<{ date: string; mode: string; total: number }[]>`
      select to_char(sold_on, 'YYYY-MM-DD') as date, coalesce(nullif(sold_payment_mode, ''), 'Not recorded') as mode, sum(sold_price - case when loan_paid_by = 'buyer' then coalesce(loan_closure_amount, 0) else 0 end) as total
      from vehicles where status = 'sold' and sold_on between ${from} and ${to} group by 1, 2`,
  ]);

  const known = new Set<string>(PAYMENT_METHODS);
  const modes = [...PAYMENT_METHODS, ...new Set([...byMode, ...expensesByMode, ...bikesByMode].map((r) => r.mode).filter((m) => !known.has(m)))];
  const methods = modes.map((mode) => {
    const r = byMode.find((x) => x.mode === mode);
    const b = bikesByMode.find((x) => x.mode === mode);
    const out = Number(expensesByMode.find((x) => x.mode === mode)?.total ?? 0);
    const parts = Number(r?.total ?? 0), bikes = Number(b?.total ?? 0);
    return {
      mode, received: parts + bikes, parts, bikes, payments: (r?.n ?? 0) + (b?.n ?? 0), bikesSold: b?.n ?? 0,
      atBilling: Number(r?.at_billing ?? 0), collectedLater: Number(r?.collected_later ?? 0), expenses: out, net: parts + bikes - out,
    };
  });

  const days = new Map<string, Record<string, number>>();
  for (const d of [...daily, ...bikesDaily]) {
    const row = days.get(d.date) ?? {};
    row[d.mode] = (row[d.mode] ?? 0) + Number(d.total);
    days.set(d.date, row);
  }
  const total = methods.reduce((s, m) => s + m.received, 0);
  return {
    methods,
    total,
    collectedLater: methods.reduce((s, m) => s + m.collectedLater, 0),
    bikes: methods.reduce((s, m) => s + m.bikes, 0),
    expenses: methods.reduce((s, m) => s + m.expenses, 0),
    daily: [...days].sort(([a], [b]) => b.localeCompare(a)).map(([date, byMode]) => ({ date, byMode, total: Object.values(byMode).reduce((a, b) => a + b, 0) })),
  };
}

export type BikeSale = {
  id: number; reg_no: string; make: string; model: string; mfg_year: number | null; sold_on: string; sold_to: string;
  sold_payment_mode: string; bought: number; refurb: number; loan: number; buyer_loan: number; cost: number; sold_price: number; profit: number; days: number | null;
};

/** Used-bike business for a period: bikes sold (with full cost and profit), bought, money spent on them, stock now. */
export async function vehicleReport(from: string, to: string) {
  const soldIn = sql`v.status = 'sold' and v.sold_on between ${from} and ${to}`;
  // A loan closure the shop paid counts as purchase spend on the day the loan was closed (or the purchase day if not recorded).
  const paidLoan = sql`loan_paid_by = 'shop' and loan_status <> 'active' and loan_closure_amount > 0`;
  const loanDay = sql`coalesce(loan_closed_on, purchase_date)`;
  const [sales, [bought], [refurb], [stock], expenses, monthly, purchases, services, financed, owed] = await Promise.all([
    sql<BikeSale[]>`
      select v.id, v.reg_no, v.make, v.model, v.mfg_year, to_char(v.sold_on, 'YYYY-MM-DD') as sold_on, v.sold_to, v.sold_payment_mode,
             coalesce(v.purchase_price, 0) as bought, c.refurb, c.loan, c.buyer_loan, c.total as cost, v.sold_price, v.sold_price - c.total as profit,
             v.sold_on - v.purchase_date as days
      from vehicles v cross join lateral (${bikeCost()}) c
      where ${soldIn} order by v.sold_on desc, v.id desc limit 500`,
    sql<{ n: number; owners: number; financiers: number; loans: number; spent: number }[]>`
      select count(*) filter (where purchase_date between ${from} and ${to})::int as n,
             coalesce(sum(purchase_price) filter (where purchase_date between ${from} and ${to}), 0) as owners,
             coalesce(sum(loan_closure_amount) filter (where ${paidLoan} and ${loanDay} between ${from} and ${to}), 0) as financiers,
             count(*) filter (where ${paidLoan} and ${loanDay} between ${from} and ${to})::int as loans,
             coalesce(sum(purchase_price) filter (where purchase_date between ${from} and ${to}), 0)
               + coalesce(sum(loan_closure_amount) filter (where ${paidLoan} and ${loanDay} between ${from} and ${to}), 0) as spent
      from vehicles`,
    sql<{ spent: number; jobs: number }[]>`
      select coalesce(sum(cost), 0) as spent, count(*) filter (where cost > 0)::int as jobs from vehicle_events
      where event_date between ${from} and ${to} and kind in ${sql(REFURB_KINDS)}`,
    sql<{ n: number; invested: number; asking: number; aged: number; aged_value: number }[]>`
      select count(*)::int as n, coalesce(sum(c.cash), 0) as invested, coalesce(sum(v.our_price), 0) as asking,
             count(*) filter (where v.purchase_date < current_date - 60)::int as aged,
             coalesce(sum(c.cash) filter (where v.purchase_date < current_date - 60), 0) as aged_value
      from vehicles v cross join lateral (${bikeCost()}) c where v.status <> 'sold'`,
    sql<{ label: string; value: number; n: number }[]>`
      select category as label, sum(amount) as value, count(*)::int as n from expenses
      where expense_date between ${from} and ${to} and business = 'vehicles' group by 1 order by 2 desc`,
    // One row per month in the range: bikes bought, serviced and sold.
    sql<{ month: string; bought: number; bought_spend: number; loan_spend: number; serviced: number; jobs: number; service_spend: number; sold: number; sales: number; profit: number }[]>`
      with months as (
        select to_char(m, 'YYYY-MM') as month, greatest(m, ${from}::date) as a, least((m + interval '1 month - 1 day')::date, ${to}::date) as b
        from generate_series(date_trunc('month', ${from}::date), date_trunc('month', ${to}::date), '1 month') g(m)
      )
      select month,
        (select count(*)::int from vehicles where purchase_date between a and b) as bought,
        (select coalesce(sum(purchase_price), 0) from vehicles where purchase_date between a and b) as bought_spend,
        (select coalesce(sum(loan_closure_amount), 0) from vehicles where ${paidLoan} and ${loanDay} between a and b) as loan_spend,
        (select count(distinct vehicle_id)::int from vehicle_events where kind in ${sql(REFURB_KINDS)} and cost > 0 and event_date between a and b) as serviced,
        (select count(*)::int from vehicle_events where kind in ${sql(REFURB_KINDS)} and cost > 0 and event_date between a and b) as jobs,
        (select coalesce(sum(cost), 0) from vehicle_events where kind in ${sql(REFURB_KINDS)} and event_date between a and b) as service_spend,
        (select count(*)::int from vehicles where status = 'sold' and sold_on between a and b) as sold,
        (select coalesce(sum(sold_price), 0) from vehicles where status = 'sold' and sold_on between a and b) as sales,
        (select coalesce(sum(v.sold_price - c.total), 0) from vehicles v cross join lateral (${bikeCost()}) c
          where v.status = 'sold' and v.sold_on between a and b) as profit
      from months order by month desc`,
    sql<{ id: number; reg_no: string; make: string; model: string; purchase_date: string; purchased_from: string; purchase_price: number | null; status: string; loan: number; payer: string; financier: string; loan_status: string }[]>`
      select id, reg_no, make, model, to_char(purchase_date, 'YYYY-MM-DD') as purchase_date, purchased_from, purchase_price, status,
             case when loan_paid_by in ('shop', 'buyer') then coalesce(loan_closure_amount, 0) else 0 end as loan, loan_paid_by as payer,
             hypothecation as financier, loan_status
      from vehicles where purchase_date between ${from} and ${to} order by purchase_date desc, id desc limit 500`,
    sql<{ id: number; vehicle_id: number; reg_no: string; make: string; model: string; event_date: string; kind: string; title: string; cost: number }[]>`
      select e.id, e.vehicle_id, v.reg_no, v.make, v.model, to_char(e.event_date, 'YYYY-MM-DD') as event_date, e.kind, e.title, e.cost
      from vehicle_events e join vehicles v on v.id = e.vehicle_id
      where e.kind in ${sql(REFURB_KINDS)} and e.event_date between ${from} and ${to}
      order by e.event_date desc, e.id desc limit 500`,
    sql<{ n: number; value: number }[]>`
      select count(*)::int as n, coalesce(sum(sold_price), 0) as value from vehicles
      where status = 'sold' and sold_on between ${from} and ${to} and sold_payment_mode = 'Finance'`,
    // Loans the shop agreed to clear but hasn't paid yet: money we owe financiers right now (not tied to the date range).
    sql<{ id: number; reg_no: string; make: string; model: string; financier: string; amount: number; status: string; purchase_date: string | null }[]>`
      select id, reg_no, make, model, hypothecation as financier, coalesce(loan_closure_amount, 0) as amount, status,
             to_char(purchase_date, 'YYYY-MM-DD') as purchase_date
      from vehicles where loan_paid_by = 'shop' and loan_status = 'active' order by purchase_date nulls last, id`,
  ]);
  const sum = (k: "sold_price" | "cost" | "profit" | "refurb" | "loan") => sales.reduce((a, x) => a + Number(x[k]), 0);
  const revenue = sum("sold_price"), cost = sum("cost"), profit = sum("profit");
  const withDays = sales.filter((x) => x.days != null);
  const group = (key: (x: BikeSale) => string) => {
    const m = new Map<string, { label: string; n: number; value: number; profit: number }>();
    for (const x of sales) {
      const k = key(x) || "Not recorded";
      const g = m.get(k) ?? { label: k, n: 0, value: 0, profit: 0 };
      g.n++; g.value += Number(x.sold_price); g.profit += Number(x.profit);
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b.value - a.value);
  };
  const expenseTotal = expenses.reduce((a, e) => a + Number(e.value), 0);
  return {
    sales, bought, refurb, stock, expenses, expenseTotal, monthly, purchases, services, soldOnFinance: financed[0],
    owed, owedTotal: owed.reduce((a, x) => a + Number(x.amount), 0),
    summary: { n: sales.length, revenue, cost, profit, refurb: sum("refurb"), loan: sum("loan"),
      avgDays: withDays.length ? Math.round(withDays.reduce((a, x) => a + Number(x.days), 0) / withDays.length) : null },
    byMake: group((x) => x.make),
    byMode: group((x) => x.sold_payment_mode),
    netProfit: profit - expenseTotal,
  };
}

/** Both businesses side by side, plus shared costs, for one period. */
export async function combinedReport(from: string, to: string) {
  const [[parts], [bikes], expenses] = await Promise.all([
    sql<{ bills: number; sales: number; taxable: number; cost: number }[]>`
      select count(*)::int as bills, coalesce(sum(total), 0) as sales, coalesce(sum(taxable), 0) as taxable, coalesce(sum(cost_total), 0) as cost
      from invoices where invoice_date between ${from} and ${to} and status <> 'cancelled'`,
    sql<{ n: number; sales: number; cost: number }[]>`
      select count(*)::int as n, coalesce(sum(v.sold_price), 0) as sales, coalesce(sum(c.total), 0) as cost
      from vehicles v cross join lateral (${bikeCost()}) c where v.status = 'sold' and v.sold_on between ${from} and ${to}`,
    sql<{ business: string; category: string; value: number }[]>`
      select business, category, sum(amount) as value from expenses
      where expense_date between ${from} and ${to} group by 1, 2 order by 3 desc`,
  ]);
  const exp = (b: string) => expenses.filter((e) => e.business === b);
  const total = (b: string) => exp(b).reduce((a, e) => a + Number(e.value), 0);
  const partsGross = Number(parts.taxable) - Number(parts.cost);
  const bikesGross = Number(bikes.sales) - Number(bikes.cost);
  const p = { expenses: exp("parts"), expenseTotal: total("parts") };
  const b = { expenses: exp("vehicles"), expenseTotal: total("vehicles") };
  const shared = { expenses: exp("shared"), expenseTotal: total("shared") };
  return {
    parts: { ...parts, gross: partsGross, ...p, net: partsGross - p.expenseTotal },
    bikes: { ...bikes, gross: bikesGross, ...b, net: bikesGross - b.expenseTotal },
    shared,
    net: partsGross - p.expenseTotal + bikesGross - b.expenseTotal - shared.expenseTotal,
  };
}

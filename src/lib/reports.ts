import "server-only";
import { sql } from "./db";

export async function salesReport(from: string, to: string) {
  const range = sql`i.invoice_date between ${from} and ${to} and i.status <> 'cancelled'`;
  const [[summary], daily, modes, gst, b2b, topParts, brands, categories] = await Promise.all([
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
  ]);
  return { summary, daily, modes, gst, b2b, topParts, brands, categories };
}

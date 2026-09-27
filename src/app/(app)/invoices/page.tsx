import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileText, Search } from "lucide-react";
import { Card, Empty, InvoiceStatus, Input, LinkButton, PageHeader, Select, Table, td, th, buttonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { count, dateLabel, rupees, timeLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Invoices" };
const PAGE = 50;

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  await requireUser();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = one("q").trim(), status = one("status"), from = one("from"), to = one("to");
  const after = /^\d+$/.test(one("after")) ? Number(one("after")) : 0;

  const conds = [sql`true`];
  if (q) conds.push(sql`(invoice_no ilike ${"%" + q + "%"} or customer_name ilike ${"%" + q + "%"} or customer_phone like ${q + "%"})`);
  if (status === "unpaid") conds.push(sql`status in ('due','partial')`);
  else if (["paid", "cancelled"].includes(status)) conds.push(sql`status = ${status}`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) conds.push(sql`invoice_date >= ${from}`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) conds.push(sql`invoice_date <= ${to}`);
  const base = conds.reduce((a, c) => sql`${a} and ${c}`);
  const where = after ? sql`${base} and id < ${after}` : base;

  const [rows, [sum]] = await Promise.all([
    sql<{ id: number; invoice_no: string; invoice_date: string; created_at: Date; customer_name: string; customer_phone: string; payment_mode: string; total: number; amount_paid: number; status: string; items: number }[]>`
      select i.id, i.invoice_no, to_char(i.invoice_date, 'YYYY-MM-DD') as invoice_date, i.created_at, i.customer_name, i.customer_phone,
             i.payment_mode, i.total, i.amount_paid, i.status,
             (select count(*)::int from invoice_items it where it.invoice_id = i.id) as items
      from invoices i where ${where} order by i.id desc limit ${PAGE + 1}`,
    sql<{ n: number; total: number; due: number }[]>`
      select count(*)::int as n, coalesce(sum(total) filter (where status <> 'cancelled'), 0) as total,
             coalesce(sum(total - amount_paid) filter (where status in ('due','partial')), 0) as due
      from invoices where ${base}`,
  ]);
  const more = rows.length > PAGE;
  const page = more ? rows.slice(0, PAGE) : rows;
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(status && { status }), ...(from && { from }), ...(to && { to }), ...extra });
    return `/invoices?${p}`;
  };

  return (
    <>
      <PageHeader title="Invoices" sub={`${count(sum.n)} invoices · ${rupees(sum.total)} billed${sum.due ? ` · ${rupees(sum.due)} still to collect` : ""}`}
        actions={<LinkButton href="/billing" variant="primary">New bill</LinkButton>} />
      <Card>
        <form className="grid grid-cols-1 gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_170px_150px_150px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <Input name="q" defaultValue={q} placeholder="Invoice no., customer or phone" className="pl-9" />
          </div>
          <Select name="status" defaultValue={status} aria-label="Status">
            <option value="">All statuses</option>
            <option value="unpaid">Unpaid / part paid</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <Input type="date" name="from" defaultValue={from} aria-label="From date" />
          <Input type="date" name="to" defaultValue={to} aria-label="To date" />
          <button className={buttonClass("secondary")}>Apply</button>
        </form>
        {page.length ? (
          <Table>
            <thead>
              <tr>
                <th className={th}>Invoice</th><th className={th}>Customer</th><th className={th}>Payment</th>
                <th className={`${th} text-right`}>Items</th><th className={`${th} text-right`}>Total</th><th className={th}>Status</th><th className={th} />
              </tr>
            </thead>
            <tbody>
              {page.map((r) => (
                <tr key={r.id} className="group hover:bg-surface-2">
                  <td className={td}>
                    <Link href={`/invoices/${r.id}`} className="font-mono text-[13px] font-semibold text-primary hover:underline">{r.invoice_no}</Link>
                    <p className="text-xs text-ink-3">{dateLabel(r.invoice_date)} · {timeLabel(r.created_at)}</p>
                  </td>
                  <td className={td}><p className="max-w-[260px] truncate font-medium">{r.customer_name}</p><p className="text-xs text-ink-3">{r.customer_phone}</p></td>
                  <td className={td}>{r.payment_mode}</td>
                  <td className={`${td} text-right`}>{r.items}</td>
                  <td className={`${td} text-right font-semibold`}>
                    {rupees(r.total)}
                    {r.status === "partial" || r.status === "due" ? <p className="text-xs font-medium text-warn">Due {rupees(r.total - r.amount_paid)}</p> : null}
                  </td>
                  <td className={td}><InvoiceStatus status={r.status} /></td>
                  <td className={`${td} w-8`}><Link href={`/invoices/${r.id}`} aria-label={`Open ${r.invoice_no}`}><ChevronRight className="h-4 w-4 text-ink-3 group-hover:text-ink" /></Link></td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty icon={<FileText className="h-8 w-8" />} title="No invoices match">Try a different search or date range.</Empty>
        )}
        <div className="flex items-center justify-between gap-3 p-4 text-sm text-ink-2">
          <span>{after ? <Link href={qs({})} className="font-semibold text-primary hover:underline">← Back to newest</Link> : "Newest first"}</span>
          {more ? <LinkButton href={qs({ after: String(page[page.length - 1].id) })} size="sm">Older invoices →</LinkButton> : null}
        </div>
      </Card>
    </>
  );
}

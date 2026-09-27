import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone } from "lucide-react";
import { Card, CardHeader, InvoiceStatus, Notice, PageHeader, Table, td, th } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { dateLabel, rupees } from "@/lib/format";
import { CustomerEdit } from "./CustomerEdit";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params, searchParams }: PageProps<"/customers/[id]">) {
  await requireUser();
  const { id } = await params;
  const { saved } = await searchParams;
  if (!/^\d+$/.test(id)) notFound();
  const [[c], invoices, [s]] = await Promise.all([
    sql`select * from customers where id = ${id}`,
    sql<{ id: number; invoice_no: string; invoice_date: string; total: number; amount_paid: number; status: string; payment_mode: string }[]>`
      select id, invoice_no, to_char(invoice_date, 'YYYY-MM-DD') as invoice_date, total, amount_paid, status, payment_mode
      from invoices where customer_id = ${id} order by invoice_date desc, id desc limit 100`,
    sql<{ due: number; spent: number; bills: number }[]>`
      select coalesce(sum(total - amount_paid) filter (where status in ('due','partial')), 0) as due,
             coalesce(sum(total) filter (where status <> 'cancelled'), 0) as spent,
             count(*) filter (where status <> 'cancelled')::int as bills
      from invoices where customer_id = ${id}`,
  ]);
  if (!c) notFound();

  return (
    <>
      <Link href="/customers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Customers</Link>
      <PageHeader title={c.name} sub={c.phone ? <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {c.phone}</span> : "No phone saved"} />
      {saved ? <div className="mb-5"><Notice tone="good">Customer details saved.</Notice></div> : null}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Balance to collect" value={rupees(s.due)} warn={s.due > 0} />
        <Stat label="Total bought" value={rupees(s.spent)} />
        <Stat label="Bills" value={String(s.bills)} />
      </div>
      {c.credit_limit > 0 && s.due > c.credit_limit ? <div className="mb-5"><Notice tone="bad">Over credit limit of {rupees(c.credit_limit)}.</Notice></div> : null}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Bills" sub="Open a bill to record a payment against it" />
          <Table>
            <thead><tr><th className={th}>Invoice</th><th className={th}>Date</th><th className={th}>Paid by</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Balance</th><th className={th}>Status</th></tr></thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="hover:bg-surface-2">
                  <td className={td}><Link href={`/invoices/${i.id}`} className="font-mono text-[13px] font-semibold text-primary hover:underline">{i.invoice_no}</Link></td>
                  <td className={td}>{dateLabel(i.invoice_date)}</td>
                  <td className={td}>{i.payment_mode}</td>
                  <td className={`${td} text-right`}>{rupees(i.total)}</td>
                  <td className={`${td} text-right font-semibold`}>{i.status === "due" || i.status === "partial" ? <span className="text-warn">{rupees(i.total - i.amount_paid)}</span> : "—"}</td>
                  <td className={td}><InvoiceStatus status={i.status} /></td>
                </tr>
              ))}
              {!invoices.length ? <tr><td className={td} colSpan={6}>No bills yet.</td></tr> : null}
            </tbody>
          </Table>
        </Card>
        <CustomerEdit customer={{ id: c.id, name: c.name, phone: c.phone ?? "", gstin: c.gstin, address: c.address, credit_limit: c.credit_limit }} />
      </div>
    </>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="text-[13px] text-ink-2">{label}</p>
      <p className={`num mt-2 text-2xl font-bold ${warn ? "text-warn" : ""}`}>{value}</p>
    </div>
  );
}

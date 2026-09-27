import type { Metadata } from "next";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { Badge, buttonClass, Card, Empty, Input, LinkButton, PageHeader, Select, Table, td, th } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { count, dateLabel, rupees } from "@/lib/format";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const dues = sp.show === "dues";
  const after = typeof sp.after === "string" && /^\d+$/.test(sp.after) ? Number(sp.after) : 0;

  const rows = await sql<{ id: number; name: string; phone: string | null; gstin: string; due: number; bills: number; last: string | null; spent: number }[]>`
    select c.id, c.name, c.phone, c.gstin, s.due, s.bills, s.last, s.spent
    from customers c
    cross join lateral (
      select coalesce(sum(total - amount_paid) filter (where status in ('due','partial')), 0) as due,
             count(*) filter (where status <> 'cancelled')::int as bills,
             to_char(max(invoice_date), 'YYYY-MM-DD') as last,
             coalesce(sum(total) filter (where status <> 'cancelled'), 0) as spent
      from invoices i where i.customer_id = c.id
    ) s
    where true
      ${q ? sql`and (lower(c.name) like ${"%" + q.toLowerCase() + "%"} or c.phone like ${q.replace(/\D/g, "") + "%"})` : sql``}
      ${dues ? sql`and s.due > 0` : sql``}
      ${after ? sql`and c.id < ${after}` : sql``}
    order by ${dues ? sql`s.due desc, c.id desc` : sql`c.id desc`}
    limit 51`;
  const [tot] = await sql<{ n: number; due: number }[]>`
    select (select count(*)::int from customers) as n,
           (select coalesce(sum(total - amount_paid), 0) from invoices where status in ('due','partial') and customer_id is not null) as due`;
  const more = rows.length > 50;
  const page = more ? rows.slice(0, 50) : rows;

  return (
    <>
      <PageHeader title="Customers" sub={`${count(tot.n)} customers · ${rupees(tot.due)} to collect`}
        actions={<LinkButton href="/customers?show=dues" variant={dues ? "primary" : "secondary"}>Who owes money</LinkButton>} />
      <Card>
        <form className="grid grid-cols-1 gap-3 border-b border-line p-4 sm:grid-cols-[minmax(0,1fr)_200px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <Input name="q" defaultValue={q} placeholder="Name or phone" className="pl-9" />
          </div>
          <Select name="show" defaultValue={dues ? "dues" : ""}><option value="">All customers</option><option value="dues">With unpaid bills</option></Select>
          <button className={buttonClass("secondary")}>Search</button>
        </form>
        {page.length ? (
          <Table>
            <thead><tr><th className={th}>Customer</th><th className={th}>Phone</th><th className={`${th} text-right`}>Bills</th><th className={`${th} text-right`}>Total bought</th><th className={th}>Last bill</th><th className={`${th} text-right`}>Owes</th></tr></thead>
            <tbody>
              {page.map((c) => (
                <tr key={c.id} className="hover:bg-surface-2">
                  <td className={td}><Link href={`/customers/${c.id}`} className="font-medium text-primary hover:underline">{c.name}</Link>{c.gstin ? <p className="font-mono text-xs text-ink-3">{c.gstin}</p> : null}</td>
                  <td className={td}>{c.phone || "—"}</td>
                  <td className={`${td} text-right`}>{c.bills}</td>
                  <td className={`${td} text-right`}>{rupees(c.spent)}</td>
                  <td className={td}>{c.last ? dateLabel(c.last) : "—"}</td>
                  <td className={`${td} text-right`}>{c.due > 0 ? <Badge tone="warn">{rupees(c.due)}</Badge> : <span className="text-ink-3">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <Empty icon={<Users className="h-8 w-8" />} title="No customers found">Customers are saved automatically when you bill with a phone number.</Empty>}
        {more ? <div className="flex justify-end p-4"><LinkButton size="sm" href={`/customers?${new URLSearchParams({ ...(q && { q }), ...(dues && { show: "dues" }), after: String(page[page.length - 1].id) })}`}>Next 50 →</LinkButton></div> : null}
      </Card>
    </>
  );
}

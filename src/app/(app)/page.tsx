import Link from "next/link";
import { AlertTriangle, ArrowRight, Boxes, IndianRupee, ReceiptIndianRupee, Wallet } from "lucide-react";
import { AreaChart } from "@/components/charts";
import { Badge, Card, CardHeader, Empty, InvoiceStatus, LinkButton, Notice, PageHeader, StockBadge, Table, td, th } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { count, dateLabel, isoDate, rupees, rupeesShort, timeLabel } from "@/lib/format";
import { estimatedProductCount } from "@/lib/products";

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const owner = user.role === "owner";
  const now = new Date();
  const today = isoDate(now);
  const monthStart = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const from30 = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));

  const [[kpi], series, recent, low, [lowCount], top, parts] = await Promise.all([
    sql<{ today: number; today_n: number; month: number; month_n: number; month_profit: number; dues: number; due_n: number }[]>`
      select
        coalesce(sum(total) filter (where invoice_date = ${today}), 0) as today,
        count(*) filter (where invoice_date = ${today})::int as today_n,
        coalesce(sum(total) filter (where invoice_date >= ${monthStart}), 0) as month,
        count(*) filter (where invoice_date >= ${monthStart})::int as month_n,
        coalesce(sum(taxable - cost_total) filter (where invoice_date >= ${monthStart}), 0) as month_profit,
        (select coalesce(sum(total - amount_paid), 0) from invoices where status in ('due','partial')) as dues,
        (select count(*)::int from invoices where status in ('due','partial')) as due_n
      from invoices where invoice_date >= least(${monthStart}::date, ${today}::date) and status <> 'cancelled'`,
    sql<{ date: string; value: number }[]>`
      select to_char(d, 'YYYY-MM-DD') as date, coalesce(sum(i.total), 0) as value
      from generate_series(${from30}::date, ${today}::date, '1 day') d
      left join invoices i on i.invoice_date = d::date and i.status <> 'cancelled'
      group by d order by d`,
    sql<{ id: number; invoice_no: string; customer_name: string; total: number; status: string; created_at: Date; payment_mode: string }[]>`
      select id, invoice_no, customer_name, total, status, created_at, payment_mode
      from invoices order by invoice_date desc, id desc limit 7`,
    sql<{ id: number; sku: string; name: string; stock: number; reorder_level: number }[]>`
      select id, sku, name, stock, reorder_level from products
      where active and stock <= reorder_level order by stock, id limit 7`,
    sql<{ n: number }[]>`select count(*)::int as n from (select 1 from products where active and stock <= reorder_level limit 10001) x`,
    sql<{ product_id: number; name: string; sku: string; qty: number; amount: number }[]>`
      select it.product_id, min(it.name) as name, min(it.sku) as sku, sum(it.qty)::int as qty, sum(it.taxable) as amount
      from invoice_items it join invoices i on i.id = it.invoice_id
      where i.invoice_date >= ${monthStart} and i.status <> 'cancelled'
      group by it.product_id order by amount desc limit 6`,
    estimatedProductCount(),
  ]);

  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const monthName = now.toLocaleDateString("en-IN", { month: "long" });

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user.name.split(" ")[0]}`}
        sub={now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        actions={
          <LinkButton href="/billing" variant="primary" size="lg">
            <ReceiptIndianRupee className="h-5 w-5" /> New bill
          </LinkButton>
        }
      />
      {denied ? <div className="mb-6"><Notice tone="warn">That page is only for the shop owner.</Notice></div> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={IndianRupee} label="Today's sales" value={rupees(kpi.today)} sub={`${kpi.today_n} bill${kpi.today_n === 1 ? "" : "s"}`} accent />
        <Kpi icon={ReceiptIndianRupee} label={`${monthName} sales`} value={rupeesShort(kpi.month)}
          sub={owner ? `${count(kpi.month_n)} bills · profit ${rupeesShort(kpi.month_profit)}` : `${count(kpi.month_n)} bills`} />
        <Kpi icon={Wallet} label="Credit to collect" value={rupeesShort(kpi.dues)} sub={`${kpi.due_n} unpaid bill${kpi.due_n === 1 ? "" : "s"}`} href="/invoices?status=unpaid" tone={kpi.dues > 0 ? "warn" : undefined} />
        <Kpi icon={Boxes} label="Parts in catalogue" value={count(parts)} sub={`${lowCount.n > 10000 ? "10,000+" : count(lowCount.n)} need reordering`} href="/products?stock=low" tone={lowCount.n > 0 ? "warn" : undefined} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title="Sales, last 30 days" sub={`${rupees(series.reduce((s, d) => s + d.value, 0))} in total`} />
          <div className="px-3 pt-3 pb-2">
            <AreaChart data={series} />
          </div>
        </Card>
        <Card>
          <CardHeader title={`Best sellers in ${monthName}`} sub="By sales value before GST" />
          {top.length ? (
            <ol className="divide-y divide-line">
              {top.map((t, i) => (
                <li key={t.product_id} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">{i + 1}</span>
                  <Link href={`/products/${t.product_id}`} className="min-w-0 flex-1 hover:underline">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="font-mono text-xs text-ink-3">{t.sku}</p>
                  </Link>
                  <div className="num text-right">
                    <p className="text-sm font-semibold">{rupees(t.amount)}</p>
                    <p className="text-xs text-ink-3">{count(t.qty)} sold</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Empty title="No sales yet this month" />
          )}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Recent bills" action={<Link href="/invoices" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">All invoices <ArrowRight className="h-4 w-4" /></Link>} />
          {recent.length ? (
            <Table>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-2">
                    <td className={td}>
                      <Link href={`/invoices/${r.id}`} className="font-mono text-[13px] font-medium text-primary hover:underline">{r.invoice_no}</Link>
                      <p className="text-xs text-ink-3">{dateLabel(r.created_at)} · {timeLabel(r.created_at)}</p>
                    </td>
                    <td className={td}><p className="max-w-[220px] truncate">{r.customer_name}</p></td>
                    <td className={td}><InvoiceStatus status={r.status} /></td>
                    <td className={`${td} text-right font-semibold`}>{rupees(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Empty title="No bills yet">Press <b>F2</b> or click New bill to make your first sale.</Empty>
          )}
        </Card>
        <Card>
          <CardHeader
            title={<span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warn" /> Reorder soon</span>}
            sub={`${lowCount.n > 10000 ? "10,000+" : count(lowCount.n)} parts at or below their reorder level`}
            action={<Link href="/products?stock=low" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">See all <ArrowRight className="h-4 w-4" /></Link>}
          />
          {low.length ? (
            <Table>
              <thead>
                <tr><th className={th}>Part</th><th className={`${th} text-right`}>Reorder at</th><th className={th}>Stock</th></tr>
              </thead>
              <tbody>
                {low.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-2">
                    <td className={td}>
                      <Link href={`/products/${p.id}`} className="hover:underline"><p className="max-w-[300px] truncate">{p.name}</p></Link>
                      <p className="font-mono text-xs text-ink-3">{p.sku}</p>
                    </td>
                    <td className={`${td} text-right text-ink-2`}>{p.reorder_level}</td>
                    <td className={td}><StockBadge stock={p.stock} reorder={p.reorder_level} /></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Empty title="All parts are well stocked" />
          )}
        </Card>
      </div>
      <p className="mt-6 text-center text-xs text-ink-3">
        <Badge tone="neutral">Tip</Badge> Press <b>F2</b> anywhere to start a new bill.
      </p>
    </>
  );
}

function Kpi({ icon: Icon, label, value, sub, href, accent, tone }: { icon: React.ElementType; label: string; value: string; sub: string; href?: string; accent?: boolean; tone?: "warn" }) {
  const body = (
    <div className={`h-full rounded-xl border p-5 transition-colors ${accent ? "border-transparent bg-primary text-primary-ink" : "border-line bg-surface hover:border-line-2"}`}>
      <div className="flex items-center justify-between">
        <p className={`text-[13px] font-medium ${accent ? "opacity-85" : "text-ink-2"}`}>{label}</p>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${accent ? "bg-white/15" : tone === "warn" ? "bg-warn-soft text-warn" : "bg-primary-soft text-primary"}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="num mt-3 text-[28px] leading-none font-bold tracking-tight">{value}</p>
      <p className={`mt-2 text-[13px] ${accent ? "opacity-85" : tone === "warn" ? "text-warn" : "text-ink-3"}`}>{sub}</p>
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

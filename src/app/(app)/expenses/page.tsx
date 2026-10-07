import type { Metadata } from "next";
import Link from "next/link";
import { Download, Wallet } from "lucide-react";
import { BarList } from "@/components/charts";
import { DateRangePicker } from "@/components/DatePicker";
import { Badge, buttonClass, Card, CardHeader, cx, Empty, PageHeader, Table, td, th } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { BUSINESSES } from "@/lib/expenses";
import { dateLabel, isoDate, rupees } from "@/lib/format";
import { DeleteExpense, ExpenseForm } from "./ExpenseForm";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const user = await requireUser();
  const owner = user.role === "owner";
  const sp = await searchParams;
  const now = new Date();
  const ok = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const from = ok(sp.from) ? sp.from : isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = ok(sp.to) ? sp.to : isoDate(now);
  const cat = typeof sp.category === "string" ? sp.category : "";
  const biz = typeof sp.business === "string" && sp.business in BUSINESSES ? sp.business : "";
  const filter = sql`${cat ? sql`and e.category = ${cat}` : sql``} ${biz ? sql`and e.business = ${biz}` : sql``}`;
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ from, to, ...(cat ? { category: cat } : {}), ...(biz ? { business: biz } : {}), ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `/expenses?${p}`;
  };

  const [rows, byCategory, [tot], recentCats, byBusiness] = await Promise.all([
    sql<{ id: number; expense_date: string; category: string; amount: number; payment_mode: string; paid_to: string; note: string; business: string; user_name: string | null }[]>`
      select e.id, to_char(e.expense_date, 'YYYY-MM-DD') as expense_date, e.category, e.amount, e.payment_mode, e.paid_to, e.note, e.business, u.name as user_name
      from expenses e left join users u on u.id = e.user_id
      where e.expense_date between ${from} and ${to} ${filter}
      order by e.expense_date desc, e.id desc limit 500`,
    sql<{ label: string; value: number; n: number }[]>`
      select category as label, sum(amount) as value, count(*)::int as n
      from expenses e where expense_date between ${from} and ${to} ${biz ? sql`and e.business = ${biz}` : sql``} group by 1 order by 2 desc`,
    sql<{ total: number; n: number }[]>`
      select coalesce(sum(amount), 0) as total, count(*)::int as n from expenses e
      where expense_date between ${from} and ${to} ${filter}`,
    sql<{ category: string }[]>`select category from expenses group by category order by count(*) desc, category limit 30`,
    sql<{ business: string; total: number }[]>`
      select business, sum(amount) as total from expenses e where expense_date between ${from} and ${to} ${cat ? sql`and e.category = ${cat}` : sql``} group by 1`,
  ]);
  const bizTotal = (b: string) => Number(byBusiness.find((x) => x.business === b)?.total ?? 0);
  const allTotal = byBusiness.reduce((s, x) => s + Number(x.total), 0);

  const presets = [
    { label: "This month", from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(now) },
    { label: "Last month", from: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: isoDate(new Date(now.getFullYear(), now.getMonth(), 0)) },
    { label: "This year", from: isoDate(new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 1)), to: isoDate(now) },
  ];

  return (
    <>
      <PageHeader
        title="Expenses"
        sub={`${dateLabel(from)} – ${dateLabel(to)} · ${rupees(tot.total)} across ${tot.n} expense${tot.n === 1 ? "" : "s"}`}
        actions={owner ? <a href={`/api/reports/export?type=expenses&from=${from}&to=${to}`} className={buttonClass("secondary")}><Download className="h-4 w-4" /> Expenses CSV</a> : null}
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <form className="flex flex-wrap items-end gap-2 p-4">
              <div className="flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1">
                {presets.map((p) => (
                  <Link key={p.label} href={`/expenses?from=${p.from}&to=${p.to}`}
                    className={cx("rounded-md px-3 py-1.5 text-[13px] font-semibold", p.from === from && p.to === to && !cat ? "bg-surface text-ink shadow-sm ring-1 ring-line-2" : "text-ink-2 hover:text-ink")}>
                    {p.label}
                  </Link>
                ))}
              </div>
              <div className="ml-auto flex flex-wrap items-end gap-2">
                <DateRangePicker from={from} to={to} max={isoDate()} autoSubmit className="w-72 max-w-full" />
                {cat ? <input type="hidden" name="category" value={cat} /> : null}
                {biz ? <input type="hidden" name="business" value={biz} /> : null}
              </div>
            </form>
          </Card>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" role="tablist" aria-label="Business">
            {[["", "All businesses", allTotal], ...Object.entries(BUSINESSES).map(([k, b]) => [k, b.label, bizTotal(k)] as const)].map(([k, label, total]) => (
              <Link key={label} href={qs({ business: String(k) })} role="tab" aria-selected={biz === k}
                className={cx("rounded-xl border px-4 py-3 transition-colors", biz === k ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-line-2")}>
                <span className={cx("block text-[13px] font-semibold", biz === k ? "text-primary" : "text-ink-2")}>{label}</span>
                <span className="num mt-0.5 block text-lg font-bold">{rupees(Number(total))}</span>
              </Link>
            ))}
          </div>

          {byCategory.length ? (
            <Card>
              <CardHeader title="Where the money went" sub="Tap a category to see only those expenses"
                action={cat ? <Link href={qs({ category: "" })} className="text-sm font-semibold text-primary hover:underline">Show all</Link> : null} />
              <div className="grid grid-cols-1 gap-x-8 gap-y-3 p-5 md:grid-cols-2">
                {byCategory.map((c) => (
                  <Link key={c.label} href={qs({ category: cat === c.label ? "" : c.label })}
                    className={cx("rounded-lg p-2 -m-2 hover:bg-surface-2", cat === c.label && "bg-primary-soft")}>
                    <BarList items={[{ label: c.label, value: c.value, sub: `${c.n}×` }]} />
                  </Link>
                ))}
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader title={`${biz ? `${BUSINESSES[biz].label} · ` : ""}${cat ? `${cat} expenses` : "All expenses"}`} />
            {rows.length ? (
              <Table>
                <thead><tr><th className={th}>Date</th><th className={th}>Category</th><th className={th}>Business</th><th className={th}>Details</th><th className={th}>Paid by</th><th className={`${th} text-right`}>Amount</th>{owner ? <th className={th} /> : null}</tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-2">
                      <td className={`${td} whitespace-nowrap`}>{dateLabel(r.expense_date)}</td>
                      <td className={td}>{r.category}</td>
                      <td className={td}><Badge tone={r.business === "vehicles" ? "info" : r.business === "shared" ? "neutral" : "primary"}>{BUSINESSES[r.business]?.short ?? r.business}</Badge></td>
                      <td className={td}>
                        <p className="max-w-[280px] truncate">{[r.paid_to, r.note].filter(Boolean).join(" · ") || <span className="text-ink-3">—</span>}</p>
                        {r.user_name ? <p className="text-xs text-ink-3">Added by {r.user_name}</p> : null}
                      </td>
                      <td className={td}>{r.payment_mode}</td>
                      <td className={`${td} text-right font-semibold`}>{rupees(r.amount)}</td>
                      {owner ? <td className={`${td} w-10`}><DeleteExpense id={r.id} /></td> : null}
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Empty icon={<Wallet className="h-8 w-8" />} title="No expenses in this period">Add your first one with the form on the right.</Empty>
            )}
          </Card>
        </div>
        <ExpenseForm usedCategories={recentCats.map((c) => c.category)} business={biz || undefined} />
      </div>
    </>
  );
}

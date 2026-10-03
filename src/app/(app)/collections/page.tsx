import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, Building2, CreditCard, Download, FileCheck2, Smartphone, Wallet } from "lucide-react";
import { DateRangePicker } from "@/components/DatePicker";
import { buttonClass, Card, CardHeader, cx, Empty, PageHeader, Table, td, th } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { count, dateLabel, isoDate, rupees } from "@/lib/format";
import { collectionsReport } from "@/lib/reports";

export const metadata: Metadata = { title: "Money received" };

const ICON: Record<string, React.ElementType> = { Cash: Banknote, UPI: Smartphone, Card: CreditCard, Bank: Building2, Cheque: FileCheck2 };

export default async function CollectionsPage({ searchParams }: PageProps<"/collections">) {
  await requireUser("owner");
  const sp = await searchParams;
  const ok = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const today = isoDate();
  const from = ok(sp.from) ? sp.from : today;
  const to = ok(sp.to) ? sp.to : today;
  const r = await collectionsReport(from, to);
  const shown = r.methods.filter((m) => m.received || m.expenses || ["Cash", "UPI"].includes(m.mode));
  const cols = r.methods.filter((m) => m.received).map((m) => m.mode);

  return (
    <>
      <PageHeader
        title="Money received"
        sub={from === to ? dateLabel(from) : `${dateLabel(from)} – ${dateLabel(to)}`}
        actions={<a href={`/api/reports/export?type=payments&from=${from}&to=${to}`} className={buttonClass("secondary")}><Download className="h-4 w-4" /> Payments CSV</a>}
      />

      <Card className="mb-5">
        <form className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-ink-2">Money that actually came in — bill payments plus credit collected — by payment method.</p>
          <DateRangePicker from={from} to={to} max={today} autoSubmit className="w-72 max-w-full" />
        </form>
      </Card>

      <div className="mb-5 rounded-xl border border-transparent bg-primary p-6 text-primary-ink">
        <p className="text-[13px] font-medium opacity-85">Total received</p>
        <p className="num mt-2 text-[40px] leading-none font-bold tracking-tight">{rupees(r.total)}</p>
        <p className="mt-2 text-[13px] opacity-85">
          {r.collectedLater ? <>Includes {rupees(r.collectedLater)} of credit collected · </> : null}
          {rupees(r.expenses)} paid out as expenses · <b>{rupees(r.total - r.expenses)} net</b>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((m) => {
          const Icon = ICON[m.mode] ?? Wallet;
          return (
            <div key={m.mode} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{m.mode === "Cash" ? "Cash" : m.mode}</p>
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary"><Icon className="h-[18px] w-[18px]" /></span>
              </div>
              <p className="num mt-2 text-[28px] leading-none font-bold tracking-tight">{rupees(m.received)}</p>
              <p className="mt-1 text-[12.5px] text-ink-3">{count(m.payments)} payment{m.payments === 1 ? "" : "s"}</p>
              <dl className="num mt-4 grid grid-cols-[1fr_auto] gap-y-1 border-t border-line pt-3 text-[13px]">
                <dt className="text-ink-2">At billing</dt><dd className="text-right">{rupees(m.atBilling)}</dd>
                <dt className="text-ink-2">Credit collected</dt><dd className="text-right">{rupees(m.collectedLater)}</dd>
                <dt className="text-ink-2">− Expenses paid</dt><dd className="text-right text-warn">{rupees(m.expenses)}</dd>
                <dt className="pt-1 font-semibold">{m.mode === "Cash" ? "Cash in hand (net)" : "Net"}</dt>
                <dd className={cx("pt-1 text-right font-semibold", m.net < 0 && "text-bad")}>{rupees(m.net)}</dd>
              </dl>
            </div>
          );
        })}
      </div>

      <Card className="mt-5">
        <CardHeader title="Day by day" sub="Newest first" />
        {r.daily.length ? (
          <Table>
            <thead>
              <tr>
                <th className={th}>Date</th>
                {cols.map((c) => <th key={c} className={`${th} text-right`}>{c}</th>)}
                <th className={`${th} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {r.daily.map((d) => (
                <tr key={d.date} className="hover:bg-surface-2">
                  <td className={td}><Link className="hover:underline" href={`/collections?from=${d.date}&to=${d.date}`}>{dateLabel(d.date)}</Link></td>
                  {cols.map((c) => <td key={c} className={`${td} text-right`}>{d.byMode[c] ? rupees(d.byMode[c]) : <span className="text-ink-3">—</span>}</td>)}
                  <td className={`${td} text-right font-semibold`}>{rupees(d.total)}</td>
                </tr>
              ))}
              {r.daily.length > 1 ? (
                <tr className="bg-surface-2 font-semibold">
                  <td className={td}>Total</td>
                  {cols.map((c) => <td key={c} className={`${td} text-right`}>{rupees(r.methods.find((m) => m.mode === c)?.received ?? 0)}</td>)}
                  <td className={`${td} text-right`}>{rupees(r.total)}</td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        ) : (
          <Empty icon={<Wallet className="h-8 w-8" />} title="No money received in this period">Pick another date range above.</Empty>
        )}
      </Card>
    </>
  );
}

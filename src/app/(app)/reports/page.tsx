import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { Card, CardHeader, cx, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { count, dateLabel, rupees, rupees2 } from "@/lib/format";
import { combinedReport } from "@/lib/reports";
import { reportRange } from "./range";
import { ReportNav } from "./ReportNav";
import { Tile } from "./Tile";

export const metadata: Metadata = { title: "Reports" };

export default async function CombinedReportPage({ searchParams }: PageProps<"/reports">) {
  await requireUser("owner");
  const range = reportRange(await searchParams);
  const { from, to } = range;
  const r = await combinedReport(from, to);
  const money = (n: number) => <span className={cx(n < 0 && "text-bad")}>{rupees2(n)}</span>;

  // Rows of the side-by-side statement: [label, parts, bikes, indent?, strong?]
  const rows: [string, number | null, number | null, boolean?, boolean?][] = [
    ["Sales", Number(r.parts.taxable), Number(r.bikes.sales)],
    ["− Cost of what was sold", -Number(r.parts.cost), -Number(r.bikes.cost), true],
    ["Gross profit", r.parts.gross, r.bikes.gross, false, true],
    ["− Own expenses", -r.parts.expenseTotal, -r.bikes.expenseTotal, true],
    ["Business profit", r.parts.net, r.bikes.net, false, true],
  ];

  return (
    <>
      <PageHeader title="Reports" sub={`${dateLabel(from)} – ${dateLabel(to)} · both businesses together`} />
      <ReportNav active="/reports" range={range} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Spare parts profit" value={rupees(r.parts.net)} sub={`${count(r.parts.bills)} bills · ${rupees(r.parts.sales)} sales incl. GST`} tone={r.parts.net >= 0 ? "good" : "bad"} href={`/reports/parts?${range.query}`} />
        <Tile label="Used bikes profit" value={rupees(r.bikes.net)} sub={`${count(r.bikes.n)} bike${r.bikes.n === 1 ? "" : "s"} sold · ${rupees(r.bikes.sales)}`} tone={r.bikes.net >= 0 ? "good" : "bad"} href={`/reports/vehicles?${range.query}`} />
        <Tile label="Shared costs" value={rupees(r.shared.expenseTotal)} sub={r.shared.expenses.length ? `Rent, power and other costs both use` : "None recorded in this period"} tone={r.shared.expenseTotal ? "warn" : undefined} href={`/expenses?from=${from}&to=${to}&business=shared`} />
        <Tile label="Overall net profit" value={rupees(r.net)} sub="Both businesses − shared costs" tone={r.net >= 0 ? "good" : "bad"} strong />
      </div>

      <Card className="mt-4">
        <CardHeader title="Profit and loss, side by side" sub="Parts sales are counted before GST: GST collected belongs to the government, not to profit." />
        <div className="overflow-x-auto">
          <table className="num w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11.5px] tracking-wider text-ink-3 uppercase">
                <th className="px-5 py-2.5 font-semibold" />
                <th className="px-5 py-2.5 text-right font-semibold"><Link href={`/reports/parts?${range.query}`} className="hover:text-primary">Spare parts</Link></th>
                <th className="px-5 py-2.5 text-right font-semibold"><Link href={`/reports/vehicles?${range.query}`} className="hover:text-primary">Used bikes</Link></th>
                <th className="px-5 py-2.5 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, a, b, indent, strong]) => (
                <tr key={label} className={cx("border-b border-line", strong && "bg-surface-2/60 font-semibold")}>
                  <td className={cx("px-5 py-2.5", indent && "pl-8 text-ink-2")}>{label}</td>
                  <td className="px-5 py-2.5 text-right">{a == null ? "" : money(a)}</td>
                  <td className="px-5 py-2.5 text-right">{b == null ? "" : money(b)}</td>
                  <td className="px-5 py-2.5 text-right">{money((a ?? 0) + (b ?? 0))}</td>
                </tr>
              ))}
              <tr className="border-b border-line">
                <td className="px-5 py-2.5 pl-8 text-ink-2">− Shared costs (rent, power…)</td>
                <td colSpan={2} className="px-5 py-2.5 text-center text-xs text-ink-3">not split between businesses</td>
                <td className="px-5 py-2.5 text-right">{money(-r.shared.expenseTotal)}</td>
              </tr>
              <tr className="text-base font-bold">
                <td className="px-5 py-3">{r.net >= 0 ? "Net profit" : "Net loss"}</td>
                <td colSpan={2} />
                <td className={cx("px-5 py-3 text-right", r.net < 0 ? "text-bad" : "text-good")}>{rupees2(r.net)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {([["Spare parts expenses", r.parts.expenses, "parts"], ["Used bikes expenses", r.bikes.expenses, "vehicles"], ["Shared costs", r.shared.expenses, "shared"]] as const).map(([title, list, biz]) => (
          <Card key={biz}>
            <CardHeader title={title} action={<Link href={`/expenses?from=${from}&to=${to}&business=${biz}`} className="text-sm font-semibold text-primary hover:underline">View</Link>} />
            {list.length ? (
              <dl className="num grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 px-5 py-4 text-sm">
                {list.map((e) => <Fragment key={e.category}><dt className="truncate text-ink-2">{e.category}</dt><dd className="text-right">{rupees(e.value)}</dd></Fragment>)}
              </dl>
            ) : <p className="px-5 py-4 text-sm text-ink-3">None in this period.</p>}
          </Card>
        ))}
      </div>
    </>
  );
}

import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { BarList } from "@/components/charts";
import { NumberPlate } from "@/components/NumberPlate";
import { buttonClass, Card, CardHeader, cx, Empty, PageHeader, Table, td, th } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { count, dateLabel, rupees, rupees2 } from "@/lib/format";
import { EVENT_KINDS } from "@/lib/regno";
import { vehicleReport } from "@/lib/reports";
import { financeSummary } from "@/lib/vehicles";
import { reportRange } from "../range";
import { ReportNav } from "../ReportNav";
import { Tile } from "../Tile";

export const metadata: Metadata = { title: "Used bikes report" };

export default async function VehiclesReportPage({ searchParams }: PageProps<"/reports/vehicles">) {
  await requireUser("owner");
  const range = reportRange(await searchParams);
  const { from, to } = range;
  const [r, finance] = await Promise.all([vehicleReport(from, to), financeSummary()]);
  const under = finance.find((f) => f.key === "under")!;
  const servicedBikes = new Set(r.services.filter((x) => Number(x.cost) > 0).map((x) => x.vehicle_id)).size;
  const csv = (type: string) => `/api/reports/export?type=${type}&from=${from}&to=${to}`;
  const s = r.summary;
  const net = r.netProfit;

  return (
    <>
      <PageHeader title="Used bikes report" sub={`${dateLabel(from)} – ${dateLabel(to)} · bikes bought and sold, profit and bike expenses`}
        actions={<a href={csv("bikes")} className={buttonClass("secondary")}><Download className="h-4 w-4" /> Bike sales CSV</a>} />
      <ReportNav active="/reports/vehicles" range={range} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Tile label="Bikes sold" value={count(s.n)} sub={`${rupees(s.revenue)} in sales${s.avgDays != null ? ` · ${s.avgDays} days in stock on average` : ""}`} />
        <Tile label="Spent buying bikes" value={rupees(Number(r.bought.spent))}
          sub={`${count(r.bought.n)} bike${r.bought.n === 1 ? "" : "s"} · ${rupees(r.bought.owners)} to owners + ${rupees(r.bought.financiers)} to financiers${r.bought.loans ? ` (${r.bought.loans} loan${r.bought.loans === 1 ? "" : "s"} closed)` : ""}`} />
        <Tile label="Spent servicing bikes" value={rupees(Number(r.refurb.spent))} sub={`${count(r.refurb.jobs)} job${r.refurb.jobs === 1 ? "" : "s"} on ${servicedBikes} bike${servicedBikes === 1 ? "" : "s"} · service, repairs, parts`} />
        <Tile label="Profit on bikes sold" value={rupees(s.profit)} sub={s.revenue ? `${((s.profit / s.revenue) * 100).toFixed(1)}% margin · after repairs and loan closures` : "No bikes sold in this period"} tone={s.profit >= 0 ? "good" : "bad"} />
        <Tile label="Bike business expenses" value={rupees(r.expenseTotal)} sub={r.expenses.length ? `Largest: ${r.expenses[0].label}` : "None recorded in this period"} tone={r.expenseTotal ? "warn" : undefined} href={`/expenses?from=${from}&to=${to}&business=vehicles`} />
        <Tile label="Used bikes net profit" value={rupees(net)} sub="Profit on bikes sold − bike expenses. Shared costs are in Combined." tone={net >= 0 ? "good" : "bad"} strong />
        <Tile label="In stock now" value={count(r.stock.n)} sub={`${rupees(r.stock.invested)} invested · asking ${rupees(r.stock.asking)}${r.stock.aged ? ` · ${r.stock.aged} older than 60 days` : ""}`} tone={r.stock.aged ? "warn" : undefined} href="/vehicles" />
        <Tile label="Loans the shop must pay" value={rupees(r.owedTotal)}
          sub={r.owed.length ? `${r.owed.length} bike${r.owed.length === 1 ? "" : "s"} · ${[...new Set(r.owed.map((x) => x.financier))].join(", ")}` : `Nothing owed to financiers${under.n ? ` · ${under.n} bike${under.n === 1 ? "" : "s"} under finance (owner pays)` : ""}`}
          tone={r.owedTotal ? "bad" : undefined} href="#owed" />
        <Tile label="Sold on finance" value={count(r.soldOnFinance.n)} sub={r.soldOnFinance.n ? `${rupees(r.soldOnFinance.value)} paid by buyers' loan companies` : "Buyers who paid through a finance company"} />
      </div>

      <Card className="mt-4">
        <CardHeader title="Month by month" sub="Bikes bought, serviced and sold in each month. Loan closures count in the month the loan was closed." />
        <Table>
          <thead>
            <tr>
              <th className={th}>Month</th>
              <th className={`${th} text-right`}>Bought</th><th className={`${th} text-right`}>Paid to owners</th><th className={`${th} text-right`}>Paid to financiers</th>
              <th className={`${th} text-right`}>Serviced</th><th className={`${th} text-right`}>Service spend</th>
              <th className={`${th} text-right`}>Sold</th><th className={`${th} text-right`}>Sales</th><th className={`${th} text-right`}>Profit</th>
            </tr>
          </thead>
          <tbody>
            {r.monthly.map((m) => (
              <tr key={m.month} className="hover:bg-surface-2">
                <td className={`${td} whitespace-nowrap font-medium`}>{new Date(m.month + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</td>
                <td className={`${td} text-right`}>{count(m.bought)}</td>
                <td className={`${td} text-right`}>{rupees(m.bought_spend)}</td>
                <td className={`${td} text-right`}>{Number(m.loan_spend) ? rupees(m.loan_spend) : <span className="text-ink-3">—</span>}</td>
                <td className={`${td} text-right`}>{count(m.serviced)} <span className="text-xs text-ink-3">({m.jobs} job{m.jobs === 1 ? "" : "s"})</span></td>
                <td className={`${td} text-right`}>{rupees(m.service_spend)}</td>
                <td className={`${td} text-right`}>{count(m.sold)}</td>
                <td className={`${td} text-right font-semibold`}>{rupees(m.sales)}</td>
                <td className={cx(td, "text-right font-semibold", Number(m.profit) < 0 ? "text-bad" : "text-good")}>{rupees(m.profit)}</td>
              </tr>
            ))}
            {r.monthly.length > 1 ? (
              <tr className="bg-surface-2 font-semibold">
                <td className={td}>Total</td>
                <td className={`${td} text-right`}>{count(r.bought.n)}</td>
                <td className={`${td} text-right`}>{rupees(r.bought.owners)}</td>
                <td className={`${td} text-right`}>{rupees(r.bought.financiers)}</td>
                <td className={`${td} text-right`}>{servicedBikes}</td>
                <td className={`${td} text-right`}>{rupees(r.refurb.spent)}</td>
                <td className={`${td} text-right`}>{count(s.n)}</td>
                <td className={`${td} text-right`}>{rupees(s.revenue)}</td>
                <td className={cx(td, "text-right", s.profit < 0 ? "text-bad" : "text-good")}>{rupees(s.profit)}</td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <Card>
          <CardHeader title="Bikes bought" sub={`${count(r.bought.n)} bikes · cost = paid to owner + loan closure we paid`}
            action={r.purchases.length ? <a href={csv("bike_purchases")} className={buttonClass("secondary", "sm")}><Download className="h-4 w-4" /> CSV</a> : null} />
          {r.purchases.length ? (
            <Table>
              <thead><tr><th className={th}>Bike</th><th className={th}>Bought</th><th className={`${th} text-right`}>To owner</th><th className={`${th} text-right`}>Seller&apos;s loan</th><th className={`${th} text-right`}>Cost</th></tr></thead>
              <tbody>
                {r.purchases.map((x) => (
                  <tr key={x.id} className="hover:bg-surface-2">
                    <td className={td}>
                      <Link href={`/vehicles/${x.id}`} className="flex items-center gap-3">
                        <NumberPlate reg={x.reg_no} size="sm" />
                        <span className="font-medium hover:underline">{[x.make, x.model].filter(Boolean).join(" ")}</span>
                      </Link>
                    </td>
                    <td className={td}><p className="whitespace-nowrap">{dateLabel(x.purchase_date)}</p>{x.purchased_from ? <p className="text-xs text-ink-3">{x.purchased_from}</p> : null}</td>
                    <td className={`${td} text-right`}>{x.purchase_price != null ? rupees(x.purchase_price) : "—"}</td>
                    <td className={`${td} text-right`}>
                      {Number(x.loan) ? <><p>{rupees(x.loan)}</p><p className="text-xs text-ink-3">{x.financier} · {x.payer === "buyer" ? "buyer pays" : x.loan_status === "active" ? "we pay, not paid yet" : "paid by us"}</p></> : <span className="text-ink-3">—</span>}
                    </td>
                    <td className={`${td} text-right font-semibold`}>{rupees(Number(x.purchase_price ?? 0) + Number(x.loan))}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : <p className="px-5 py-6 text-sm text-ink-3">No bikes bought in this period.</p>}
        </Card>
        <Card>
          <CardHeader title="Service and repair jobs" sub={`${count(r.refurb.jobs)} paid jobs · ${rupees(r.refurb.spent)} spent`}
            action={r.services.length ? <a href={csv("bike_services")} className={buttonClass("secondary", "sm")}><Download className="h-4 w-4" /> CSV</a> : null} />
          {r.services.length ? (
            <Table>
              <thead><tr><th className={th}>Bike</th><th className={th}>Work</th><th className={`${th} text-right`}>Cost</th></tr></thead>
              <tbody>
                {r.services.map((x) => (
                  <tr key={x.id} className="hover:bg-surface-2">
                    <td className={td}>
                      <Link href={`/vehicles/${x.vehicle_id}`} className="flex flex-col gap-1">
                        <NumberPlate reg={x.reg_no} size="sm" className="self-start" />
                        <span className="text-xs text-ink-3">{[x.make, x.model].filter(Boolean).join(" ")}</span>
                      </Link>
                    </td>
                    <td className={td}>
                      <p className="max-w-[320px]"><span className="font-medium">{EVENT_KINDS[x.kind] ?? x.kind}</span> · {x.title}</p>
                      <p className="text-xs text-ink-3">{dateLabel(x.event_date)}</p>
                    </td>
                    <td className={`${td} text-right font-semibold`}>{rupees(x.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : <p className="px-5 py-6 text-sm text-ink-3">No service or repair work recorded in this period.</p>}
        </Card>
      </div>

      <Card className="mt-4" id="owed">
        <CardHeader title="Loans the shop must pay" sub="Bikes where the shop agreed to clear the seller's loan and hasn't paid the financier yet. Loans the seller or the buyer clears are not listed."
          action={r.owedTotal ? <span className="num text-lg font-bold text-bad">{rupees(r.owedTotal)}</span> : null} />
        {r.owed.length ? (
          <Table>
            <thead><tr><th className={th}>Bike</th><th className={th}>Financier</th><th className={th}>Bought</th><th className={`${th} text-right`}>To pay</th></tr></thead>
            <tbody>
              {r.owed.map((x) => (
                <tr key={x.id} className="hover:bg-surface-2">
                  <td className={td}>
                    <Link href={`/vehicles/${x.id}`} className="flex items-center gap-3">
                      <NumberPlate reg={x.reg_no} size="sm" />
                      <span className="font-medium hover:underline">{[x.make, x.model].filter(Boolean).join(" ")}</span>
                      {x.status === "sold" ? <span className="text-xs font-semibold text-bad">already sold</span> : null}
                    </Link>
                  </td>
                  <td className={td}>{x.financier || "—"}</td>
                  <td className={`${td} whitespace-nowrap text-ink-2`}>{x.purchase_date ? dateLabel(x.purchase_date) : "—"}</td>
                  <td className={`${td} text-right font-semibold`}>{Number(x.amount) ? rupees(x.amount) : <span className="text-warn">amount not entered</span>}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <p className="px-5 py-4 text-sm text-ink-3">Nothing owed. When you pay a financier, set the bike&apos;s loan status to <b>Loan closed</b> and enter the closed date.</p>}
      </Card>

      <Card className="mt-4">
        <CardHeader title="Bikes in stock by finance" sub="Loans on bikes we hold right now"
          action={<Link href="/vehicles?finance=under" className="text-sm font-semibold text-primary hover:underline">Open list</Link>} />
        <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 xl:divide-x">
          {finance.map((f) => (
            <Link key={f.key} href={`/vehicles?finance=${f.key}`} className="block px-5 py-4 hover:bg-surface-2">
              <p className="text-[13px] font-semibold text-ink-2">{f.label}</p>
              <p className="num mt-1 text-2xl font-bold">{count(f.n)}</p>
              {f.financiers.length ? (
                <ul className="mt-2 flex flex-col gap-0.5 text-xs text-ink-2">
                  {f.financiers.map((x) => <li key={x.name} className="flex justify-between gap-2"><span className="truncate">{x.name}</span><span className="num">{x.n}{f.key === "under" && x.toClose ? ` · ${rupees(x.toClose)}` : ""}</span></li>)}
                </ul>
              ) : <p className="mt-2 text-xs text-ink-3">{f.key === "clear" ? "No loan on the RC" : "None"}</p>}
            </Link>
          ))}
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Used bikes profit and loss" sub="For bikes sold in this period. Cost = bought price + service and repairs + loan closure we paid." />
        <dl className="num grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-2 px-5 py-4 text-sm sm:max-w-xl">
          <dt>Bike sales</dt><dd className="text-right">{rupees2(s.revenue)}</dd>
          <dt className="pl-3 text-ink-2">− Bought price</dt><dd className="text-right text-ink-2">{rupees2(s.cost - s.refurb - s.loan)}</dd>
          <dt className="pl-3 text-ink-2">− Service and repairs</dt><dd className="text-right text-ink-2">{rupees2(s.refurb)}</dd>
          {s.loan ? <><dt className="pl-3 text-ink-2">− Seller loans cleared (by us or the buyer)</dt><dd className="text-right text-ink-2">{rupees2(s.loan)}</dd></> : null}
          <dt className="border-t border-line pt-2 font-semibold">Profit on bikes sold</dt><dd className="border-t border-line pt-2 text-right font-semibold">{rupees2(s.profit)}</dd>
          {r.expenses.map((e) => (
            <Fragment key={e.label}><dt className="pl-3 text-ink-2">− {e.label}</dt><dd className="text-right text-ink-2">{rupees2(e.value)}</dd></Fragment>
          ))}
          <dt className={cx("border-t-2 border-ink pt-2 text-base font-bold", net < 0 && "text-bad")}>{net >= 0 ? "Net profit" : "Net loss"}</dt>
          <dd className={cx("border-t-2 border-ink pt-2 text-right text-base font-bold", net < 0 ? "text-bad" : "text-good")}>{rupees2(net)}</dd>
        </dl>
      </Card>

      {s.n ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card><CardHeader title="Sales by make" /><div className="p-5"><BarList items={r.byMake.map((m) => ({ label: m.label, value: m.value, sub: `${m.n} sold · profit ${rupees(m.profit)}` }))} /></div></Card>
            <Card><CardHeader title="How buyers paid" /><div className="p-5"><BarList items={r.byMode.map((m) => ({ label: m.label, value: m.value, sub: `${m.n} bike${m.n === 1 ? "" : "s"}` }))} /></div></Card>
          </div>
          <Card className="mt-4">
            <CardHeader title="Bikes sold" sub="Newest first" />
            <Table>
              <thead>
                <tr>
                  <th className={th}>Bike</th><th className={th}>Sold</th><th className={`${th} text-right`}>Cost</th>
                  <th className={`${th} text-right`}>Sold for</th><th className={`${th} text-right`}>Profit</th><th className={`${th} text-right`}>Days</th>
                </tr>
              </thead>
              <tbody>
                {r.sales.map((x) => (
                  <tr key={x.id} className="hover:bg-surface-2">
                    <td className={td}>
                      <Link href={`/vehicles/${x.id}`} className="flex items-center gap-3">
                        <NumberPlate reg={x.reg_no} size="sm" />
                        <span className="min-w-[140px]"><span className="block font-medium hover:underline">{[x.make, x.model].filter(Boolean).join(" ")}</span>
                          <span className="block text-xs text-ink-3">{x.mfg_year ?? ""}</span></span>
                      </Link>
                    </td>
                    <td className={td}><p className="whitespace-nowrap">{dateLabel(x.sold_on)}</p><p className="text-xs text-ink-3">{[x.sold_to, x.sold_payment_mode].filter(Boolean).join(" · ")}</p></td>
                    <td className={`${td} text-right text-ink-2`} title={`Bought ${rupees(x.bought)} + repairs ${rupees(x.refurb)}${Number(x.loan) ? ` + loan ${rupees(x.loan)}` : ""}`}>{rupees(x.cost)}</td>
                    <td className={`${td} text-right font-semibold`}>{rupees(x.sold_price)}</td>
                    <td className={cx(td, "text-right font-semibold", Number(x.profit) < 0 ? "text-bad" : "text-good")}>{rupees(x.profit)}</td>
                    <td className={`${td} text-right text-ink-2`}>{x.days ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      ) : (
        <Card className="mt-4"><Empty title="No bikes sold in this period">Pick another date range above.</Empty></Card>
      )}
    </>
  );
}

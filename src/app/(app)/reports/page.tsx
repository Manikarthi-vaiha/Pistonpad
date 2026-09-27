import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { AreaChart, BarList } from "@/components/charts";
import { buttonClass, Card, CardHeader, cx, Empty, Input, PageHeader, Table, td, th } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { count, dateLabel, isoDate, rupees, rupees2 } from "@/lib/format";
import { salesReport } from "@/lib/reports";

export const metadata: Metadata = { title: "Reports" };

function presets() {
  const n = new Date();
  const d = (y: number, m: number, day: number) => isoDate(new Date(y, m, day));
  const fyStart = n.getMonth() >= 3 ? n.getFullYear() : n.getFullYear() - 1;
  return [
    { key: "today", label: "Today", from: isoDate(n), to: isoDate(n) },
    { key: "7d", label: "Last 7 days", from: d(n.getFullYear(), n.getMonth(), n.getDate() - 6), to: isoDate(n) },
    { key: "month", label: "This month", from: d(n.getFullYear(), n.getMonth(), 1), to: isoDate(n) },
    { key: "lastmonth", label: "Last month", from: d(n.getFullYear(), n.getMonth() - 1, 1), to: d(n.getFullYear(), n.getMonth(), 0) },
    { key: "fy", label: "This financial year", from: d(fyStart, 3, 1), to: isoDate(n) },
  ];
}

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  await requireUser("owner");
  const sp = await searchParams;
  const ps = presets();
  const ok = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const chosen = ps.find((p) => p.key === sp.range) ?? (ok(sp.from) && ok(sp.to) ? null : ps[2]);
  const from = chosen?.from ?? (sp.from as string);
  const to = chosen?.to ?? (sp.to as string);
  const r = await salesReport(from, to);
  const s = r.summary;
  const profit = s.taxable - s.cost;
  const days = r.daily.length;

  return (
    <>
      <PageHeader title="Sales report" sub={`${dateLabel(from)} – ${dateLabel(to)}`}
        actions={
          <>
            <a href={`/api/reports/export?type=invoices&from=${from}&to=${to}`} className={buttonClass("secondary")}><Download className="h-4 w-4" /> Invoices CSV</a>
            <a href={`/api/reports/export?type=items&from=${from}&to=${to}`} className={buttonClass("secondary")}><Download className="h-4 w-4" /> Item-wise CSV</a>
            <a href={`/api/reports/export?type=hsn&from=${from}&to=${to}`} className={buttonClass("secondary")}><Download className="h-4 w-4" /> HSN summary (GSTR-1)</a>
          </>
        } />

      <Card className="mb-5">
        <form className="flex flex-wrap items-end gap-2 p-4">
          <div className="flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1">
            {ps.map((p) => (
              <Link key={p.key} href={`/reports?range=${p.key}`}
                className={cx("rounded-md px-3 py-1.5 text-[13px] font-semibold", chosen?.key === p.key ? "bg-surface text-ink shadow-sm ring-1 ring-line-2" : "text-ink-2 hover:text-ink")}>
                {p.label}
              </Link>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-end gap-2">
            <div className="w-40"><Input type="date" name="from" defaultValue={from} aria-label="From date" /></div>
            <div className="w-40"><Input type="date" name="to" defaultValue={to} aria-label="To date" /></div>
            <button className={buttonClass("secondary")}>Show</button>
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Net sales (incl. GST)" value={rupees(s.total)} sub={`${count(s.bills)} bills${s.cancelled ? ` · ${s.cancelled} cancelled` : ""}`} />
        <Tile label="GST collected" value={rupees(s.cgst + s.sgst + s.igst)} sub={`CGST ${rupees(s.cgst)} · SGST ${rupees(s.sgst)}${s.igst ? ` · IGST ${rupees(s.igst)}` : ""}`} />
        <Tile label="Gross profit" value={rupees(profit)} sub={`Margin ${s.taxable ? ((profit / s.taxable) * 100).toFixed(1) : "0"}% on ${rupees(s.taxable)} taxable`} tone="good" />
        <Tile label="Still to collect" value={rupees(s.total - s.paid)} sub={`${rupees(s.paid)} received`} tone={s.total - s.paid > 0 ? "warn" : undefined} />
      </div>

      {s.bills ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
            <Card>
              <CardHeader title="Sales by day" sub={days > 1 ? `Average ${rupees(s.total / days)} a day` : undefined} />
              <div className="px-3 pt-3 pb-2">{days > 1 ? <AreaChart data={r.daily} /> : <p className="p-6 text-sm text-ink-2">Pick a longer range to see the daily trend.</p>}</div>
            </Card>
            <Card>
              <CardHeader title="Payment modes" />
              <div className="p-5"><BarList items={r.modes.map((m) => ({ label: m.label, value: m.value, sub: `${m.n} bills` }))} /></div>
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card><CardHeader title="Sales by bike brand" sub="Before GST" /><div className="p-5"><BarList items={r.brands.map((b) => ({ label: b.label, value: b.value, sub: `${count(b.qty)} pcs` }))} /></div></Card>
            <Card><CardHeader title="Sales by category" sub="Before GST" /><div className="p-5"><BarList items={r.categories.map((b) => ({ label: b.label, value: b.value, sub: `${count(b.qty)} pcs` }))} /></div></Card>
          </div>

          <Card className="mt-4">
            <CardHeader title="Top 15 parts" sub="By sales value before GST" />
            <Table>
              <thead><tr><th className={th}>Part</th><th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Sales</th><th className={`${th} text-right`}>Profit</th><th className={`${th} text-right`}>Margin</th></tr></thead>
              <tbody>
                {r.topParts.map((p) => (
                  <tr key={p.product_id} className="hover:bg-surface-2">
                    <td className={td}><Link href={`/products/${p.product_id}`} className="font-medium hover:underline">{p.name}</Link><p className="font-mono text-xs text-ink-3">{p.sku}</p></td>
                    <td className={`${td} text-right`}>{count(p.qty)}</td>
                    <td className={`${td} text-right font-semibold`}>{rupees(p.amount)}</td>
                    <td className={`${td} text-right text-good`}>{rupees(p.profit)}</td>
                    <td className={`${td} text-right text-ink-2`}>{p.amount ? ((p.profit / p.amount) * 100).toFixed(1) : "0"}%</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="GST by rate" sub="For your GST return" />
              <Table>
                <thead><tr><th className={th}>Rate</th><th className={`${th} text-right`}>Taxable value</th><th className={`${th} text-right`}>Tax</th></tr></thead>
                <tbody>{r.gst.map((g) => <tr key={g.rate}><td className={td}>{g.rate}%</td><td className={`${td} text-right`}>{rupees2(g.taxable)}</td><td className={`${td} text-right`}>{rupees2(g.tax)}</td></tr>)}</tbody>
              </Table>
            </Card>
            <Card>
              <CardHeader title="B2B and B2C" sub="B2B = customer gave a GSTIN" />
              <Table>
                <thead><tr><th className={th}>Type</th><th className={`${th} text-right`}>Bills</th><th className={`${th} text-right`}>Taxable value</th><th className={`${th} text-right`}>Tax</th></tr></thead>
                <tbody>{r.b2b.map((g) => <tr key={g.kind}><td className={td}>{g.kind}</td><td className={`${td} text-right`}>{g.bills}</td><td className={`${td} text-right`}>{rupees2(g.taxable)}</td><td className={`${td} text-right`}>{rupees2(g.tax)}</td></tr>)}</tbody>
              </Table>
            </Card>
          </div>
        </>
      ) : (
        <Card className="mt-4"><Empty title="No sales in this period">Pick another date range above.</Empty></Card>
      )}
    </>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "good" | "warn" }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="text-[13px] text-ink-2">{label}</p>
      <p className={cx("num mt-2 text-[26px] leading-none font-bold tracking-tight", tone === "good" && "text-good", tone === "warn" && "text-warn")}>{value}</p>
      <p className="mt-2 text-[12.5px] text-ink-3">{sub}</p>
    </div>
  );
}

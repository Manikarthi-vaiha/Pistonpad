import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bike, Plus, Search } from "lucide-react";
import { NumberPlate } from "@/components/NumberPlate";
import { Badge, Button, Card, cx, Empty, Input, LinkButton, Notice, PageHeader, Table, td, th } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { count, rupees, rupeesShort } from "@/lib/format";
import { BUDGETS, daysLeft, FINANCE_FILTERS, normalizeReg, ordinal, parseReg, VEHICLE_STATUS } from "@/lib/regno";
import { budgetCounts, financeSummary, findVehicleByReg, searchVehicles, vehicleSummary } from "@/lib/vehicles";

export const metadata: Metadata = { title: "Used bikes" };

const TABS = [["available", "Available"], ["in_stock", "In stock"], ["reserved", "Reserved"], ["in_service", "In service"], ["sold", "Sold"], ["", "All"]] as const;

export default async function VehiclesPage({ searchParams }: PageProps<"/vehicles">) {
  await requireUser();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const reg = one("reg").trim();

  // Vehicle number lookup: straight to the bike when we have it.
  let notFound: ReturnType<typeof parseReg> | null = null;
  if (reg) {
    const hit = await findVehicleByReg(reg);
    if (hit) redirect(`/vehicles/${hit.id}`);
    notFound = parseReg(reg);
  }

  const status = "status" in sp ? one("status") : "available";
  const q = one("q");
  const after = /^\d+$/.test(one("after")) ? Number(one("after")) : undefined;
  const budget = BUDGETS.some((b) => b.key === one("budget")) ? one("budget") : "";
  const finance = FINANCE_FILTERS.some((f) => f.key === one("finance")) ? one("finance") : "";
  const [summary, result, budgets, financeCats] = await Promise.all([
    vehicleSummary(), searchVehicles({ q, status, budget, finance, after }), budgetCounts(), financeSummary(),
  ]);
  const params = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ status, ...(q ? { q } : {}), ...(budget ? { budget } : {}), ...(finance ? { finance } : {}), ...patch });
    for (const [k, v] of [...p]) if (!v && k !== "status") p.delete(k);
    return `/vehicles?${p}`;
  };

  return (
    <>
      <PageHeader
        title="Used bikes"
        sub="Second-hand two-wheelers: details, owners, documents, fines and service history"
        actions={<LinkButton href="/vehicles/new" variant="primary"><Plus className="h-4 w-4" /> Add bike</LinkButton>}
      />

      <Card className="mb-5 p-5">
        <form action="/vehicles" className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label htmlFor="reg" className="text-sm font-semibold whitespace-nowrap text-ink">Vehicle number</label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-ink-3" />
            <Input id="reg" name="reg" defaultValue={reg} autoFocus autoComplete="off" spellCheck={false} placeholder="TN 76 AB 1234"
              className="h-12 pl-10 font-mono text-lg tracking-wider uppercase placeholder:normal-case placeholder:tracking-normal" />
          </div>
          <Button variant="primary" size="lg">Find bike</Button>
        </form>
        {notFound ? (
          <div className="mt-4">
            <Notice tone={notFound.valid ? "warn" : "bad"}>
              {notFound.valid ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    <b>{notFound.display}</b> is not in your records yet.{" "}
                    {notFound.kind === "state" ? <>Registered in <b>{notFound.state}</b> (RTO {notFound.rto}).</> : <>Bharat series number, registered {notFound.year}.</>}
                  </span>
                  <LinkButton size="sm" variant="primary" href={`/vehicles/new?reg=${normalizeReg(reg)}`}><Plus className="h-4 w-4" /> Add this bike</LinkButton>
                </div>
              ) : <>“{reg}” doesn&apos;t look like a vehicle number. Try the format TN 76 AB 1234 or 22 BH 1234 AA.</>}
            </Notice>
          </div>
        ) : null}
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Bikes available", count(summary.available), `${summary.reserved} reserved · ${summary.in_service} in service`],
          ["Money in bikes", rupeesShort(Number(summary.invested)), "Bought price + work done"],
          ["Asking value", rupeesShort(Number(summary.asking)), "Total of our prices"],
          ["Sold this month", count(summary.sold_month), `Profit ${rupees(summary.profit_month)}`],
        ].map(([label, value, sub]) => (
          <Card key={label} className="p-4">
            <p className="text-[13px] font-medium text-ink-2">{label}</p>
            <p className="num mt-1 text-2xl font-bold tracking-tight">{value}</p>
            <p className="mt-0.5 text-xs text-ink-3">{sub}</p>
          </Card>
        ))}
      </div>
      {summary.docs_due ? (
        <div className="mb-5"><Notice tone="warn">{summary.docs_due} bike{summary.docs_due === 1 ? "" : "s"} in stock with insurance or PUC expired or expiring within 15 days. Look for the red marks below.</Notice></div>
      ) : null}

      <section className="mb-5" aria-labelledby="budget-title">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 id="budget-title" className="text-[15px] font-semibold">Used bikes for every budget</h2>
          {budget ? <Link href={params({ budget: "", after: "" })} className="text-[13px] font-semibold text-primary hover:underline">Any budget</Link> : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {BUDGETS.map((b) => {
            const on = budget === b.key, n = budgets[b.key] ?? 0;
            return (
              <Link key={b.key} href={params({ budget: on ? "" : b.key, after: "" })} aria-current={on ? "true" : undefined}
                className={cx("rounded-xl border px-3 py-2.5 transition-colors",
                  on ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface hover:border-primary/60", !n && !on && "opacity-60")}>
                <span className="block text-[13px] font-semibold">{b.label}</span>
                <span className={cx("block text-xs", on ? "text-primary-ink/80" : "text-ink-3")}>{n} bike{n === 1 ? "" : "s"} available</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mb-5" aria-labelledby="finance-title">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 id="finance-title" className="text-[15px] font-semibold">Bikes by finance</h2>
          {finance ? <Link href={params({ finance: "", after: "" })} className="text-[13px] font-semibold text-primary hover:underline">Any finance status</Link> : null}
        </div>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          {financeCats.map((f) => {
            const on = finance === f.key;
            return (
              <Link key={f.key} href={params({ finance: on ? "" : f.key, after: "" })} aria-current={on ? "true" : undefined}
                className={cx("rounded-xl border px-4 py-3 transition-colors", on ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-primary/60", !f.n && !on && "opacity-60")}>
                <span className="flex items-center justify-between gap-2">
                  <span className={cx("text-[13px] font-semibold", on ? "text-primary" : "text-ink-2")}>{f.label}</span>
                  <Badge tone={f.n ? f.tone : "neutral"}>{f.n} bike{f.n === 1 ? "" : "s"}</Badge>
                </span>
                <span className="mt-1 block truncate text-xs text-ink-3">
                  {f.key === "clear" ? "No loan on the RC" : f.financiers.length ? f.financiers.map((x) => `${x.name} ${x.n}`).join(" · ") : "None"}
                </span>
                {f.key === "under" && f.toClose ? (
                  <span className="mt-0.5 block text-xs font-semibold text-bad">
                    {rupees(f.toClose)} to close{[f.shopPays && `${rupees(f.shopPays)} by us`, f.buyerPays && `${rupees(f.buyerPays)} by buyers`].filter(Boolean).map((x) => ` · ${x}`).join("")}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <nav className="flex flex-wrap gap-1" aria-label="Status">
            {TABS.map(([key, label]) => (
              <Link key={label} href={params({ status: key, after: "" })}
                className={cx("rounded-lg px-3 py-1.5 text-[13px] font-semibold", status === key ? "bg-primary text-primary-ink" : "text-ink-2 hover:bg-surface-2")}>
                {label}
              </Link>
            ))}
          </nav>
          <form action="/vehicles" className="relative w-full lg:max-w-xs">
            <input type="hidden" name="status" value={status} />
            {budget ? <input type="hidden" name="budget" value={budget} /> : null}
            {finance ? <input type="hidden" name="finance" value={finance} /> : null}
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <Input name="q" defaultValue={q} placeholder="Search bike, owner, phone, chassis…" className="pl-9" aria-label="Search bikes" />
          </form>
        </div>

        {result.rows.length ? (
          <Table>
            <thead>
              <tr>
                <th className={th}>Vehicle no.</th><th className={th}>Bike</th><th className={`${th} text-right`}>KM</th><th className={th}>Owners</th>
                <th className={th}>Alerts</th><th className={`${th} text-right`}>Our price</th><th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((v) => {
                // Paper expiry only matters while we still own the bike; pending fines matter until cleared.
                const sold = v.status === "sold";
                const ins = sold ? null : daysLeft(v.insurance_valid_till), puc = sold ? null : daysLeft(v.puc_valid_till);
                const st = VEHICLE_STATUS[v.status] ?? { label: v.status, tone: "neutral" as const };
                return (
                  <tr key={v.id} className="hover:bg-surface-2">
                    <td className={td}><Link href={`/vehicles/${v.id}`}><NumberPlate reg={v.reg_no} size="sm" /></Link></td>
                    <td className={td}>
                      <Link href={`/vehicles/${v.id}`} className="flex min-w-[220px] items-center gap-3">
                        <span className="flex h-11 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface-2 text-ink-3">
                          {v.cover_photo_id ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`/api/vehicles/photos/${v.cover_photo_id}?size=thumb`} alt="" loading="lazy" className="h-full w-full object-cover" />
                          ) : <Bike className="h-5 w-5" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium hover:underline">{[v.make, v.model, v.variant].filter(Boolean).join(" ")}</span>
                          <span className="block text-xs text-ink-3">{[v.mfg_year, v.colour, v.current_owner].filter(Boolean).join(" · ") || "—"}</span>
                        </span>
                      </Link>
                    </td>
                    <td className={`${td} text-right text-ink-2`}>{v.odometer_km != null ? count(v.odometer_km) : "—"}</td>
                    <td className={`${td} text-ink-2`}>{v.owner_count ? `${ordinal(v.owner_count)} owner` : "—"}</td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-1">
                        {ins != null && ins < 15 ? <Badge tone={ins < 0 ? "bad" : "warn"}>Insurance {ins < 0 ? "expired" : `${ins}d`}</Badge> : null}
                        {puc != null && puc < 15 ? <Badge tone={puc < 0 ? "bad" : "warn"}>PUC {puc < 0 ? "expired" : `${puc}d`}</Badge> : null}
                        {v.loan_status === "active" || v.loan_status === "closed" ? <Badge tone="bad">{v.loan_status === "active" ? "Loan active" : "NOC pending"}</Badge> : null}
                        {v.accidents ? <Badge tone="bad">Accident</Badge> : null}
                        {v.damaged_parts ? <Badge tone="warn">{v.damaged_parts} damaged</Badge> : null}
                        {v.pending_fines ? <Badge tone="bad">{v.pending_fines} fine{v.pending_fines === 1 ? "" : "s"} · {rupees(v.pending_fine_amount)}</Badge> : null}
                        {(ins == null || ins >= 15) && (puc == null || puc >= 15) && !v.pending_fines && !v.accidents && !v.damaged_parts && v.loan_status !== "active" && v.loan_status !== "closed" ? <span className="text-xs text-ink-3">OK</span> : null}
                      </div>
                    </td>
                    <td className={`${td} text-right font-semibold`}>
                      {v.status === "sold" ? <span className="text-ink-2">{rupees(v.sold_price)}</span> : v.our_price != null ? rupees(v.our_price) : <span className="text-ink-3">—</span>}
                    </td>
                    <td className={td}><Badge tone={st.tone}>{st.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <Empty icon={<Bike className="h-8 w-8" />} title={q || budget || finance || status !== "available" ? "No bikes match" : "No bikes yet"}>
            {q || budget || finance || status !== "available" ? budget ? "No bikes in this budget right now. Try a nearby range." : "Try another word or status." : <>Type a vehicle number above, or <Link className="text-primary underline" href="/vehicles/new">add your first bike</Link>.</>}
          </Empty>
        )}
        <div className="flex items-center justify-between gap-3 p-4 text-sm text-ink-2">
          <span>{after ? <Link href={params({ after: "" })} className="font-semibold text-primary hover:underline">← Back to first page</Link> : `Showing ${result.rows.length} newest`}</span>
          {result.nextCursor ? <LinkButton size="sm" href={params({ after: String(result.nextCursor) })}>Next 50 →</LinkButton> : null}
        </div>
      </Card>
    </>
  );
}


import type { Metadata } from "next";
import Link from "next/link";
import { FileDown, ReceiptText, Search } from "lucide-react";
import { DateRangePicker } from "@/components/DatePicker";
import { NumberPlate } from "@/components/NumberPlate";
import { Badge, Card, cx, Empty, Input, PageHeader, Table, td, th } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { count, dateLabel, isoDate, rupees } from "@/lib/format";
import { vehicleDocPdfPath } from "@/lib/pdf/link";
import { getShop } from "@/lib/shop";
import { searchVehicleDocs } from "@/lib/vehicle-docs";
import { WhatsAppDoc } from "../[id]/VehicleDocs";

export const metadata: Metadata = { title: "Bike invoices and receipts" };

const KINDS = [["", "All"], ["sale", "Sale invoices"], ["purchase", "Purchase receipts"]] as const;
const STATUSES = [["", "Any status"], ["issued", "Issued"], ["cancelled", "Cancelled"]] as const;

export default async function VehicleDocsPage({ searchParams }: PageProps<"/vehicles/documents">) {
  await requireUser();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const date = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(one(k)) ? one(k) : "");
  const q = one("q").trim(), kind = one("kind"), status = one("status"), from = date("from"), to = date("to");
  const [r, shop] = await Promise.all([searchVehicleDocs({ q, kind, status, from, to }), getShop()]);
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(kind && { kind }), ...(status && { status }), ...(from && { from }), ...(to && { to }), ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `/vehicles/documents?${p}`;
  };
  const filtered = Boolean(q || kind || status || from || to);

  return (
    <>
      <PageHeader title="Bike invoices and receipts"
        sub="Every sale invoice and purchase receipt. Search a person's name or phone to see all their documents." />

      <Card className="mb-5">
        <form action="/vehicles/documents" className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <Input name="q" defaultValue={q} autoFocus placeholder="Name, phone, document no. (BS/…, BP/…) or vehicle no." className="pl-9" aria-label="Search documents" />
          </div>
          {kind ? <input type="hidden" name="kind" value={kind} /> : null}
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <DateRangePicker from={from} to={to} max={isoDate()} allowAll className="w-full lg:w-72" />
        </form>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          {KINDS.map(([k, label]) => (
            <Link key={label} href={qs({ kind: k })} aria-current={kind === k ? "true" : undefined}
              className={cx("rounded-lg px-3 py-1.5 text-[13px] font-semibold", kind === k ? "bg-primary text-primary-ink" : "text-ink-2 hover:bg-surface-2")}>{label}</Link>
          ))}
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          {STATUSES.map(([k, label]) => (
            <Link key={label} href={qs({ status: k })} aria-current={status === k ? "true" : undefined}
              className={cx("rounded-lg px-3 py-1.5 text-[13px] font-semibold", status === k ? "bg-surface-2 text-ink ring-1 ring-line-2" : "text-ink-2 hover:bg-surface-2")}>{label}</Link>
          ))}
          {filtered ? <Link href="/vehicles/documents" className="ml-auto text-[13px] font-semibold text-primary hover:underline">Clear</Link> : null}
        </div>
      </Card>

      <Card>
        {r.rows.length ? (
          <>
            <p className="border-b border-line px-5 py-3 text-sm text-ink-2">
              {count(r.totals.n)} document{r.totals.n === 1 ? "" : "s"}
              {r.totals.sales_n ? <> · {r.totals.sales_n} sold for <b className="text-ink">{rupees(r.totals.sales)}</b></> : null}
              {r.totals.purchases_n ? <> · {r.totals.purchases_n} bought for <b className="text-ink">{rupees(r.totals.purchases)}</b></> : null}
              <span className="text-ink-3"> (cancelled ones not counted)</span>
            </p>
            <Table>
              <thead>
                <tr>
                  <th className={th}>Document</th><th className={th}>Person</th><th className={th}>Bike</th>
                  <th className={`${th} text-right`}>Amount</th><th className={th}><span className="sr-only">Download and share</span></th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((d) => {
                  const pdf = vehicleDocPdfPath(d.id);
                  const sale = d.kind === "sale";
                  return (
                    <tr key={d.id} className="hover:bg-surface-2">
                      <td className={td}>
                        <Link href={`/vehicles/${d.vehicle_id}/documents/${d.id}`} className="font-mono text-[13px] font-semibold text-primary hover:underline">{d.doc_no}</Link>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                          <Badge tone={sale ? "good" : "info"}>{sale ? "Sale invoice" : "Purchase receipt"}</Badge>
                          {d.status === "cancelled" ? <Badge tone="bad">Cancelled</Badge> : null}
                          {dateLabel(d.doc_date)}
                        </p>
                      </td>
                      <td className={td}>
                        <p className="max-w-[220px] truncate font-medium">{d.party_name}</p>
                        <p className="text-xs text-ink-3">{sale ? "Buyer" : "Seller"}{d.party_phone ? ` · ${d.party_phone}` : ""}</p>
                      </td>
                      <td className={td}>
                        <Link href={`/vehicles/${d.vehicle_id}`} className="flex flex-col gap-1">
                          <NumberPlate reg={d.reg_no} size="sm" className="self-start" />
                          <span className="max-w-[200px] truncate text-xs text-ink-3">{d.bike_name}</span>
                        </Link>
                      </td>
                      <td className={cx(td, "text-right font-semibold", d.status === "cancelled" && "text-ink-3 line-through")}>{rupees(d.price)}</td>
                      <td className={td}>
                        <div className="flex justify-end gap-1.5">
                          <a href={`${pdf}?download=1`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-2.5 text-[13px] font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink"
                            aria-label={`Download ${d.doc_no} as PDF`}>
                            <FileDown className="h-3.5 w-3.5" /> PDF
                          </a>
                          <WhatsAppDoc pdfPath={pdf} phone={d.party_phone}
                            text={[`*${shop.shop_name}*`, `${sale ? "Bike sale invoice" : "Bike purchase receipt"} ${d.doc_no} · ${dateLabel(d.doc_date)}`, `${d.bike_name} · ${rupees(d.price)}`].join("\n")} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {r.more ? <p className="px-5 py-3 text-sm text-ink-3">Showing the newest 200. Search a name or pick dates to narrow it down.</p> : null}
          </>
        ) : (
          <Empty icon={<ReceiptText className="h-8 w-8" />} title={filtered ? "No documents match" : "No bike documents yet"}>
            {filtered ? "Try part of the name, the phone number or the vehicle number." : "A sale invoice is created when you mark a bike sold. Purchase receipts are created from each bike's page."}
          </Empty>
        )}
      </Card>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { InvoiceStatus, Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { dateLabel, GST_STATES, rupees, rupees2, timeLabel } from "@/lib/format";
import { getShop } from "@/lib/shop";
import { rupeesInWords } from "@/lib/words";
import { InvoiceActions } from "./InvoiceActions";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params, searchParams }: PageProps<"/invoices/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const { new: isNew } = await searchParams;
  if (!/^\d+$/.test(id)) notFound();

  const [[inv], items, payments, shop] = await Promise.all([
    sql`select i.*, to_char(i.invoice_date, 'YYYY-MM-DD') as invoice_date, u.name as billed_by, c.address as customer_address, c.state_code as customer_state
        from invoices i left join users u on u.id = i.user_id left join customers c on c.id = i.customer_id where i.id = ${id}`,
    sql`select * from invoice_items where invoice_id = ${id} order by id`,
    sql`select p.*, to_char(p.paid_on, 'YYYY-MM-DD') as paid_on, u.name as received_by from payments p left join users u on u.id = p.user_id where invoice_id = ${id} order by p.id`,
    getShop(),
  ]);
  if (!inv) notFound();

  const due = Math.max(0, inv.total - inv.amount_paid);
  const hsn = new Map<string, { hsn: string; rate: number; taxable: number; tax: number }>();
  for (const it of items) {
    const k = `${it.hsn}|${it.gst_rate}`;
    const h = hsn.get(k) ?? { hsn: it.hsn, rate: it.gst_rate, taxable: 0, tax: 0 };
    h.taxable += it.taxable; h.tax += it.tax;
    hsn.set(k, h);
  }
  const shareText = [
    `${shop.shop_name}`, `Invoice ${inv.invoice_no} · ${dateLabel(inv.invoice_date)}`, "",
    ...items.map((it) => `${it.name} × ${it.qty} = ${rupees2(it.total)}`), "",
    `Total: ${rupees2(inv.total)}`, due > 0 ? `Balance due: ${rupees2(due)}` : "Paid in full. Thank you!",
  ].join("\n");

  return (
    <>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/invoices" className="flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Invoices</Link>
        <InvoiceActions
          invoiceId={inv.id} status={inv.status} due={due} isOwner={user.role === "owner"}
          phone={inv.customer_phone} shareText={shareText}
        />
      </div>
      {isNew ? (
        <div className="no-print mb-5">
          <Notice tone="good"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Bill {inv.invoice_no} saved and stock updated. Press <b>F2</b> for the next bill.</span></Notice>
        </div>
      ) : null}
      {inv.status === "cancelled" ? <div className="no-print mb-5"><Notice tone="bad">This invoice was cancelled and its parts were returned to stock.</Notice></div> : null}

      <article className="print-area mx-auto max-w-[900px] rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-ink pb-5">
          <div className="flex max-w-md items-start gap-4">
            {shop.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.logo_url} alt="" className="h-20 w-20 shrink-0 rounded-full" />
            ) : null}
            <div>
            <h1 className="text-2xl font-bold tracking-tight">{shop.shop_name}</h1>
            <p className="mt-1 text-sm whitespace-pre-line text-ink-2">{shop.address}</p>
            <p className="mt-1 text-sm text-ink-2">{[shop.phone && `Ph: ${shop.phone}`, shop.email].filter(Boolean).join(" · ")}</p>
            {shop.gstin ? <p className="mt-1 font-mono text-sm">GSTIN: {shop.gstin}</p> : null}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-bold tracking-[0.2em] text-primary uppercase">Tax invoice</p>
            <p className="mt-1 font-mono text-lg font-semibold">{inv.invoice_no}</p>
            <p className="text-sm text-ink-2">{dateLabel(inv.invoice_date)} · {timeLabel(inv.created_at)}</p>
            <div className="mt-2 flex justify-end"><InvoiceStatus status={inv.status} /></div>
          </div>
        </header>

        <section className="grid gap-6 py-5 sm:grid-cols-2">
          <div>
            <p className="text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">Bill to</p>
            <p className="mt-1 font-semibold">{inv.customer_id ? <Link className="hover:underline" href={`/customers/${inv.customer_id}`}>{inv.customer_name}</Link> : inv.customer_name}</p>
            {inv.customer_address ? <p className="text-sm text-ink-2">{inv.customer_address}</p> : null}
            {inv.customer_phone ? <p className="text-sm text-ink-2">{inv.customer_phone}</p> : null}
            {inv.customer_gstin ? <p className="font-mono text-sm">GSTIN: {inv.customer_gstin}</p> : null}
          </div>
          <div className="text-sm sm:text-right">
            <p className="text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">Place of supply</p>
            <p className="mt-1">{GST_STATES[inv.customer_gstin?.slice(0, 2) || shop.state_code] ?? "—"}{inv.is_interstate ? " (inter-state, IGST)" : ""}</p>
            <p className="mt-2 text-ink-2">Payment: {inv.payment_mode}{inv.billed_by ? ` · Billed by ${inv.billed_by}` : ""}</p>
          </div>
        </section>

        <div className="overflow-x-auto">
          <table className="num w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-y border-line-2 bg-surface-2 text-left text-[11.5px] tracking-wider text-ink-3 uppercase">
                <th className="px-2 py-2 font-semibold">#</th>
                <th className="px-2 py-2 font-semibold">Part</th>
                <th className="px-2 py-2 font-semibold">HSN</th>
                <th className="px-2 py-2 text-right font-semibold">Qty</th>
                <th className="px-2 py-2 text-right font-semibold">Rate</th>
                <th className="px-2 py-2 text-right font-semibold">Disc</th>
                <th className="px-2 py-2 text-right font-semibold">Taxable</th>
                <th className="px-2 py-2 text-right font-semibold">GST</th>
                <th className="px-2 py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id} className="border-b border-line align-top">
                  <td className="px-2 py-2.5 text-ink-3">{i + 1}</td>
                  <td className="px-2 py-2.5"><p className="font-medium">{it.name}</p><p className="font-mono text-xs text-ink-3">{it.sku}</p></td>
                  <td className="px-2 py-2.5 font-mono text-xs">{it.hsn}</td>
                  <td className="px-2 py-2.5 text-right">{it.qty} <span className="text-xs text-ink-3">{it.unit}</span></td>
                  <td className="px-2 py-2.5 text-right">{rupees2(it.rate)}</td>
                  <td className="px-2 py-2.5 text-right">{it.discount_pct ? `${it.discount_pct}%` : "—"}</td>
                  <td className="px-2 py-2.5 text-right">{rupees2(it.taxable)}</td>
                  <td className="px-2 py-2.5 text-right">{it.gst_rate}%</td>
                  <td className="px-2 py-2.5 text-right font-medium">{rupees2(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-6 grid gap-8 sm:grid-cols-[1fr_300px]">
          <div className="text-sm">
            <p className="text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">Amount in words</p>
            <p className="mt-1 font-medium">{rupeesInWords(inv.total)}</p>
            <table className="num mt-5 w-full max-w-md text-xs">
              <thead><tr className="border-b border-line text-left text-ink-3"><th className="py-1 font-semibold">HSN</th><th className="py-1 text-right font-semibold">Taxable</th><th className="py-1 text-right font-semibold">Rate</th><th className="py-1 text-right font-semibold">{inv.is_interstate ? "IGST" : "CGST + SGST"}</th></tr></thead>
              <tbody>
                {[...hsn.values()].map((h) => (
                  <tr key={h.hsn + h.rate} className="border-b border-line"><td className="py-1 font-mono">{h.hsn}</td><td className="py-1 text-right">{rupees2(h.taxable)}</td><td className="py-1 text-right">{h.rate}%</td><td className="py-1 text-right">{rupees2(h.tax)}</td></tr>
                ))}
              </tbody>
            </table>
            {inv.notes ? <p className="mt-4 text-ink-2">Note: {inv.notes}</p> : null}
          </div>
          <dl className="num grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
            <dt className="text-ink-2">Subtotal</dt><dd className="text-right">{rupees2(inv.subtotal)}</dd>
            {inv.discount ? <><dt className="text-ink-2">Discount</dt><dd className="text-right">− {rupees2(inv.discount)}</dd></> : null}
            <dt className="text-ink-2">Taxable value</dt><dd className="text-right">{rupees2(inv.taxable)}</dd>
            {inv.is_interstate ? <><dt className="text-ink-2">IGST</dt><dd className="text-right">{rupees2(inv.igst)}</dd></>
              : <><dt className="text-ink-2">CGST</dt><dd className="text-right">{rupees2(inv.cgst)}</dd><dt className="text-ink-2">SGST</dt><dd className="text-right">{rupees2(inv.sgst)}</dd></>}
            <dt className="text-ink-2">Round off</dt><dd className="text-right">{rupees2(inv.round_off)}</dd>
            <dt className="mt-2 border-t-2 border-ink pt-2 text-base font-bold">Total</dt><dd className="mt-2 border-t-2 border-ink pt-2 text-right text-base font-bold">{rupees2(inv.total)}</dd>
            <dt className="text-ink-2">Paid</dt><dd className="text-right">{rupees2(inv.amount_paid)}</dd>
            {due > 0 && inv.status !== "cancelled" ? <><dt className="font-semibold text-warn">Balance due</dt><dd className="text-right font-semibold text-warn">{rupees2(due)}</dd></> : null}
          </dl>
        </section>

        <footer className="mt-10 flex flex-wrap items-end justify-between gap-6 border-t border-line pt-5 text-xs text-ink-3">
          <p className="max-w-sm">{shop.invoice_footer}</p>
          <p className="text-right">For {shop.shop_name}<br /><br /><br />Authorised signatory</p>
        </footer>
      </article>

      {payments.length ? (
        <div className="no-print mx-auto mt-5 max-w-[900px] rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-3 text-[15px] font-semibold">Payments received</h2>
          <ul className="divide-y divide-line text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 py-2">
                <span>{dateLabel(p.paid_on)} · {p.mode}{p.note ? ` · ${p.note}` : ""}{p.received_by ? <span className="text-ink-3"> · {p.received_by}</span> : null}</span>
                <span className="num font-semibold">{rupees(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

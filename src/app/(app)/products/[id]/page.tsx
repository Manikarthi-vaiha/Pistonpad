import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardHeader, Notice, PageHeader, StockBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { dateLabel, rupees, timeLabel } from "@/lib/format";
import { getCatalog, getProduct } from "@/lib/products";
import { ProductForm } from "../ProductForm";
import { StockAdjust } from "./StockAdjust";

export const metadata: Metadata = { title: "Part" };

const REASON: Record<string, string> = { opening: "Opening stock", sale: "Sold", purchase: "Stock in", adjust: "Adjusted", cancel: "Bill cancelled", import: "Imported" };

export default async function ProductPage({ params, searchParams }: PageProps<"/products/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const { saved } = await searchParams;
  if (!/^\d+$/.test(id)) notFound();
  const [p, catalog, moves, [sales]] = await Promise.all([
    getProduct(Number(id)),
    getCatalog(),
    sql<{ id: number; change: number; balance: number; reason: string; ref_id: number | null; note: string; created_at: Date; user_name: string | null }[]>`
      select m.id, m.change, m.balance, m.reason, m.ref_id, m.note, m.created_at, u.name as user_name
      from stock_movements m left join users u on u.id = m.user_id
      where m.product_id = ${id} order by m.id desc limit 15`,
    sql<{ qty: number; amount: number }[]>`
      select coalesce(sum(it.qty), 0)::int as qty, coalesce(sum(it.taxable), 0) as amount
      from invoice_items it join invoices i on i.id = it.invoice_id
      where it.product_id = ${id} and i.status <> 'cancelled' and i.invoice_date >= current_date - 90`,
  ]);
  if (!p) notFound();

  return (
    <>
      <Link href="/products" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Parts</Link>
      <PageHeader title={p.name} sub={<span className="font-mono">{p.sku}</span>} />
      {saved ? <div className="mb-5"><Notice tone="good">Part saved.</Notice></div> : null}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ProductForm
          catalog={catalog}
          isOwner={user.role === "owner"}
          initial={{ ...p, cost_price: user.role === "owner" ? p.cost_price : 0, model_ids: p.model_ids }}
        />
        <div className="flex flex-col gap-5 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader title="Stock" action={<StockBadge stock={p.stock} reorder={p.reorder_level} />} />
            <div className="p-5">
              <p className="num text-4xl font-bold tracking-tight">{p.stock} <span className="text-base font-medium text-ink-3">{p.unit}</span></p>
              <p className="mt-1 text-sm text-ink-2">Sold {sales.qty} in the last 90 days ({rupees(sales.amount)})</p>
              <StockAdjust productId={p.id} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Stock history" sub="Latest 15 movements" />
            {moves.length ? (
              <ul className="divide-y divide-line">
                {moves.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {m.reason === "sale" || m.reason === "cancel" ? <Link className="hover:underline" href={`/invoices/${m.ref_id}`}>{REASON[m.reason]}</Link> : REASON[m.reason] ?? m.reason}
                      </p>
                      <p className="truncate text-xs text-ink-3">{dateLabel(m.created_at)} {timeLabel(m.created_at)}{m.user_name ? ` · ${m.user_name}` : ""}{m.note ? ` · ${m.note}` : ""}</p>
                    </div>
                    <div className="num text-right">
                      <p className={m.change > 0 ? "font-semibold text-good" : "font-semibold text-bad"}>{m.change > 0 ? "+" : ""}{m.change}</p>
                      <p className="text-xs text-ink-3">→ {m.balance}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="px-5 py-6 text-sm text-ink-3">No stock movements recorded yet.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}

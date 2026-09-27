import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Plus } from "lucide-react";
import { Badge, Card, Empty, LinkButton, PageHeader, StockBadge, Table, td, th } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { count, rupees2 } from "@/lib/format";
import { estimatedProductCount, getCatalog, searchProducts } from "@/lib/products";
import { ProductFilters } from "./ProductFilters";

export const metadata: Metadata = { title: "Parts" };

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const user = await requireUser();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const int = (k: string) => (/^\d+$/.test(one(k)) ? Number(one(k)) : undefined);
  const stock = one("stock");

  const [catalog, result, total] = await Promise.all([
    getCatalog(),
    searchProducts({
      q: one("q"), brandId: int("brand"), modelId: int("model"), categoryId: int("category"),
      stock: stock === "low" || stock === "out" || stock === "in" ? stock : undefined,
      includeInactive: one("inactive") === "1", after: int("after"), limit: 50,
    }),
    estimatedProductCount(),
  ]);
  const filtered = ["q", "brand", "model", "category", "stock"].some((k) => one(k));
  const next = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "after" && typeof v === "string") as [string, string][]);

  return (
    <>
      <PageHeader
        title="Parts"
        sub={`${count(total)} parts in the catalogue`}
        actions={<LinkButton href="/products/new" variant="primary"><Plus className="h-4 w-4" /> Add part</LinkButton>}
      />
      <Card>
        <ProductFilters catalog={catalog} />
        {result.rows.length ? (
          <Table>
            <thead>
              <tr>
                <th className={th}>Part no.</th><th className={th}>Part</th><th className={th}>Fits</th><th className={th}>Rack</th>
                {user.role === "owner" ? <th className={`${th} text-right`}>Cost</th> : null}
                <th className={`${th} text-right`}>Rate</th><th className={th}>Stock</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((p) => (
                <tr key={p.id} className="hover:bg-surface-2">
                  <td className={td}><Link href={`/products/${p.id}`} className="font-mono text-[13px] font-semibold text-primary hover:underline">{p.sku}</Link></td>
                  <td className={td}>
                    <Link href={`/products/${p.id}`} className="block max-w-[360px] truncate font-medium hover:underline">{p.name}</Link>
                    <p className="text-xs text-ink-3">{[p.brand, p.category].filter(Boolean).join(" · ")}{!p.active ? " · Disabled" : ""}</p>
                  </td>
                  <td className={`${td} max-w-[240px]`}>
                    {p.is_universal ? <Badge tone="info">All bikes</Badge> : p.fits.length ? (
                      <p className="truncate text-[13px] text-ink-2">{p.fits.join(", ")}{p.fits_count > p.fits.length ? <span className="text-ink-3"> +{p.fits_count - p.fits.length}</span> : null}</p>
                    ) : <span className="text-xs text-ink-3">—</span>}
                  </td>
                  <td className={`${td} text-ink-2`}>{p.rack || "—"}</td>
                  {user.role === "owner" ? <td className={`${td} text-right text-ink-2`}>{rupees2(p.cost_price)}</td> : null}
                  <td className={`${td} text-right font-semibold`}>{rupees2(p.sale_price)}</td>
                  <td className={td}><StockBadge stock={p.stock} reorder={p.reorder_level} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty icon={<Boxes className="h-8 w-8" />} title={filtered ? "No parts match these filters" : "No parts yet"}>
            {filtered ? "Try fewer words, or clear the bike and stock filters." : <>Add parts one by one, or <Link className="text-primary underline" href="/import">import a spreadsheet</Link>.</>}
          </Empty>
        )}
        <div className="flex items-center justify-between gap-3 p-4 text-sm text-ink-2">
          <span>{one("after") ? <Link href={`/products?${next}`} className="font-semibold text-primary hover:underline">← Back to first page</Link> : `Showing ${result.rows.length} newest matches`}</span>
          {result.nextCursor ? <LinkButton size="sm" href={`/products?${new URLSearchParams([...next, ["after", String(result.nextCursor)]])}`}>Next 50 →</LinkButton> : null}
        </div>
      </Card>
    </>
  );
}

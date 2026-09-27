import type { Metadata } from "next";
import { Card, CardHeader, PageHeader, Table, td, th } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { dateLabel, rupees } from "@/lib/format";
import { StockInClient } from "./StockInClient";

export const metadata: Metadata = { title: "Stock in" };

export default async function StockInPage() {
  const user = await requireUser();
  const [suppliers, recent] = await Promise.all([
    sql<{ name: string }[]>`select name from suppliers order by name limit 500`,
    sql<{ id: number; supplier_name: string; bill_ref: string; purchase_date: string; total: number; items: number; units: number }[]>`
      select p.id, p.supplier_name, p.bill_ref, to_char(p.purchase_date, 'YYYY-MM-DD') as purchase_date, p.total,
             count(pi.id)::int as items, coalesce(sum(pi.qty), 0)::int as units
      from purchases p left join purchase_items pi on pi.purchase_id = p.id
      group by p.id order by p.id desc limit 10`,
  ]);
  return (
    <>
      <PageHeader title="Stock in" sub="Enter a supplier's bill to add all its parts to stock at once." />
      <StockInClient suppliers={suppliers.map((s) => s.name)} isOwner={user.role === "owner"} />
      {recent.length ? (
        <Card className="mt-5">
          <CardHeader title="Recent stock entries" />
          <Table>
            <thead><tr><th className={th}>Date</th><th className={th}>Supplier</th><th className={th}>Bill no.</th><th className={`${th} text-right`}>Parts</th><th className={`${th} text-right`}>Units</th>{user.role === "owner" ? <th className={`${th} text-right`}>Value</th> : null}</tr></thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}><td className={td}>{dateLabel(r.purchase_date)}</td><td className={td}>{r.supplier_name || "—"}</td><td className={td}>{r.bill_ref || "—"}</td>
                  <td className={`${td} text-right`}>{r.items}</td><td className={`${td} text-right`}>{r.units}</td>{user.role === "owner" ? <td className={`${td} text-right`}>{rupees(r.total)}</td> : null}</tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, Card, Empty, LinkButton, PageHeader, Table, td, th } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listFinanciers } from "@/lib/financiers";
import { DeleteFinancier, ToggleActive } from "./FinancierForm";

export const metadata: Metadata = { title: "Finance companies" };

export default async function FinancePage() {
  await requireUser("owner");
  const list = await listFinanciers();
  return (
    <>
      <PageHeader
        title="Finance companies"
        sub="Manage the finance companies used for bike loans. Rates and charges are optional — they help estimate EMI on sale invoices."
        actions={<LinkButton href="/finance/new" variant="primary"><Plus className="h-4 w-4" /> Add financier</LinkButton>}
      />
      <Card>
        {list.length ? (
          <Table>
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={`${th} text-right`}>Interest rate</th>
                <th className={`${th} text-right`}>Doc charge</th>
                <th className={`${th} text-right`}>Processing fee</th>
                <th className={`${th} text-right`}>Round EMI to</th>
                <th className={th}>Status</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {list.map((f) => (
                <tr key={f.id} className="hover:bg-surface-2">
                  <td className={td}>
                    <Link href={`/finance/${f.id}`} className="font-semibold hover:underline">{f.name}</Link>
                    {f.notes ? <p className="text-xs text-ink-3">{f.notes}</p> : null}
                  </td>
                  <td className={`${td} text-right`}>
                    {f.interest_rate != null ? <>{f.interest_rate}% <span className="text-xs text-ink-3">({f.rate_type})</span></> : <span className="text-ink-3">—</span>}
                  </td>
                  <td className={`${td} text-right`}>{f.doc_charge != null ? `₹${Number(f.doc_charge).toLocaleString("en-IN")}` : <span className="text-ink-3">—</span>}</td>
                  <td className={`${td} text-right`}>{f.processing_fee_pct != null ? `${f.processing_fee_pct}%` : <span className="text-ink-3">—</span>}</td>
                  <td className={`${td} text-right`}>{f.round_to ? `₹${f.round_to}` : <span className="text-ink-3">—</span>}</td>
                  <td className={td}><Badge tone={f.active ? "good" : "neutral"}>{f.active ? "Active" : "Inactive"}</Badge></td>
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <Link href={`/finance/${f.id}`} className="text-[13px] font-semibold text-primary hover:underline">Edit</Link>
                      <ToggleActive id={f.id} active={f.active} />
                      <DeleteFinancier id={f.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty title="No finance companies yet">
            Add the finance companies you work with — Bajaj Finance, HDFC, IDFC FIRST and others.{" "}
            <Link href="/finance/new" className="text-primary underline">Add the first one.</Link>
          </Empty>
        )}
      </Card>
    </>
  );
}

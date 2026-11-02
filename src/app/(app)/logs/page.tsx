import type { Metadata } from "next";
import Link from "next/link";
import { Activity } from "lucide-react";
import { Badge, Card, CardHeader, Empty, PageHeader, Table, td, th } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { dateLabel, isoDate } from "@/lib/format";

export const metadata: Metadata = { title: "Activity log" };

const ENTITY_COLORS: Record<string, "info" | "primary" | "good" | "bad" | "neutral" | "warn"> = {
  vehicle: "info",
  invoice: "primary",
  expense: "warn",
  product: "neutral",
  stock: "neutral",
  customer: "good",
  settings: "bad",
  finance: "primary",
};

const PAGE = 100;

export default async function LogsPage({ searchParams }: PageProps<"/logs">) {
  await requireUser("owner");
  const sp = await searchParams;
  const now = new Date();
  const ok = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const from = ok(sp.from) ? sp.from : isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = ok(sp.to) ? sp.to : isoDate(now);
  const entity = typeof sp.entity === "string" ? sp.entity : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE;

  const entityFilter = entity ? sql`and entity_type = ${entity}` : sql``;

  const [rows, [{ total }], users, entities] = await Promise.all([
    sql<{ id: number; entity_type: string; entity_id: number | null; action: string; summary: string; user_name: string | null; created_at: string }[]>`
      select id, entity_type, entity_id, action, summary, user_name,
             to_char(created_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as created_at
      from audit_logs
      where created_at::date between ${from} and ${to} ${entityFilter}
      order by id desc limit ${PAGE} offset ${offset}`,
    sql<{ total: number }[]>`
      select count(*)::int as total from audit_logs
      where created_at::date between ${from} and ${to} ${entityFilter}`,
    sql<{ user_name: string }[]>`
      select distinct user_name from audit_logs where user_name is not null order by user_name`,
    sql<{ entity_type: string }[]>`
      select distinct entity_type from audit_logs order by entity_type`,
  ]);

  const totalPages = Math.ceil(total / PAGE);
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ from, to, ...(entity ? { entity } : {}), ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `/logs?${p}`;
  };

  return (
    <>
      <PageHeader
        title="Activity log"
        sub={`${dateLabel(from)} – ${dateLabel(to)} · ${total} event${total === 1 ? "" : "s"}`}
      />

      <Card className="mb-5">
        <form className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-ink-2">From</span>
            <input name="from" type="date" defaultValue={from} max={isoDate()}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink focus:border-primary focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-ink-2">To</span>
            <input name="to" type="date" defaultValue={to} max={isoDate()}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink focus:border-primary focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-ink-2">Module</span>
            <select name="entity" defaultValue={entity}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink focus:border-primary focus:outline-none">
              <option value="">All modules</option>
              {entities.map((e) => <option key={e.entity_type} value={e.entity_type}>{e.entity_type}</option>)}
            </select>
          </div>
          <button type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-ink hover:opacity-90">
            Filter
          </button>
          {(entity || from !== isoDate(new Date(now.getFullYear(), now.getMonth(), 1))) && (
            <Link href="/logs" className="text-[13px] font-semibold text-primary hover:underline self-end pb-0.5">Clear</Link>
          )}
        </form>
      </Card>

      <Card>
        <CardHeader title={`${entity ? `${entity} events` : "All events"}`} />
        {rows.length ? (
          <>
            <Table>
              <thead>
                <tr>
                  <th className={th}>When</th>
                  <th className={th}>Module</th>
                  <th className={th}>Action</th>
                  <th className={th}>What happened</th>
                  <th className={th}>By</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-2">
                    <td className={`${td} whitespace-nowrap text-ink-3 text-xs`}>{r.created_at}</td>
                    <td className={td}>
                      <Badge tone={ENTITY_COLORS[r.entity_type] ?? "neutral"}>{r.entity_type}</Badge>
                    </td>
                    <td className={`${td} font-mono text-xs text-ink-2`}>{r.action}</td>
                    <td className={td}>
                      <p className="max-w-[400px] truncate">{r.summary}</p>
                      {r.entity_id ? <p className="text-xs text-ink-3">ID {r.entity_id}</p> : null}
                    </td>
                    <td className={`${td} whitespace-nowrap text-ink-2`}>{r.user_name ?? <span className="text-ink-3">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-line px-5 py-3">
                <span className="text-[13px] text-ink-3">Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  {page > 1 && <Link href={qs({ page: String(page - 1) })} className="text-[13px] font-semibold text-primary hover:underline">← Previous</Link>}
                  {page < totalPages && <Link href={qs({ page: String(page + 1) })} className="text-[13px] font-semibold text-primary hover:underline">Next →</Link>}
                </div>
              </div>
            )}
          </>
        ) : (
          <Empty icon={<Activity className="h-8 w-8" />} title="No activity in this period">
            Activity is recorded as users make changes across the system.
          </Empty>
        )}
      </Card>
    </>
  );
}

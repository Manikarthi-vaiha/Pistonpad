import type { Metadata } from "next";
import Link from "next/link";
import { Card, cx, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { isoDate } from "@/lib/format";
import { getDailyReport } from "@/lib/daily-report";
import { DailyReportClient, DateNav } from "./DailyReportClient";

export const metadata: Metadata = { title: "Daily cash book" };

export default async function DailyReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("owner");
  const params = await searchParams;
  const date = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : isoDate();
  const branchId = user.branchId ?? 1;

  const report = await getDailyReport(date, branchId);
  const pdfUrl = `/api/reports/daily-pdf?date=${date}`;

  const TABS = [
    { href: "/reports", label: "Combined" },
    { href: "/reports/parts", label: "Spare parts" },
    { href: "/reports/vehicles", label: "Used bikes" },
    { href: "/reports/daily", label: "Day book" },
  ];

  // Previous and next dates
  const d = new Date(date + "T00:00:00");
  const prev = new Date(d); prev.setDate(prev.getDate() - 1);
  const next = new Date(d); next.setDate(next.getDate() + 1);
  const prevStr = prev.toISOString().slice(0, 10);
  const nextStr = next.toISOString().slice(0, 10);
  const today = isoDate();

  return (
    <>
      <PageHeader title="Daily cash book" sub={`Day book · ${date}`} />

      <Card className="mb-5">
        <nav aria-label="Report" className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-3">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} aria-current={t.href === "/reports/daily" ? "page" : undefined}
              className={cx("-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap",
                t.href === "/reports/daily" ? "border-primary text-primary" : "border-transparent text-ink-2 hover:text-ink")}>
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 p-4">
          <Link href={`/reports/daily?date=${prevStr}`} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink-2 hover:bg-surface-2">← Prev</Link>
          <DateNav date={date} today={today} />
          {date < today ? (
            <Link href={`/reports/daily?date=${nextStr}`} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink-2 hover:bg-surface-2">Next →</Link>
          ) : null}
          {date !== today ? (
            <Link href="/reports/daily" className="ml-auto text-sm font-semibold text-primary hover:underline">Today</Link>
          ) : null}
        </div>
      </Card>

      <DailyReportClient report={report} pdfUrl={pdfUrl} />
    </>
  );
}

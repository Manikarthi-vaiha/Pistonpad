import Link from "next/link";
import { DateRangePicker } from "@/components/DatePicker";
import { Card, cx } from "@/components/ui";
import { isoDate } from "@/lib/format";
import type { reportRange } from "./range";

const TABS = [
  { href: "/reports", label: "Combined" },
  { href: "/reports/parts", label: "Spare parts" },
  { href: "/reports/vehicles", label: "Used bikes" },
] as const;

/** Business tabs + date range, shared by every report page. */
export function ReportNav({ active, range }: { active: (typeof TABS)[number]["href"]; range: ReturnType<typeof reportRange> }) {
  return (
    <Card className="mb-5">
      <nav aria-label="Report" className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-3">
        {TABS.map((t) => (
          <Link key={t.href} href={`${t.href}?${range.query}`} aria-current={active === t.href ? "page" : undefined}
            className={cx("-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap",
              active === t.href ? "border-primary text-primary" : "border-transparent text-ink-2 hover:text-ink")}>
            {t.label}
          </Link>
        ))}
      </nav>
      <form action={active} className="flex flex-wrap items-end gap-2 p-4">
        <div className="flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1">
          {range.presets.map((p) => (
            <Link key={p.key} href={`${active}?range=${p.key}`}
              className={cx("rounded-md px-3 py-1.5 text-[13px] font-semibold", range.chosen?.key === p.key ? "bg-surface text-ink shadow-sm ring-1 ring-line-2" : "text-ink-2 hover:text-ink")}>
              {p.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <DateRangePicker from={range.from} to={range.to} max={isoDate()} autoSubmit className="w-72 max-w-full" />
        </div>
      </form>
    </Card>
  );
}

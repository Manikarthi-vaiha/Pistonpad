import { isoDate } from "@/lib/format";

/** Date presets shared by every report tab. */
export function presets() {
  const n = new Date();
  const d = (y: number, m: number, day: number) => isoDate(new Date(y, m, day));
  const fyStart = n.getMonth() >= 3 ? n.getFullYear() : n.getFullYear() - 1;
  return [
    { key: "today", label: "Today", from: isoDate(n), to: isoDate(n) },
    { key: "7d", label: "Last 7 days", from: d(n.getFullYear(), n.getMonth(), n.getDate() - 6), to: isoDate(n) },
    { key: "month", label: "This month", from: d(n.getFullYear(), n.getMonth(), 1), to: isoDate(n) },
    { key: "lastmonth", label: "Last month", from: d(n.getFullYear(), n.getMonth() - 1, 1), to: d(n.getFullYear(), n.getMonth(), 0) },
    { key: "fy", label: "This financial year", from: d(fyStart, 3, 1), to: isoDate(n) },
  ];
}

/** Reads ?range=month or ?from=…&to=… (defaults to this month). */
export function reportRange(sp: Record<string, string | string[] | undefined>) {
  const ps = presets();
  const ok = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const chosen = ps.find((p) => p.key === sp.range) ?? (ok(sp.from) && ok(sp.to) ? null : ps[2]);
  const from = chosen?.from ?? (sp.from as string);
  const to = chosen?.to ?? (sp.to as string);
  // Keeps the same dates when switching tabs.
  const query = chosen ? `range=${chosen.key}` : `from=${from}&to=${to}`;
  return { from, to, chosen, presets: ps, query };
}

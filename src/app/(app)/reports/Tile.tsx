import Link from "next/link";
import { cx } from "@/components/ui";

/** Headline number on a report. `strong` gives it a tinted background (net profit). */
export function Tile({ label, value, sub, tone, href, strong }: { label: string; value: string; sub: string; tone?: "good" | "warn" | "bad"; href?: string; strong?: boolean }) {
  const body = (
    <div className={cx("h-full rounded-xl border p-5 transition-colors", strong ? (tone === "bad" ? "border-bad/40 bg-bad-soft" : "border-good/30 bg-good-soft") : "border-line bg-surface", href && "hover:border-line-2")}>
      <p className="text-[13px] text-ink-2">{label}</p>
      <p className={cx("num mt-2 text-[26px] leading-none font-bold tracking-tight", tone === "good" && "text-good", tone === "warn" && "text-warn", tone === "bad" && "text-bad")}>{value}</p>
      <p className="mt-2 text-[12.5px] text-ink-3">{sub}</p>
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

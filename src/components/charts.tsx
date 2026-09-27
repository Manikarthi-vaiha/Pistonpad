import { rupees, rupeesShort } from "@/lib/format";

/** Daily sales area chart, server-rendered SVG. */
export function AreaChart({ data, height = 220 }: { data: { date: string; value: number }[]; height?: number }) {
  const W = 760, H = height, L = 52, R = 12, T = 14, B = 28;
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = niceStep(max / 4);
  const top = Math.ceil(max / step) * step;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, data.length - 1);
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = data.length ? `${line} L${x(data.length - 1)},${H - B} L${x(0)},${H - B} Z` : "";
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const labelEvery = Math.ceil(data.length / 7);
  const last = data[data.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Daily sales chart">
      <defs>
        <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t ? "3 4" : undefined} />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">{rupeesShort(t)}</text>
        </g>
      ))}
      {data.map((d, i) =>
        i % labelEvery === 0 || i === data.length - 1 ? (
          <text key={d.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--ink-3)">
            {new Date(d.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </text>
        ) : null,
      )}
      <path d={area} fill="url(#areaFill)" />
      <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <rect key={d.date} x={x(i) - (W - L - R) / data.length / 2} y={T} width={(W - L - R) / data.length} height={H - T - B} fill="transparent">
          <title>{`${new Date(d.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}: ${rupees(d.value)}`}</title>
        </rect>
      ))}
      {last ? (
        <>
          <circle cx={x(data.length - 1)} cy={y(last.value)} r="5" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2.5" />
        </>
      ) : null}
    </svg>
  );
}

/** Horizontal bars with labels — for top brands, categories, payment modes. */
export function BarList({ items, format = rupees }: { items: { label: string; value: number; sub?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-3">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
          <span className="truncate text-sm text-ink">{i.label}</span>
          <span className="num text-sm font-semibold">
            {format(i.value)}
            {i.sub ? <span className="ml-1.5 font-normal text-ink-3">{i.sub}</span> : null}
          </span>
          <span className="col-span-2 h-2 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

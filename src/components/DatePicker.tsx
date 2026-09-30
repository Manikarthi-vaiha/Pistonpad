"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cx, inputClass } from "./ui";

/* ------------------------------------------------------------------ */
/* Date helpers: dates are "YYYY-MM-DD" strings in local time.        */
/* ------------------------------------------------------------------ */
const pad = (n: number) => String(n).padStart(2, "0");
export const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const valid = (s: string | undefined | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return toIso(d); };
const addMonths = (y: number, m: number, n: number) => { const d = new Date(y, m + n, 1); return [d.getFullYear(), d.getMonth()] as const; };
const todayIso = () => toIso(new Date());

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function formatDate(s: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return parse(s).toLocaleDateString("en-IN", opts);
}
function formatRange(from: string, to: string) {
  const a = parse(from), b = parse(to);
  if (from === to) return formatDate(from);
  const sameYear = a.getFullYear() === b.getFullYear();
  const left = a.toLocaleDateString("en-IN", sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
  return `${left} – ${formatDate(to)}`;
}

/* ------------------------------------------------------------------ */
/* Popover shell: opens below the trigger, flips to stay on screen.    */
/* ------------------------------------------------------------------ */
function usePopover() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ right: boolean; up: boolean }>({ right: false, up: false });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); root.current?.querySelector<HTMLElement>("[data-trigger]")?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !root.current || !panel.current) return;
    const t = root.current.getBoundingClientRect();
    const p = panel.current.getBoundingClientRect();
    setPlace({
      right: t.left + p.width > window.innerWidth - 12 && t.right - p.width >= 12,
      up: t.bottom + p.height + 12 > window.innerHeight && t.top - p.height - 12 > 0,
    });
  }, [open]);

  return { open, setOpen, root, panel, place };
}

function Panel({ refEl, place, children, label }: { refEl: React.RefObject<HTMLDivElement | null>; place: { right: boolean; up: boolean }; children: React.ReactNode; label: string }) {
  return (
    <div
      ref={refEl}
      role="dialog"
      aria-label={label}
      className={cx(
        "absolute z-50 max-w-[calc(100vw-24px)] rounded-2xl border border-line bg-surface p-3 shadow-[0_12px_40px_-8px_rgba(15,26,23,.28)]",
        "origin-top animate-[dp-in_120ms_ease-out]",
        place.up ? "bottom-full mb-2" : "top-full mt-2",
        place.right ? "right-0" : "left-0",
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One month grid with keyboard navigation.                           */
/* ------------------------------------------------------------------ */
type MonthProps = {
  year: number; month: number;
  focus: string; setFocus: (s: string) => void;
  onPick: (s: string) => void;
  isSelected: (s: string) => boolean;
  inRange?: (s: string) => boolean;
  isEdge?: (s: string) => "start" | "end" | "both" | null;
  onHover?: (s: string | null) => void;
  disabled: (s: string) => boolean;
  gridId: string;
};

function Month({ year, month, focus, setFocus, onPick, isSelected, inRange, isEdge, onHover, disabled, gridId }: MonthProps) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const weeks = cells[35].getMonth() !== month ? 5 : 6;
  const today = todayIso();

  const onKey = (e: React.KeyboardEvent, s: string) => {
    const move: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: string | null = null;
    if (e.key in move) next = addDays(s, move[e.key]);
    else if (e.key === "PageUp") { const d = parse(s); d.setMonth(d.getMonth() - 1); next = toIso(d); }
    else if (e.key === "PageDown") { const d = parse(s); d.setMonth(d.getMonth() + 1); next = toIso(d); }
    else if (e.key === "Home") next = addDays(s, -parse(s).getDay());
    else if (e.key === "End") next = addDays(s, 6 - parse(s).getDay());
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!disabled(s)) onPick(s); return; }
    if (next) { e.preventDefault(); setFocus(next); }
  };

  return (
    <div role="grid" aria-labelledby={`${gridId}-${year}-${month}`} className="w-[252px]" onMouseLeave={() => onHover?.(null)}>
      <div role="row" className="grid grid-cols-7">
        {WEEKDAYS.map((w) => <span key={w} role="columnheader" className="grid h-8 place-items-center text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{w}</span>)}
      </div>
      {Array.from({ length: weeks }, (_, r) => (
        <div role="row" key={r} className="grid grid-cols-7">
          {cells.slice(r * 7, r * 7 + 7).map((d) => {
            const s = toIso(d);
            const outside = d.getMonth() !== month;
            if (outside) return <span key={s} role="gridcell" className="h-9" />;
            const sel = isSelected(s);
            const edge = isEdge?.(s) ?? null;
            const mid = !sel && inRange?.(s);
            const off = disabled(s);
            return (
              <span key={s} role="gridcell" aria-selected={sel || !!mid}
                className={cx("relative h-9",
                  mid && "bg-primary-soft",
                  edge === "start" && "bg-gradient-to-r from-transparent from-50% to-[var(--primary-soft)] to-50%",
                  edge === "end" && "bg-gradient-to-l from-transparent from-50% to-[var(--primary-soft)] to-50%")}>
                <button
                  type="button"
                  tabIndex={s === focus ? 0 : -1}
                  data-date={s}
                  disabled={off}
                  onClick={() => onPick(s)}
                  onKeyDown={(e) => onKey(e, s)}
                  onMouseEnter={() => onHover?.(s)}
                  onFocus={() => s !== focus && setFocus(s)}
                  aria-label={formatDate(s, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  aria-current={s === today ? "date" : undefined}
                  className={cx(
                    "num relative mx-auto grid h-9 w-9 place-items-center rounded-full text-[13px] font-medium transition-colors",
                    sel ? "bg-primary font-semibold text-primary-ink shadow-sm"
                      : off ? "cursor-not-allowed text-ink-3/40"
                      : "text-ink hover:bg-surface-2",
                    !sel && s === today && "font-bold text-primary ring-1 ring-primary/50 ring-inset",
                  )}
                >
                  {d.getDate()}
                </button>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Month/year header with prev/next and a quick month + year jump. */
function Header({ year, month, onNav, onJump, canNext, gridId, showNav = { prev: true, next: true } }: {
  year: number; month: number; onNav: (n: number) => void; onJump?: () => void; canNext: boolean; gridId: string; showNav?: { prev: boolean; next: boolean };
}) {
  const nav = "grid h-8 w-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="mb-1 flex h-9 items-center justify-between">
      {showNav.prev ? <button type="button" className={nav} onClick={() => onNav(-1)} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button> : <span className="w-8" />}
      <button type="button" id={`${gridId}-${year}-${month}`} onClick={onJump} disabled={!onJump}
        className="rounded-lg px-2 py-1 text-sm font-semibold text-ink enabled:hover:bg-surface-2">
        {MONTHS[month]} {year}
      </button>
      {showNav.next ? <button type="button" className={nav} onClick={() => onNav(1)} disabled={!canNext} aria-label="Next month"><ChevronRight className="h-4 w-4" /></button> : <span className="w-8" />}
    </div>
  );
}

/** Month + year chooser shown when the header title is clicked. */
function MonthYearGrid({ year, month, max, onPick }: { year: number; month: number; max?: string; onPick: (y: number, m: number) => void }) {
  const [y, setY] = useState(year);
  const maxD = max ? parse(max) : null;
  const nav = "grid h-8 w-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 disabled:opacity-30";
  return (
    <div className="w-[252px]">
      <div className="mb-2 flex h-9 items-center justify-between">
        <button type="button" className={nav} onClick={() => setY(y - 1)} aria-label="Previous year"><ChevronLeft className="h-4 w-4" /></button>
        <span className="text-sm font-semibold">{y}</span>
        <button type="button" className={nav} onClick={() => setY(y + 1)} disabled={!!maxD && y >= maxD.getFullYear()} aria-label="Next year"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {MONTHS.map((name, m) => {
          const off = !!maxD && (y > maxD.getFullYear() || (y === maxD.getFullYear() && m > maxD.getMonth()));
          const on = y === year && m === month;
          return (
            <button key={name} type="button" disabled={off} onClick={() => onPick(y, m)}
              className={cx("h-10 rounded-lg text-[13px] font-medium", on ? "bg-primary text-primary-ink" : "text-ink hover:bg-surface-2", off && "opacity-30")}>
              {name.slice(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Trigger({ label, placeholder, empty, onClick, open, onClear, ariaLabel, className }: {
  label: string; placeholder: string; empty: boolean; onClick: () => void; open: boolean; onClear?: () => void; ariaLabel?: string; className?: string;
}) {
  return (
    <div className={cx("relative", className)}>
      <button type="button" data-trigger onClick={onClick} aria-haspopup="dialog" aria-expanded={open} aria-label={ariaLabel ? `${ariaLabel}: ${empty ? placeholder : label}` : undefined}
        className={cx(inputClass, "flex items-center gap-2.5 pr-9 text-left", open && "border-primary ring-4 ring-[var(--ring)]")}>
        <CalendarDays className={cx("h-4 w-4 shrink-0", open ? "text-primary" : "text-ink-3")} />
        <span className={cx("num min-w-0 flex-1 truncate", empty && "text-ink-3")}>{empty ? placeholder : label}</span>
      </button>
      {onClear && !empty ? (
        <button type="button" onClick={onClear} aria-label="Clear dates" className="absolute top-1/2 right-2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Single date                                                         */
/* ------------------------------------------------------------------ */
export function DatePicker({ name, value, defaultValue, onChange, max, min, ariaLabel, className, placeholder = "Choose a date" }: {
  name?: string; value?: string; defaultValue?: string; onChange?: (v: string) => void;
  max?: string; min?: string; ariaLabel?: string; className?: string; placeholder?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value ?? inner;
  const { open, setOpen, root, panel, place } = usePopover();
  const start = valid(current) ? current : max && todayIso() > max ? max : todayIso();
  const [view, setView] = useState(() => [parse(start).getFullYear(), parse(start).getMonth()] as const);
  const [focus, setFocus] = useState(start);
  const [jump, setJump] = useState(false);
  const gridId = useId();

  const disabled = (s: string) => (!!max && s > max) || (!!min && s < min);
  const set = (s: string) => { if (value === undefined) setInner(s); onChange?.(s); };
  const openAt = () => {
    const s = valid(current) ? current : start;
    setView([parse(s).getFullYear(), parse(s).getMonth()]); setFocus(s); setJump(false); setOpen(!open);
  };

  // Keyboard navigation: move focus, switching month when it leaves the visible one.
  const moveFocus = (s: string) => {
    const d = parse(s);
    if (d.getFullYear() !== view[0] || d.getMonth() !== view[1]) setView([d.getFullYear(), d.getMonth()]);
    setFocus(s);
  };
  useEffect(() => {
    if (!open || jump) return;
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>(`[data-date="${focus}"]`)?.focus());
  }, [focus, open, jump, panel]);

  const maxD = max ? parse(max) : null;
  const canNext = !maxD || view[0] < maxD.getFullYear() || (view[0] === maxD.getFullYear() && view[1] < maxD.getMonth());

  return (
    <div ref={root} className={cx("relative", className)}>
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <Trigger label={valid(current) ? formatDate(current) : ""} placeholder={placeholder}
        empty={!valid(current)} onClick={openAt} open={open} ariaLabel={ariaLabel} />
      {open ? (
        <Panel refEl={panel} place={place} label={ariaLabel ?? "Choose date"}>
          {jump ? (
            <MonthYearGrid year={view[0]} month={view[1]} max={max} onPick={(y, m) => { setView([y, m]); setFocus(toIso(new Date(y, m, Math.min(parse(focus).getDate(), 28)))); setJump(false); }} />
          ) : (
            <>
              <Header year={view[0]} month={view[1]} gridId={gridId} canNext={canNext} onJump={() => setJump(true)}
                onNav={(n) => { const [y, m] = addMonths(view[0], view[1], n); setView([y, m]); setFocus(toIso(new Date(y, m, 1))); }} />
              <Month year={view[0]} month={view[1]} focus={focus} setFocus={moveFocus} gridId={gridId} disabled={disabled}
                isSelected={(s) => s === current} onPick={(s) => { set(s); setOpen(false); }} />
            </>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2.5">
            <div className="flex gap-1">
              {[["Today", 0], ["Yesterday", -1]].map(([l, n]) => {
                const s = addDays(todayIso(), n as number);
                return <button key={l} type="button" disabled={disabled(s)} onClick={() => { set(s); setOpen(false); }}
                  className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-primary hover:bg-primary-soft disabled:opacity-30">{l}</button>;
              })}
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-surface-2">Close</button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Date range with shortcuts                                           */
/* ------------------------------------------------------------------ */
type Preset = { label: string; range: () => [string, string] | null };

export function defaultPresets(): Preset[] {
  const t = todayIso(), d = new Date();
  const fyStart = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return [
    { label: "Today", range: () => [t, t] },
    { label: "Yesterday", range: () => [addDays(t, -1), addDays(t, -1)] },
    { label: "This week", range: () => [addDays(t, -d.getDay()), t] },
    { label: "This month", range: () => [toIso(new Date(d.getFullYear(), d.getMonth(), 1)), t] },
    { label: "Last month", range: () => [toIso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), toIso(new Date(d.getFullYear(), d.getMonth(), 0))] },
    { label: "Last 7 days", range: () => [addDays(t, -6), t] },
    { label: "Last 30 days", range: () => [addDays(t, -29), t] },
    { label: "This financial year", range: () => [toIso(new Date(fyStart, 3, 1)), t] },
    { label: "Last financial year", range: () => [toIso(new Date(fyStart - 1, 3, 1)), toIso(new Date(fyStart, 2, 31))] },
  ];
}

/**
 * One field for a from–to range. Writes hidden `from`/`to` inputs; with `autoSubmit`
 * it submits the surrounding form when a range is applied (for filter bars).
 */
export function DateRangePicker({ fromName = "from", toName = "to", from, to, max, allowAll, autoSubmit, ariaLabel = "Date range", className, placeholder = "All dates" }: {
  fromName?: string; toName?: string; from?: string; to?: string; max?: string;
  allowAll?: boolean; autoSubmit?: boolean; ariaLabel?: string; className?: string; placeholder?: string;
}) {
  const [range, setRange] = useState<[string, string]>([valid(from) ? from : "", valid(to) ? to : ""]);
  const [draft, setDraft] = useState<[string, string | null]>(["", null]);
  const [hover, setHover] = useState<string | null>(null);
  const { open, setOpen, root, panel, place } = usePopover();
  const anchor = range[1] || max || todayIso();
  const [view, setView] = useState(() => addMonths(parse(anchor).getFullYear(), parse(anchor).getMonth(), -1));
  const [focus, setFocus] = useState(anchor);
  const gridId = useId();
  const presets = useMemo(() => defaultPresets(), []);
  const inputs = useRef<HTMLSpanElement>(null);

  const disabled = (s: string) => !!max && s > max;
  const [a, b] = draft[1] === null && draft[0] && hover ? (hover < draft[0] ? [hover, draft[0]] : [draft[0], hover]) : [draft[0], draft[1] ?? draft[0]];

  const openIt = () => {
    setDraft(range[0] ? [range[0], range[1]] : ["", null]);
    const end = range[1] || max || todayIso();
    setView(addMonths(parse(end).getFullYear(), parse(end).getMonth(), -1));
    setFocus(end);
    setOpen(!open);
  };
  const commit = (f: string, t: string) => {
    setRange([f, t]);
    setOpen(false);
    if (autoSubmit) {
      // Let React write the hidden inputs before submitting.
      requestAnimationFrame(() => inputs.current?.closest("form")?.requestSubmit());
    }
  };
  const pick = (s: string) => {
    if (!draft[0] || draft[1] !== null) setDraft([s, null]);
    else setDraft(s < draft[0] ? [s, draft[0]] : [draft[0], s]);
  };

  // Keyboard navigation across the two visible months.
  const moveFocus = (s: string) => {
    const d = parse(s);
    const first = new Date(view[0], view[1], 1), last = new Date(view[0], view[1] + 2, 0);
    if (d < first) setView([d.getFullYear(), d.getMonth()]);
    else if (d > last) setView(addMonths(d.getFullYear(), d.getMonth(), -1));
    setFocus(s);
  };
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>(`[data-date="${focus}"]`)?.focus());
  }, [focus, open, panel]);

  const go = (n: number) => { const [y, m] = addMonths(view[0], view[1], n); setView([y, m]); setFocus(toIso(new Date(y, m, 1))); };
  const second = addMonths(view[0], view[1], 1);
  const maxD = max ? parse(max) : null;
  const canNext = !maxD || second[0] < maxD.getFullYear() || (second[0] === maxD.getFullYear() && second[1] < maxD.getMonth());
  const activePreset = presets.find((p) => { const r = p.range(); return r && r[0] === draft[0] && r[1] === draft[1]; })?.label;
  const nights = draft[1] ? Math.round((parse(draft[1]).getTime() - parse(draft[0]).getTime()) / 86_400_000) + 1 : 0;

  const monthProps = {
    focus, setFocus: moveFocus, gridId, disabled, onPick: pick, onHover: setHover,
    isSelected: (s: string) => s === a || s === b,
    inRange: (s: string) => !!a && !!b && s > a && s < b,
    isEdge: (s: string) => (!a || !b || a === b ? null : s === a ? "start" as const : s === b ? "end" as const : null),
  };

  return (
    <div ref={root} className={cx("relative", className)}>
      <span ref={inputs} hidden>
        <input type="hidden" name={fromName} value={range[0]} />
        <input type="hidden" name={toName} value={range[1]} />
      </span>
      <Trigger label={range[0] ? formatRange(range[0], range[1]) : ""} placeholder={placeholder} empty={!range[0]}
        onClick={openIt} open={open} ariaLabel={ariaLabel} onClear={allowAll ? () => commit("", "") : undefined} />
      {open ? (
        <Panel refEl={panel} place={place} label={ariaLabel}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ul className="flex gap-1 overflow-x-auto pb-1 sm:w-44 sm:flex-col sm:overflow-visible sm:border-r sm:border-line sm:pr-3 sm:pb-0">
              {allowAll ? (
                <li><button type="button" onClick={() => commit("", "")}
                  className={cx("w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium whitespace-nowrap", !range[0] && !draft[0] ? "bg-primary-soft text-primary" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}>All dates</button></li>
              ) : null}
              {presets.map((p) => (
                <li key={p.label}>
                  <button type="button" onClick={() => { const r = p.range(); if (r) { setDraft(r); setFocus(r[1]); commit(r[0], r[1]); } }}
                    className={cx("w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium whitespace-nowrap", activePreset === p.label ? "bg-primary-soft text-primary" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}>
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>
            <div>
              <div className="flex gap-6">
                <div>
                  <Header year={view[0]} month={view[1]} gridId={gridId} canNext={canNext} showNav={{ prev: true, next: false }} onNav={go} />
                  <Month year={view[0]} month={view[1]} {...monthProps} />
                </div>
                <div className="hidden md:block">
                  <Header year={second[0]} month={second[1]} gridId={gridId} canNext={canNext} showNav={{ prev: false, next: true }} onNav={go} />
                  <Month year={second[0]} month={second[1]} {...monthProps} />
                </div>
              </div>
              <div className="mt-1 flex justify-end md:hidden">
                <button type="button" disabled={!canNext} onClick={() => go(1)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium text-ink-2 hover:bg-surface-2 disabled:opacity-30">
                  Next month <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <p className="num text-[13px] text-ink-2">
                  {draft[0] ? (draft[1] ? <><b className="text-ink">{formatRange(draft[0], draft[1])}</b> · {nights} day{nights === 1 ? "" : "s"}</> : <>From <b className="text-ink">{formatDate(draft[0])}</b> — now tap the end date</>) : "Tap a start date"}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-[13px] font-medium text-ink-2 hover:bg-surface-2">Cancel</button>
                  <button type="button" disabled={!draft[0]} onClick={() => commit(draft[0], draft[1] ?? draft[0])}
                    className="rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-40">Apply</button>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

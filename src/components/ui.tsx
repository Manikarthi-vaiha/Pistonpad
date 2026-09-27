import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const cx = clsx;

// ---------- Buttons ----------
type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-ink hover:bg-primary-hover shadow-sm",
  secondary: "bg-surface text-ink border border-line-2 hover:border-ink-3 hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-surface text-bad border border-bad/40 hover:bg-bad-soft",
};
const sizes = { sm: "h-8 px-3 text-[13px] gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-5 text-[15px] gap-2" };
export const buttonClass = (variant: Variant = "secondary", size: keyof typeof sizes = "md", extra?: string) =>
  cx(
    "inline-flex items-center justify-center rounded-lg font-semibold whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none select-none",
    variants[variant],
    sizes[size],
    extra,
  );

export function Button({ variant, size, className, ...p }: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <button className={buttonClass(variant, size, className)} {...p} />;
}
export function LinkButton({ variant, size, className, ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <Link className={buttonClass(variant, size, className)} {...p} />;
}

// ---------- Form fields ----------
export const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-line-2 bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none focus:ring-4 focus:ring-[var(--ring)] disabled:bg-surface-2";

export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {error ? <span className="text-xs text-bad">{error}</span> : hint ? <span className="text-xs text-ink-3">{hint}</span> : null}
    </label>
  );
}
export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input className={cx(inputClass, className)} {...p} />;
}
export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select className={cx(inputClass, "pr-8", className)} {...p} />;
}
export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputClass, "h-auto py-2", className)} {...p} />;
}

// ---------- Surfaces ----------
export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cx("rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,26,23,.04)]", className)} {...p} />;
}
export function CardHeader({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {sub ? <p className="mt-0.5 text-[13px] text-ink-3">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-balance text-ink">{title}</h1>
        {sub ? <p className="mt-1 text-sm text-ink-2">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// ---------- Status ----------
type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "primary";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  good: "bg-good-soft text-good border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  bad: "bg-bad-soft text-bad border-transparent",
  info: "bg-info-soft text-info border-transparent",
  primary: "bg-primary-soft text-primary border-transparent",
};
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

export function StockBadge({ stock, reorder }: { stock: number; reorder: number }) {
  if (stock <= 0) return <Badge tone="bad">Out of stock</Badge>;
  if (stock <= reorder) return <Badge tone="warn">Low · {stock}</Badge>;
  return <Badge tone="good">{stock} in stock</Badge>;
}

const statusTone: Record<string, Tone> = { paid: "good", partial: "warn", due: "bad", cancelled: "neutral" };
const statusLabel: Record<string, string> = { paid: "Paid", partial: "Part paid", due: "Due", cancelled: "Cancelled" };
export function InvoiceStatus({ status }: { status: string }) {
  return <Badge tone={statusTone[status] ?? "neutral"}>{statusLabel[status] ?? status}</Badge>;
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon ? <div className="mb-1 text-ink-3">{icon}</div> : null}
      <p className="font-semibold text-ink">{title}</p>
      {children ? <div className="max-w-md text-sm text-ink-2">{children}</div> : null}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return <div className={cx("rounded-lg border px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}

// ---------- Tables ----------
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-x-auto", className)}>
      <table className="num w-full border-collapse text-left text-sm">{children}</table>
    </div>
  );
}
export const th = "border-b border-line bg-surface-2 px-4 py-2.5 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase whitespace-nowrap";
export const td = "border-b border-line px-4 py-3 align-middle";

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line-2 bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-2">{children}</kbd>;
}

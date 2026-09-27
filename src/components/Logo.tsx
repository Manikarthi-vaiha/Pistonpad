import { cx } from "./ui";

/** Pistonpad mark: a piston (crown, rings, gudgeon pin) on its connecting rod. */
export function PistonMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <g fill="none" stroke="var(--primary-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* piston crown and skirt */}
        <path d="M9.5 7.5h13v8.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2z" />
        {/* compression rings */}
        <path d="M9.5 10.5h13M9.5 13h13" strokeWidth="1.4" />
        {/* connecting rod */}
        <path d="M14 18l-1.2 5.5M18 18l1.2 5.5" />
        {/* big end */}
        <circle cx="16" cy="25" r="2.6" />
      </g>
      <circle cx="16" cy="16" r="1.3" fill="var(--primary-ink)" />
    </svg>
  );
}

export function Logo({ tone = "light", compact }: { tone?: "light" | "dark"; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <PistonMark className="h-8 w-8 shrink-0" />
      {!compact && (
        <span className={cx("text-[18px] font-extrabold tracking-tight", tone === "dark" ? "text-white" : "text-ink")}>
          Piston<span className="text-primary">pad</span>
        </span>
      )}
    </div>
  );
}

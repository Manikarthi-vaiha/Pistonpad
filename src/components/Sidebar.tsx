"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3, Banknote, Bike, Boxes, Building2, ChevronLeft, ChevronRight,
  FileText, LayoutDashboard, LifeBuoy, LogOut, Menu, PackagePlus, PieChart,
  Plus, ReceiptIndianRupee, ReceiptText, Settings, Upload, Users, Wallet, X,
} from "lucide-react";
import { Logo } from "./Logo";
import { cx } from "./ui";
import { logout } from "@/app/login/actions";

type Item = { href: string; label: string; icon: React.ElementType; owner?: boolean; key?: string };
/** Grouped by business: the parts shop and the used-bike trade run side by side, sharing expenses and reports. */
const NAV: { section: string; dot?: string; items: Item[] }[] = [
  {
    section: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    section: "Spare parts",
    dot: "bg-primary",
    items: [
      { href: "/billing", label: "New bill", icon: ReceiptIndianRupee, key: "F2" },
      { href: "/invoices", label: "Invoices", icon: FileText },
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/products", label: "Parts", icon: Boxes },
      { href: "/stock-in", label: "Stock in", icon: PackagePlus },
      { href: "/import", label: "Import parts", icon: Upload, owner: true },
      { href: "/reports/parts", label: "Parts report", icon: BarChart3, owner: true },
    ],
  },
  {
    section: "Used bikes",
    dot: "bg-info",
    items: [
      { href: "/vehicles", label: "Bikes", icon: Bike },
      { href: "/vehicles/new", label: "Add bike", icon: Plus },
      { href: "/vehicles/documents", label: "Invoices & receipts", icon: ReceiptText },
      { href: "/finance", label: "Finance companies", icon: Building2, owner: true },
      { href: "/reports/vehicles", label: "Bikes report", icon: BarChart3, owner: true },
    ],
  },
  {
    section: "Shop",
    items: [
      { href: "/expenses", label: "Expenses", icon: Wallet },
      { href: "/collections", label: "Money received", icon: Banknote, owner: true },
      { href: "/reports", label: "All reports", icon: PieChart, owner: true },
      { href: "/settings", label: "Settings", icon: Settings, owner: true },
      { href: "/help", label: "Help · உதவி", icon: LifeBuoy },
    ],
  },
];
const ALL_HREFS = NAV.flatMap((g) => g.items.map((i) => i.href));

export function Sidebar({
  user, shopName, logoUrl, collapsed = false, onToggle,
}: {
  user: { name: string; role: string }; shopName: string; logoUrl: string | null;
  collapsed?: boolean; onToggle?: () => void;
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2" && !path.startsWith("/billing")) {
        e.preventDefault();
        router.push("/billing");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [path, router]);

  const matches = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
  const activeHref = ALL_HREFS.filter(matches).sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === activeHref;

  /** Full nav used in the mobile drawer and expanded desktop sidebar. */
  const navFull = (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {NAV.map((g) => {
        const items = g.items.filter((i) => !i.owner || user.role === "owner");
        if (!items.length) return null;
        return (
          <div key={g.section}>
            <p className="flex items-center gap-2 px-3 pb-2 text-[11px] font-semibold tracking-[0.14em] text-side-ink/60 uppercase">
              {g.dot ? <span className={cx("h-1.5 w-1.5 rounded-full", g.dot)} aria-hidden /> : null}{g.section}
            </p>
            <ul className="flex flex-col gap-0.5">
              {items.map((i) => {
                const active = isActive(i.href);
                return (
                  <li key={i.href}>
                    <Link href={i.href} onClick={() => setOpen(false)}
                      className={cx(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors",
                        active ? "bg-side-active text-white" : "text-side-ink hover:bg-white/5 hover:text-white",
                      )}>
                      <i.icon className={cx("h-[18px] w-[18px] shrink-0", active ? "text-primary" : "opacity-70 group-hover:opacity-100")} />
                      <span className="flex-1">{i.label}</span>
                      {i.key ? <span className="rounded border border-white/10 px-1 font-mono text-[10px] text-side-ink/70">{i.key}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  /** Icon-only nav used in the collapsed desktop sidebar. */
  const navCollapsed = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto py-4">
      {NAV.map((g) => {
        const items = g.items.filter((i) => !i.owner || user.role === "owner");
        if (!items.length) return null;
        return (
          <div key={g.section} className="flex flex-col gap-0.5 pb-3">
            {g.dot && <span className={cx("mx-auto mb-1 h-1 w-4 rounded-full opacity-40", g.dot)} aria-hidden />}
            {items.map((i) => {
              const active = isActive(i.href);
              return (
                <Link key={i.href} href={i.href}
                  title={i.label}
                  className={cx(
                    "group mx-1.5 flex items-center justify-center rounded-lg p-2.5 transition-colors",
                    active ? "bg-side-active text-white" : "text-side-ink hover:bg-white/5 hover:text-white",
                  )}>
                  <i.icon className={cx("h-[18px] w-[18px]", active ? "text-primary" : "opacity-70 group-hover:opacity-100")} />
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-white/10 p-3">
      <div className={cx("flex items-center rounded-lg px-2 py-2", collapsed ? "justify-center gap-0" : "gap-3")}>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/20 text-sm font-bold text-primary">
          {user.name.slice(0, 1).toUpperCase()}
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user.name}</p>
              <p className="text-xs text-side-ink capitalize">{user.role}</p>
            </div>
            <form action={logout}>
              <button className="rounded-md p-2 text-side-ink hover:bg-white/5 hover:text-white" title="Sign out" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </>
        )}
        {collapsed && (
          <form action={logout} className="mt-2">
            <button className="rounded-md p-2 text-side-ink hover:bg-white/5 hover:text-white" title="Sign out" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Desktop sidebar */}
      <aside className={cx(
        "no-print fixed inset-y-0 left-0 z-20 hidden flex-col bg-side transition-[width] duration-200 lg:flex",
        collapsed ? "w-16" : "w-64",
      )}>
        {/* Header: logo + shop info + collapse toggle */}
        <div className={cx("relative flex items-start pt-5 pb-2", collapsed ? "flex-col items-center px-0" : "px-5")}>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <Logo tone="dark" />
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/[0.04] p-2.5 ring-1 ring-white/5">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full" />
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-white">{shopName}</p>
                    <p className="text-[11px] text-side-ink/70">Your shop</p>
                  </div>
                </div>
              </div>
            </>
          )}
          {collapsed && logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-8 w-8 rounded-full mb-1" />
          )}
          {/* Collapse / expand toggle */}
          {onToggle && (
            <button
              onClick={onToggle}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cx(
                "flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-side text-side-ink hover:bg-white/10 hover:text-white transition-colors",
                collapsed ? "mt-2" : "absolute right-[-14px] top-5 z-10",
              )}
            >
              {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
        {collapsed ? navCollapsed : navFull}
        {footer}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-side">
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <Logo tone="dark" />
              <button onClick={() => setOpen(false)} className="rounded-md p-2 text-side-ink" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {navFull}
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}

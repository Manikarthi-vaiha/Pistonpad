"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3, Banknote, Boxes, FileText, LayoutDashboard, LogOut, Menu, PackagePlus, ReceiptIndianRupee, Settings, Upload, Users, Wallet, X,
} from "lucide-react";
import { Logo } from "./Logo";
import { cx } from "./ui";
import { logout } from "@/app/login/actions";

type Item = { href: string; label: string; icon: React.ElementType; owner?: boolean; key?: string };
const NAV: { section: string; items: Item[] }[] = [
  {
    section: "Counter",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/billing", label: "New bill", icon: ReceiptIndianRupee, key: "F2" },
      { href: "/invoices", label: "Invoices", icon: FileText },
      { href: "/customers", label: "Customers", icon: Users },
    ],
  },
  {
    section: "Stock",
    items: [
      { href: "/products", label: "Parts", icon: Boxes },
      { href: "/stock-in", label: "Stock in", icon: PackagePlus },
      { href: "/import", label: "Import parts", icon: Upload, owner: true },
    ],
  },
  {
    section: "Business",
    items: [
      { href: "/expenses", label: "Expenses", icon: Wallet },
      { href: "/collections", label: "Money received", icon: Banknote, owner: true },
      { href: "/reports", label: "Reports", icon: BarChart3, owner: true },
      { href: "/settings", label: "Settings", icon: Settings, owner: true },
    ],
  },
];

export function Sidebar({ user, shopName, logoUrl }: { user: { name: string; role: string }; shopName: string; logoUrl: string | null }) {
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

  const isActive = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

  const nav = (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {NAV.map((g) => {
        const items = g.items.filter((i) => !i.owner || user.role === "owner");
        if (!items.length) return null;
        return (
          <div key={g.section}>
            <p className="px-3 pb-2 text-[11px] font-semibold tracking-[0.14em] text-side-ink/60 uppercase">{g.section}</p>
            <ul className="flex flex-col gap-0.5">
              {items.map((i) => {
                const active = isActive(i.href);
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={() => setOpen(false)}
                      className={cx(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors",
                        active ? "bg-side-active text-white" : "text-side-ink hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <i.icon className={cx("h-[18px] w-[18px]", active ? "text-primary" : "opacity-70 group-hover:opacity-100")} />
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

  const footer = (
    <div className="border-t border-white/10 p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/20 text-sm font-bold text-primary">
          {user.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{user.name}</p>
          <p className="text-xs text-side-ink capitalize">{user.role}</p>
        </div>
        <form action={logout}>
          <button className="rounded-md p-2 text-side-ink hover:bg-white/5 hover:text-white" title="Sign out" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </form>
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
      <aside className="no-print fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-side lg:flex">
        <div className="px-5 pt-5 pb-2">
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
        {nav}
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
            {nav}
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}

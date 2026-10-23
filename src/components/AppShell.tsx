"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";

export function AppShell({
  user, shopName, logoUrl, children,
}: {
  user: { name: string; role: string }; shopName: string; logoUrl: string | null; children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  // Persist preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sidebar-collapsed");
      if (stored === "1") setCollapsed(true);
    } catch {}
  }, []);

  const toggle = () => setCollapsed((c) => {
    try { localStorage.setItem("sidebar-collapsed", c ? "0" : "1"); } catch {}
    return !c;
  });

  return (
    <div className="min-h-full">
      <Sidebar user={user} shopName={shopName} logoUrl={logoUrl} collapsed={collapsed} onToggle={toggle} />
      <main className={collapsed ? "lg:pl-16" : "lg:pl-64"}>
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}

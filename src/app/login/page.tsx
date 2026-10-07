import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import { Showcase } from "./Showcase";
import { Logo } from "@/components/Logo";
import { getShop } from "@/lib/shop";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const shop = await getShop();
  return (
    <main className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-side p-12 text-side-ink lg:flex lg:flex-col lg:justify-between [@media(max-height:820px)]:p-9">
        <div className="relative z-10"><Logo tone="dark" /></div>
        <Showcase />
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="rise-in mb-8 lg:hidden" style={{ "--d": "150ms" } as React.CSSProperties}>
            <Logo />
            <p className="mt-2 text-sm text-ink-2">Spare parts billing and used bike sales, in one place.</p>
          </div>
          <div className="rise-in mb-8 flex items-center gap-4" style={{ "--d": "230ms" } as React.CSSProperties}>
            {shop.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.logo_url} alt="" className="h-16 w-16 rounded-full shadow-md" />
            ) : null}
            <div>
              <p className="text-lg font-bold tracking-tight">{shop.shop_name}</p>
              <p className="text-sm text-ink-3">{shop.address.split("\n").pop()}</p>
            </div>
          </div>
          <div className="rise-in" style={{ "--d": "310ms" } as React.CSSProperties}>
            <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
            <p className="mt-1 text-sm text-ink-2">Use the login your shop owner gave you.</p>
          </div>
          <div className="rise-in" style={{ "--d": "390ms" } as React.CSSProperties}>
            <LoginForm next={typeof next === "string" ? next : "/"} />
          </div>
        </div>
      </section>
    </main>
  );
}


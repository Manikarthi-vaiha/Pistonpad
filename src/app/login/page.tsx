import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/Logo";
import { getShop } from "@/lib/shop";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const shop = await getShop();
  return (
    <main className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-side p-12 text-side-ink lg:flex lg:flex-col lg:justify-between">
        <Logo tone="dark" />
        <div className="relative z-10 max-w-md">
          <p className="text-[13px] font-semibold tracking-[0.2em] text-primary uppercase">Two-wheeler spares · wholesale</p>
          <h1 className="mt-4 text-4xl leading-tight font-bold text-white">
            Find any part in a million.
            <br />
            Bill it in seconds.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed">
            Stock by brand and bike model, GST invoices with CGST, SGST and IGST, credit tracking, and sales reports that
            tell you what to reorder.
          </p>
        </div>
        <dl className="relative z-10 grid grid-cols-3 gap-6 border-t border-white/10 pt-6 text-sm">
          {[
            ["10 lakh+", "parts searchable"],
            ["< 50 ms", "typical search"],
            ["GST-ready", "invoices & reports"],
          ].map(([a, b]) => (
            <div key={a}>
              <dt className="text-xl font-bold text-white">{a}</dt>
              <dd className="mt-1">{b}</dd>
            </div>
          ))}
        </dl>
        <Gear />
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <div className="mb-8 flex items-center gap-4">
            {shop.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.logo_url} alt="" className="h-16 w-16 rounded-full shadow-md" />
            ) : null}
            <div>
              <p className="text-lg font-bold tracking-tight">{shop.shop_name}</p>
              <p className="text-sm text-ink-3">{shop.address.split("\n").pop()}</p>
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-ink-2">Use the login your shop owner gave you.</p>
          <LoginForm next={typeof next === "string" ? next : "/"} />
        </div>
      </section>
    </main>
  );
}

function Gear() {
  // Decorative sprocket outline
  const teeth = 28;
  const pts = Array.from({ length: teeth * 2 }, (_, i) => {
    const r = i % 2 ? 250 : 272;
    const a = (i / (teeth * 2)) * Math.PI * 2;
    return `${300 + r * Math.cos(a)},${300 + r * Math.sin(a)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 600 600" aria-hidden className="pointer-events-none absolute -right-40 -bottom-40 h-[560px] w-[560px] opacity-[0.07]">
      <polygon points={pts} fill="none" stroke="white" strokeWidth="6" strokeLinejoin="round" />
      <circle cx="300" cy="300" r="180" fill="none" stroke="white" strokeWidth="6" />
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return <circle key={i} cx={300 + 110 * Math.cos(a)} cy={300 + 110 * Math.sin(a)} r="38" fill="none" stroke="white" strokeWidth="6" />;
      })}
      <circle cx="300" cy="300" r="42" fill="none" stroke="white" strokeWidth="6" />
    </svg>
  );
}

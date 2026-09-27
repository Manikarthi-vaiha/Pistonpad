import { Sidebar } from "@/components/Sidebar";
import { requireUser } from "@/lib/auth";
import { getShop } from "@/lib/shop";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const shop = await getShop();
  return (
    <div className="min-h-full">
      <Sidebar user={user} shopName={shop.shop_name} logoUrl={shop.logo_url} />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}

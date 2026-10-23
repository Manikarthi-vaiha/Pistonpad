import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { getShop } from "@/lib/shop";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const shop = await getShop();
  return (
    <AppShell user={user} shopName={shop.shop_name} logoUrl={shop.logo_url}>
      {children}
    </AppShell>
  );
}

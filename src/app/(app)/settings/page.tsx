import type { Metadata } from "next";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getCatalog } from "@/lib/products";
import { getShop } from "@/lib/shop";
import { CatalogSettings, PasswordForm, ShopForm, UsersSettings } from "./SettingsForms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requireUser("owner");
  const [shop, catalog, allModels, users] = await Promise.all([
    getShop(),
    getCatalog(),
    sql<{ id: number; brand_id: number; name: string; active: boolean; parts: number }[]>`
      select m.id, m.brand_id, m.name, m.active, coalesce(c.n, 0)::int as parts
      from bike_models m
      left join (select model_id, count(*) as n from product_models group by model_id) c on c.model_id = m.id
      order by m.brand_id, m.name`,
    sql<{ id: number; name: string; username: string; role: string; active: boolean }[]>`select id, name, username::text, role, active from users order by id`,
  ]);
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card><CardHeader title="Shop details" sub="Printed at the top of every invoice" /><ShopForm shop={shop} /></Card>
        <div className="flex flex-col gap-5">
          <Card><CardHeader title="Staff logins" sub="Staff can bill and manage stock. Only owners see costs, profit, reports and settings." /><UsersSettings users={users} me={me.uid} /></Card>
          <Card><CardHeader title="Change my password" /><PasswordForm /></Card>
        </div>
      </div>
      <Card className="mt-5">
        <CardHeader title="Brands, bike models and categories" sub="Models appear when you add a part and in the bike filter at billing" />
        <CatalogSettings brands={catalog.brands} models={allModels} categories={catalog.categories} />
      </Card>
    </>
  );
}

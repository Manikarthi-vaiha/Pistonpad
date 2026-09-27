import "server-only";
import { cache } from "react";
import { sql } from "./db";

export type Shop = {
  shop_name: string; address: string; phone: string; email: string; gstin: string; state_code: string;
  invoice_prefix: string; invoice_footer: string; logo_url: string | null;
};

/** Shop details for headers and invoices (without the logo bytes). */
export const getShop = cache(async (): Promise<Shop> => {
  const [s] = await sql<(Omit<Shop, "logo_url"> & { has_logo: boolean; logo_version: number })[]>`
    select shop_name, address, phone, email, gstin, state_code, invoice_prefix, invoice_footer,
           logo is not null as has_logo, logo_version
    from settings where id = 1`;
  const { has_logo, logo_version, ...rest } = s;
  return { ...rest, logo_url: has_logo ? `/api/shop-logo?v=${logo_version}` : null };
});

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { r2 } from "@/lib/billing-calc";
import { sql } from "@/lib/db";
import { applyStock } from "@/lib/invoices";

const input = z.object({
  supplier: z.string().trim().max(120),
  billRef: z.string().trim().max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updateCost: z.boolean(),
  items: z.array(z.object({ productId: z.number().int().positive(), qty: z.number().int().positive(), cost: z.number().min(0) })).min(1).max(500),
});

export async function savePurchase(data: z.infer<typeof input>): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const user = await requireUser();
  const r = input.safeParse(data);
  if (!r.success) return { ok: false, error: "Add at least one part with a quantity." };
  const d = r.data;
  try {
    const id = await sql.begin(async (tx) => {
      let supplierId: number | null = null;
      if (d.supplier) {
        const [s] = await tx<{ id: number }[]>`insert into suppliers (name) values (${d.supplier}) on conflict (name) do update set name = excluded.name returning id`;
        supplierId = s.id;
      }
      const total = r2(d.items.reduce((s, i) => s + i.qty * i.cost, 0));
      const [p] = await tx<{ id: number }[]>`
        insert into purchases (supplier_id, supplier_name, bill_ref, purchase_date, total, user_id)
        values (${supplierId}, ${d.supplier}, ${d.billRef}, ${d.date}, ${total}, ${user.uid}) returning id`;
      await tx`insert into purchase_items ${tx(d.items.map((i) => ({ purchase_id: p.id, product_id: i.productId, qty: i.qty, cost: i.cost })))}`;
      const byProduct = new Map<number, number>();
      for (const i of d.items) byProduct.set(i.productId, (byProduct.get(i.productId) ?? 0) + i.qty);
      const ids = [...byProduct.keys()].sort((a, b) => a - b);
      await tx`select id from products where id = any(${ids}::bigint[]) order by id for update`;
      await applyStock(tx, ids.map((id) => ({ id, change: byProduct.get(id)! })), "purchase", p.id, user.uid,
        [d.supplier, d.billRef].filter(Boolean).join(" · "));
      if (d.updateCost && user.role === "owner") {
        const items = d.items.filter((i) => i.cost > 0);
        if (items.length) {
          await tx`update products p set cost_price = v.cost
                   from (select unnest(${items.map((i) => i.productId)}::bigint[]) as id, unnest(${items.map((i) => i.cost)}::numeric[]) as cost) v
                   where p.id = v.id`;
        }
      }
      return p.id;
    });
    revalidatePath("/products");
    return { ok: true, id };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not save the stock entry. Nothing was changed — please try again." };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { applyStock } from "@/lib/invoices";

export type FormState = { error?: string; ok?: boolean; id?: number };

const productSchema = z.object({
  sku: z.string().trim().min(1, "Enter a part number.").max(60),
  name: z.string().trim().min(2, "Enter the part name.").max(200),
  brandId: z.coerce.number().int().positive("Choose a bike brand."),
  categoryId: z.coerce.number().int().positive().nullable(),
  hsn: z.string().trim().max(10).default("8714"),
  unit: z.string().trim().max(10).default("pcs"),
  costPrice: z.coerce.number().min(0),
  salePrice: z.coerce.number().min(0),
  showroomCost: z.coerce.number().min(0).nullable(),
  retailPrice: z.coerce.number().min(0).nullable(),
  mrp: z.coerce.number().min(0).nullable(),
  gstRate: z.coerce.number().refine((v) => [0, 5, 12, 18, 28].includes(v), "Choose a GST rate."),
  openingStock: z.coerce.number().int().min(0).default(0),
  reorderLevel: z.coerce.number().int().min(0).default(0),
  rack: z.string().trim().max(20).default(""),
  modelIds: z.array(z.coerce.number().int().positive()).max(500),
  active: z.boolean().default(true),
});

function parse(form: FormData) {
  const num = (k: string) => { const v = String(form.get(k) ?? "").trim(); return v === "" ? null : v; };
  return productSchema.safeParse({
    sku: form.get("sku"), name: form.get("name"), brandId: form.get("brandId"),
    categoryId: num("categoryId"), hsn: form.get("hsn") || "8714", unit: form.get("unit") || "pcs",
    costPrice: num("costPrice") ?? 0, salePrice: num("salePrice") ?? 0, mrp: num("mrp"),
    showroomCost: num("showroomCost"), retailPrice: num("retailPrice"),
    gstRate: form.get("gstRate"), openingStock: num("openingStock") ?? 0, reorderLevel: num("reorderLevel") ?? 0,
    rack: form.get("rack") || "", modelIds: form.getAll("modelIds"), active: form.get("active") !== "off",
  });
}

export async function saveProduct(id: number | null, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const r = parse(form);
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Check the highlighted fields." };
  const d = r.data;
  if (d.salePrice < d.costPrice && user.role === "owner" && form.get("confirmLoss") !== "yes")
    return { error: "The selling rate is below the cost price. Tick “Sell below cost” if that's intended." };

  try {
    const newId = await sql.begin(async (tx) => {
      const values = {
        sku: d.sku, name: d.name, brand_id: d.brandId, category_id: d.categoryId, hsn: d.hsn, unit: d.unit,
        sale_price: d.salePrice, retail_price: d.retailPrice, showroom_cost: d.showroomCost, mrp: d.mrp, gst_rate: d.gstRate, reorder_level: d.reorderLevel, rack: d.rack, active: d.active,
        ...(user.role === "owner" ? { cost_price: d.costPrice } : {}),
      };
      let pid = id;
      if (pid) {
        await tx`update products set ${tx(values)}, updated_at = now() where id = ${pid}`;
      } else {
        const [row] = await tx<{ id: number }[]>`insert into products ${tx({ ...values, cost_price: d.costPrice, stock: 0 })} returning id`;
        pid = row.id;
        if (d.openingStock > 0) await applyStock(tx, [{ id: pid, change: d.openingStock }], "opening", null, user.uid);
      }
      await tx`delete from product_models where product_id = ${pid}`;
      if (d.modelIds.length) {
        await tx`insert into product_models ${tx(d.modelIds.map((m) => ({ model_id: m, product_id: pid })))} on conflict do nothing`;
      }
      return pid;
    });
    revalidatePath("/products");
    return { ok: true, id: newId };
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "23505") return { error: `Part number “${d.sku}” already exists.` };
    console.error(e);
    return { error: "Could not save the part. Please try again." };
  }
}

export async function adjustStock(productId: number, change: number, reason: "adjust" | "purchase", note: string): Promise<FormState> {
  const user = await requireUser();
  if (!Number.isInteger(change) || change === 0) return { error: "Enter how many to add or remove (e.g. 10 or -2)." };
  try {
    await sql.begin(async (tx) => {
      const [p] = await tx<{ stock: number }[]>`select stock from products where id = ${productId} for update`;
      if (!p) throw new Error("missing");
      if (p.stock + change < 0) throw new RangeError(`Only ${p.stock} in stock — you can't remove ${-change}.`);
      await applyStock(tx, [{ id: productId, change }], reason, null, user.uid, note);
    });
    revalidatePath(`/products/${productId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof RangeError ? e.message : "Could not update stock. Please try again." };
  }
}

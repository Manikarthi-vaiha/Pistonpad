"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { deleteFinancier, saveFinancier, toggleFinancierActive } from "@/lib/financiers";

const num = () => z.union([z.literal(""), z.coerce.number().min(0).max(999999)]).transform((v) => (v === "" ? null : Number(v)));

const schema = z.object({
  name: z.string().trim().min(1, "Enter the financier name.").max(120),
  interest_rate: num(),
  rate_type: z.enum(["flat", "reducing"]),
  doc_charge: num(),
  processing_fee_pct: num(),
  round_to: z.coerce.number().int().min(0).max(10000).default(0),
  notes: z.string().max(500).default(""),
});

export type FinancierState = { error?: string; ok?: string };

export async function saveFinancierAction(id: number | null, _: FinancierState, f: FormData): Promise<FinancierState> {
  await requireUser("owner");
  const r = schema.safeParse({
    name: f.get("name"), interest_rate: f.get("interest_rate"), rate_type: f.get("rate_type"),
    doc_charge: f.get("doc_charge"), processing_fee_pct: f.get("processing_fee_pct"),
    round_to: f.get("round_to") || 0, notes: f.get("notes") ?? "",
  });
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Check the details." };
  const d = r.data;
  await saveFinancier(id, {
    name: d.name, interest_rate: d.interest_rate, rate_type: d.rate_type,
    doc_charge: d.doc_charge, processing_fee_pct: d.processing_fee_pct,
    round_to: d.round_to, notes: d.notes,
  });
  revalidatePath("/finance");
  redirect("/finance");
}

export async function toggleFinancier(id: number, active: boolean): Promise<void> {
  await requireUser("owner");
  await toggleFinancierActive(id, active);
  revalidatePath("/finance");
}

export async function deleteFinancierAction(id: number): Promise<FinancierState> {
  await requireUser("owner");
  try {
    await deleteFinancier(id);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/finance");
  redirect("/finance");
}

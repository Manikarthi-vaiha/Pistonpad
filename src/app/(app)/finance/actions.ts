"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { deleteFinancier, saveFinancier, toggleFinancierActive } from "@/lib/financiers";

const schema = z.object({
  name: z.string().trim().min(1, "Enter the financier name.").max(120),
  notes: z.string().max(500).default(""),
});

export type FinancierState = { error?: string; ok?: string };

export async function saveFinancierAction(id: number | null, _: FinancierState, f: FormData): Promise<FinancierState> {
  await requireUser("owner");
  const r = schema.safeParse({ name: f.get("name"), notes: f.get("notes") ?? "" });
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Check the details." };
  const d = r.data;
  await saveFinancier(id, { name: d.name, notes: d.notes });
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

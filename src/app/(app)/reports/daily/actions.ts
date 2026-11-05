"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { saveDailyOpening } from "@/lib/daily-report";

export async function saveOpeningBalance(date: string, opening: number): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser("owner");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Invalid date." };
  if (opening < 0) return { ok: false, error: "Opening balance cannot be negative." };
  try {
    await saveDailyOpening(date, user.branchId ?? 1, opening, user.uid);
    revalidatePath("/reports/daily");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save opening balance." };
  }
}

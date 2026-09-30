"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export type ExpenseState = { error?: string; ok?: string; key?: number };

const expense = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  category: z.string().trim().min(1, "Choose a category.").max(60),
  amount: z.coerce.number().positive("Enter an amount above zero.").max(100_000_000),
  mode: z.string().trim().max(20),
  paidTo: z.string().trim().max(120),
  note: z.string().trim().max(300),
});

export async function addExpense(_: ExpenseState, f: FormData): Promise<ExpenseState> {
  const user = await requireUser();
  const r = expense.safeParse({
    date: f.get("date"), category: f.get("category"), amount: String(f.get("amount") ?? "").replace(/[₹,\s]/g, ""),
    mode: f.get("mode") ?? "Cash", paidTo: f.get("paidTo") ?? "", note: f.get("note") ?? "",
  });
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Check the expense details." };
  const d = r.data;
  if (d.date > new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)) return { error: "The date can't be in the future." };
  await sql`insert into expenses (expense_date, category, amount, payment_mode, paid_to, note, user_id)
            values (${d.date}, ${d.category}, ${d.amount}, ${d.mode || "Cash"}, ${d.paidTo}, ${d.note}, ${user.uid})`;
  revalidatePath("/expenses");
  revalidatePath("/");
  return { ok: `Saved ₹${d.amount.toLocaleString("en-IN")} for ${d.category}.`, key: Date.now() };
}

export async function deleteExpense(id: number): Promise<ExpenseState> {
  await requireUser("owner");
  await sql`delete from expenses where id = ${id}`;
  revalidatePath("/expenses");
  revalidatePath("/");
  return { ok: "Expense deleted." };
}

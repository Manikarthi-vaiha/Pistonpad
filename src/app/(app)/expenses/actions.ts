"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { BUSINESSES } from "@/lib/expenses";
import { audit } from "@/lib/audit";

export type ExpenseState = { error?: string; ok?: string; key?: number; business?: string };

const expense = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  category: z.string().trim().min(1, "Choose a category.").max(60),
  amount: z.coerce.number().positive("Enter an amount above zero.").max(100_000_000),
  mode: z.string().trim().max(20),
  paidTo: z.string().trim().max(120),
  note: z.string().trim().max(300),
  business: z.enum(["parts", "vehicles", "shared"], { error: "Choose which business this expense is for." }),
});

export async function addExpense(_: ExpenseState, f: FormData): Promise<ExpenseState> {
  const user = await requireUser();
  const r = expense.safeParse({
    date: f.get("date"), category: f.get("category"), amount: String(f.get("amount") ?? "").replace(/[₹,\s]/g, ""),
    mode: f.get("mode") ?? "Cash", paidTo: f.get("paidTo") ?? "", note: f.get("note") ?? "", business: f.get("business"),
  });
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Check the expense details." };
  const d = r.data;
  if (d.date > new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)) return { error: "The date can't be in the future." };
  await sql`insert into expenses (expense_date, category, amount, payment_mode, paid_to, note, user_id, business)
            values (${d.date}, ${d.category}, ${d.amount}, ${d.mode || "Cash"}, ${d.paidTo}, ${d.note}, ${user.uid}, ${d.business})`;
  audit("expense", "create", `Added ₹${d.amount.toLocaleString("en-IN")} expense: ${d.category} (${BUSINESSES[d.business].label})`,
    { userId: user.uid, userName: user.name });
  revalidatePath("/expenses");
  revalidatePath("/");
  return { ok: `Saved ₹${d.amount.toLocaleString("en-IN")} for ${d.category} (${BUSINESSES[d.business].label}).`, key: Date.now(), business: d.business };
}

export async function deleteExpense(id: number): Promise<ExpenseState> {
  const user = await requireUser("owner");
  const [e] = await sql<{ category: string; amount: number }[]>`select category, amount from expenses where id = ${id}`;
  await sql`delete from expenses where id = ${id}`;
  audit("expense", "delete", `Deleted expense${e ? `: ${e.category} ₹${Number(e.amount).toLocaleString("en-IN")}` : ` #${id}`}`,
    { entityId: id, userId: user.uid, userName: user.name });
  revalidatePath("/expenses");
  revalidatePath("/");
  return { ok: "Expense deleted." };
}

export async function createCategoryAction(_: ExpenseState, f: FormData): Promise<ExpenseState> {
  await requireUser();
  const name = String(f.get("name") ?? "").trim().slice(0, 60);
  if (!name) return { error: "Enter a category name." };
  await sql`insert into expense_categories (name) values (${name}) on conflict (name) do nothing`;
  revalidatePath("/expenses");
  return { ok: name, key: Date.now() };
}

export async function renameCategoryAction(oldName: string, newName: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const name = newName.trim().slice(0, 60);
  if (!name) return { error: "Enter a name." };
  if (name === oldName) return {};
  // Upsert the new name, delete old; update all existing expenses
  await sql`insert into expense_categories (name) values (${name}) on conflict (name) do nothing`;
  await sql`update expenses set category = ${name} where category = ${oldName}`;
  await sql`delete from expense_categories where name = ${oldName}`;
  audit("expense", "rename_category", `Renamed expense category "${oldName}" → "${name}"`,
    { userId: user.uid, userName: user.name });
  revalidatePath("/expenses");
  return {};
}

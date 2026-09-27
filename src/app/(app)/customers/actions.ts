"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { GSTIN_RE } from "@/lib/format";

export async function saveCustomer(id: number, _: { error?: string }, form: FormData): Promise<{ error?: string }> {
  await requireUser();
  const name = String(form.get("name") ?? "").trim();
  const phone = String(form.get("phone") ?? "").replace(/\s/g, "");
  const gstin = String(form.get("gstin") ?? "").trim().toUpperCase();
  const address = String(form.get("address") ?? "").trim();
  const creditLimit = Math.max(0, Number(form.get("creditLimit")) || 0);
  if (!name) return { error: "Enter the customer's name." };
  if (gstin && !GSTIN_RE.test(gstin)) return { error: "The GSTIN doesn't look right. It should be 15 characters, like 33ABCDE1234F1Z5." };
  try {
    await sql`update customers set name = ${name}, phone = ${phone || null}, gstin = ${gstin}, state_code = ${gstin.slice(0, 2)},
              address = ${address}, credit_limit = ${creditLimit} where id = ${id}`;
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "23505") return { error: `Another customer already has phone ${phone}.` };
    throw e;
  }
  redirect(`/customers/${id}?saved=1`);
}

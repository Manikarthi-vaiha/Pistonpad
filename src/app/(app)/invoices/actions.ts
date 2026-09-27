"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { BillError, cancelInvoice, createInvoice, receivePayment, type InvoiceInput } from "@/lib/invoices";

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false, error: string };

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof BillError) return { ok: false, error: e.message };
  if (e && typeof e === "object" && "issues" in e) return { ok: false, error: "Some bill details are missing or invalid. Check the quantities and rates." };
  console.error(e);
  return { ok: false, error: "Something went wrong while saving. Nothing was saved — please try again." };
}

export async function saveBill(input: InvoiceInput): Promise<ActionResult<{ id: number; invoiceNo: string }>> {
  const user = await requireUser();
  try {
    const r = await createInvoice(input, user.uid);
    revalidatePath("/");
    return { ok: true, data: r };
  } catch (e) {
    return fail(e);
  }
}

export async function addPayment(invoiceId: number, amount: number, mode: string, note: string): Promise<ActionResult<null>> {
  const user = await requireUser();
  try {
    await receivePayment(invoiceId, amount, mode, note, user.uid);
    revalidatePath(`/invoices/${invoiceId}`);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function voidInvoice(invoiceId: number, reason: string): Promise<ActionResult<null>> {
  const user = await requireUser("owner");
  try {
    await cancelInvoice(invoiceId, reason, user.uid);
    revalidatePath(`/invoices/${invoiceId}`);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

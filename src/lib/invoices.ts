import "server-only";
import { z } from "zod";
import type { TransactionSql } from "postgres";
import { sql } from "./db";
import { calcBill, r2 } from "./billing-calc";
import { financialYear, GSTIN_RE } from "./format";

export const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank", "Credit"] as const;

export const invoiceInput = z.object({
  customer: z.object({
    id: z.number().int().positive().optional(),
    name: z.string().trim().max(120).default(""),
    phone: z.string().trim().max(20).default(""),
    gstin: z.string().trim().toUpperCase().max(15).default(""),
  }),
  items: z
    .array(z.object({
      productId: z.number().int().positive(),
      qty: z.number().int().positive().max(100000),
      rate: z.number().nonnegative().max(10_000_000),
      discountPct: z.number().min(0).max(100).default(0),
      // "outside": bought from a showroom / outside market for this sale — doesn't use stock.
      source: z.enum(["stock", "outside"]).default("stock"),
      // What was paid outside, per unit (outside lines only; defaults to the part's showroom cost).
      outsideCost: z.number().nonnegative().max(10_000_000).optional(),
    }))
    .min(1, "Add at least one part to the bill.")
    .max(300),
  interstate: z.boolean().default(false),
  priceType: z.enum(["wholesale", "showroom"]).default("wholesale"),
  paymentMode: z.enum(PAYMENT_MODES),
  amountPaid: z.number().nonnegative(),
  notes: z.string().max(500).default(""),
});
export type InvoiceInput = z.infer<typeof invoiceInput>;

export class BillError extends Error {}

/**
 * Creates an invoice in one transaction:
 * locks the parts, checks stock, numbers the invoice per financial year (gap-free),
 * writes items, reduces stock, records stock movements and the payment.
 */
export async function createInvoice(input: InvoiceInput, userId: number) {
  const data = invoiceInput.parse(input);
  if (data.customer.gstin && !GSTIN_RE.test(data.customer.gstin)) throw new BillError("The customer GSTIN doesn't look right. It should be 15 characters, like 33ABCDE1234F1Z5.");
  if (data.paymentMode === "Credit" && !data.customer.name && !data.customer.id) throw new BillError("Enter the customer's name for a credit bill.");

  const items = data.items;
  const ids = [...new Set(items.map((i) => i.productId))];

  return sql.begin(async (tx) => {
    const products = await tx<{ id: number; sku: string; name: string; hsn: string; unit: string; gst_rate: number; cost_price: number; showroom_cost: number | null; stock: number; brand: string; active: boolean }[]>`
      select p.id, p.sku, p.name, p.hsn, p.unit, p.gst_rate, p.cost_price, p.showroom_cost, p.stock, p.active, coalesce(b.name::text, '') as brand
      from products p left join brands b on b.id = p.brand_id
      where p.id = any(${ids}::bigint[])
      order by p.id
      for update of p`;
    const byId = new Map(products.map((p) => [p.id, p]));

    // Only lines sold from own stock need (and reduce) stock.
    const need = new Map<number, number>();
    for (const it of items) {
      const p = byId.get(it.productId);
      if (!p || !p.active) throw new BillError("A part on this bill was deleted or disabled. Remove it and try again.");
      if (it.source === "stock") need.set(it.productId, (need.get(it.productId) ?? 0) + it.qty);
    }
    const short: string[] = [];
    for (const [id, q] of need) {
      const p = byId.get(id)!;
      if (p.stock < q) short.push(`${p.name} (${p.sku}): only ${p.stock} in stock — mark it “Bought outside” if you fetched it from a showroom`);
    }
    if (short.length) throw new BillError(`Not enough stock — ${short.join("; ")}.`);

    const lines = items.map((it) => {
      const p = byId.get(it.productId)!;
      const unitCost = it.source === "outside" ? (it.outsideCost ?? p.showroom_cost ?? p.cost_price) : p.cost_price;
      return { it, p, calcIn: { qty: it.qty, rate: it.rate, discountPct: it.discountPct, gstRate: p.gst_rate, cost: unitCost } };
    });
    const bill = calcBill(lines.map((l) => l.calcIn), data.interstate);

    // Customer: existing id, or find/create by phone, or walk-in
    let customerId: number | null = data.customer.id ?? null;
    let customerName = data.customer.name || "Walk-in customer";
    if (customerId) {
      const [c] = await tx<{ name: string }[]>`select name from customers where id = ${customerId}`;
      if (!c) throw new BillError("That customer no longer exists.");
      customerName = data.customer.name || c.name;
    } else if (data.customer.phone || data.paymentMode === "Credit") {
      const phone = data.customer.phone.replace(/\s/g, "") || null;
      const [c] = phone
        ? await tx<{ id: number }[]>`
            insert into customers (name, phone, gstin, state_code)
            values (${customerName}, ${phone}, ${data.customer.gstin}, ${data.customer.gstin.slice(0, 2)})
            on conflict (phone) where phone is not null and phone <> '' do update set
              gstin = case when excluded.gstin <> '' then excluded.gstin else customers.gstin end
            returning id`
        : await tx<{ id: number }[]>`
            insert into customers (name, gstin, state_code) values (${customerName}, ${data.customer.gstin}, ${data.customer.gstin.slice(0, 2)})
            returning id`;
      customerId = c.id;
    }

    const paid = Math.min(r2(data.amountPaid), bill.total);
    const status = paid >= bill.total ? "paid" : paid > 0 ? "partial" : "due";
    const fy = financialYear();
    const [{ last_seq: seq }] = await tx<{ last_seq: number }[]>`
      insert into invoice_counters (fy, last_seq) values (${fy}, 1)
      on conflict (fy) do update set last_seq = invoice_counters.last_seq + 1
      returning last_seq`;
    const [{ invoice_prefix }] = await tx<{ invoice_prefix: string }[]>`select invoice_prefix from settings where id = 1`;
    const invoiceNo = `${invoice_prefix}/${fy}/${String(seq).padStart(5, "0")}`;

    const [inv] = await tx<{ id: number }[]>`
      insert into invoices (invoice_no, fy, seq, customer_id, customer_name, customer_phone, customer_gstin, is_interstate,
        subtotal, discount, taxable, cgst, sgst, igst, round_off, total, cost_total, amount_paid, payment_mode, status, notes, user_id, price_type)
      values (${invoiceNo}, ${fy}, ${seq}, ${customerId}, ${customerName}, ${data.customer.phone}, ${data.customer.gstin}, ${data.interstate},
        ${bill.subtotal}, ${bill.discount}, ${bill.taxable}, ${bill.cgst}, ${bill.sgst}, ${bill.igst}, ${bill.roundOff}, ${bill.total},
        ${bill.cost}, ${paid}, ${data.paymentMode}, ${status}, ${data.notes}, ${userId}, ${data.priceType})
      returning id`;

    await tx`insert into invoice_items ${tx(lines.map((l, i) => ({
      invoice_id: inv.id, product_id: l.p.id, sku: l.p.sku, name: l.p.name, hsn: l.p.hsn, brand: l.p.brand, unit: l.p.unit,
      qty: l.it.qty, rate: l.it.rate, discount_pct: l.it.discountPct, taxable: bill.lines[i].taxable, gst_rate: l.p.gst_rate,
      tax: bill.lines[i].tax, total: bill.lines[i].total, cost: bill.lines[i].cost, source: l.it.source,
    })))}`;

    await applyStock(tx, [...need].map(([id, q]) => ({ id, change: -q })), "sale", inv.id, userId);

    if (paid > 0) {
      await tx`insert into payments (invoice_id, customer_id, amount, mode, user_id)
               values (${inv.id}, ${customerId}, ${paid}, ${data.paymentMode === "Credit" ? "Cash" : data.paymentMode}, ${userId})`;
    }
    return { id: inv.id, invoiceNo, total: bill.total };
  });
}

type Tx = TransactionSql<Record<string, unknown>>;

/** Applies stock changes in one statement and writes the stock ledger. */
export async function applyStock(tx: Tx, changes: { id: number; change: number }[], reason: string, refId: number | null, userId: number, note = "") {
  if (!changes.length) return;
  const rows = await tx<{ id: number; stock: number }[]>`
    update products p set stock = p.stock + v.change, updated_at = now()
    from (select unnest(${changes.map((c) => c.id)}::bigint[]) as id, unnest(${changes.map((c) => c.change)}::int[]) as change) v
    where p.id = v.id
    returning p.id, p.stock`;
  const bal = new Map(rows.map((r) => [r.id, r.stock]));
  await tx`insert into stock_movements ${tx(changes.map((c) => ({
    product_id: c.id, change: c.change, balance: bal.get(c.id) ?? 0, reason, ref_id: refId, note, user_id: userId,
  })))}`;
}

export async function receivePayment(invoiceId: number, amount: number, mode: string, note: string, userId: number) {
  return sql.begin(async (tx) => {
    const [inv] = await tx<{ total: number; amount_paid: number; status: string; customer_id: number | null }[]>`
      select total, amount_paid, status, customer_id from invoices where id = ${invoiceId} for update`;
    if (!inv) throw new BillError("Invoice not found.");
    if (inv.status === "cancelled") throw new BillError("This invoice is cancelled.");
    const due = r2(inv.total - inv.amount_paid);
    if (amount <= 0) throw new BillError("Enter an amount greater than zero.");
    if (amount > due + 0.001) throw new BillError(`Only ${due.toFixed(2)} is due on this invoice.`);
    const paid = r2(inv.amount_paid + amount);
    await tx`update invoices set amount_paid = ${paid}, status = ${paid >= inv.total ? "paid" : "partial"} where id = ${invoiceId}`;
    await tx`insert into payments (invoice_id, customer_id, amount, mode, note, user_id)
             values (${invoiceId}, ${inv.customer_id}, ${amount}, ${mode}, ${note}, ${userId})`;
  });
}

export async function cancelInvoice(invoiceId: number, reason: string, userId: number) {
  return sql.begin(async (tx) => {
    const [inv] = await tx<{ status: string; invoice_no: string }[]>`select status, invoice_no from invoices where id = ${invoiceId} for update`;
    if (!inv) throw new BillError("Invoice not found.");
    if (inv.status === "cancelled") return;
    const items = await tx<{ product_id: number; qty: number }[]>`
      select product_id, sum(qty)::int as qty from invoice_items
      where invoice_id = ${invoiceId} and source = 'stock' group by product_id order by product_id`;
    await tx`select id from products where id = any(${items.map((i) => i.product_id)}::bigint[]) order by id for update`;
    await applyStock(tx, items.map((i) => ({ id: i.product_id, change: i.qty })), "cancel", invoiceId, userId, `Cancelled ${inv.invoice_no}`);
    await tx`update invoices set status = 'cancelled', notes = trim(notes || ' ' || ${"Cancelled: " + reason}) where id = ${invoiceId}`;
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Streams CSV so even a full year of item-level sales never sits in memory at once. */
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user || user.role !== "owner") return NextResponse.json({ error: "Only the owner can download reports." }, { status: 403 });
  const p = req.nextUrl.searchParams;
  const from = p.get("from") ?? "", to = p.get("to") ?? "", type = p.get("type") ?? "invoices";
  if (!DATE.test(from) || !DATE.test(to)) return NextResponse.json({ error: "Choose a valid date range." }, { status: 400 });

  let header: string[];
  let query;
  if (type === "payments") {
    header = ["Date", "Invoice no", "Customer", "Payment method", "Amount", "Type", "Note", "Received by"];
    query = sql`select to_char(p.paid_on, 'YYYY-MM-DD'), i.invoice_no, i.customer_name, p.mode, p.amount,
                  case when p.created_at <= i.created_at + interval '2 minutes' then 'At billing' else 'Credit collected' end,
                  p.note, coalesce(u.name, '')
                from payments p join invoices i on i.id = p.invoice_id left join users u on u.id = p.user_id
                where p.paid_on between ${from} and ${to} and i.status <> 'cancelled'
                order by p.paid_on, p.id`;
  } else if (type === "outside") {
    header = ["Invoice no", "Date", "Customer", "Part no", "Part", "Brand", "Qty", "Paid outside (total)", "Sold for (before GST)", "Profit", "Rate list"];
    query = sql`select i.invoice_no, to_char(i.invoice_date, 'YYYY-MM-DD'), i.customer_name, it.sku, it.name, it.brand, it.qty,
                  it.cost, it.taxable, it.taxable - it.cost, i.price_type
                from invoice_items it join invoices i on i.id = it.invoice_id
                where i.invoice_date between ${from} and ${to} and i.status <> 'cancelled' and it.source = 'outside'
                order by i.id, it.id`;
  } else if (type === "expenses") {
    header = ["Date", "Category", "Amount", "Paid by", "Paid to", "Note", "Added by"];
    query = sql`select to_char(e.expense_date, 'YYYY-MM-DD'), e.category, e.amount, e.payment_mode, e.paid_to, e.note, coalesce(u.name, '')
                from expenses e left join users u on u.id = e.user_id
                where e.expense_date between ${from} and ${to} order by e.expense_date, e.id`;
  } else if (type === "items") {
    header = ["Invoice no", "Date", "Customer", "Customer GSTIN", "Part no", "Part", "Brand", "HSN", "Qty", "Unit", "Rate", "Discount %", "Taxable", "GST %", "Tax", "Total", "Cost", "Profit", "Source"];
    query = sql`select i.invoice_no, to_char(i.invoice_date, 'YYYY-MM-DD'), i.customer_name, i.customer_gstin, it.sku, it.name, it.brand, it.hsn,
                  it.qty, it.unit, it.rate, it.discount_pct, it.taxable, it.gst_rate, it.tax, it.total, it.cost, it.taxable - it.cost,
                  case when it.source = 'outside' then 'Bought outside' else 'Stock' end
                from invoice_items it join invoices i on i.id = it.invoice_id
                where i.invoice_date between ${from} and ${to} and i.status <> 'cancelled' order by i.id, it.id`;
  } else if (type === "hsn") {
    header = ["HSN", "UQC", "Total quantity", "Total value", "Taxable value", "IGST", "CGST", "SGST", "GST rate"];
    query = sql`select it.hsn, upper(min(it.unit)), sum(it.qty), sum(it.total), sum(it.taxable),
                  sum(case when i.is_interstate then it.tax else 0 end),
                  round(sum(case when i.is_interstate then 0 else it.tax end) / 2, 2),
                  round(sum(case when i.is_interstate then 0 else it.tax end) / 2, 2), it.gst_rate
                from invoice_items it join invoices i on i.id = it.invoice_id
                where i.invoice_date between ${from} and ${to} and i.status <> 'cancelled'
                group by it.hsn, it.gst_rate order by it.hsn, it.gst_rate`;
  } else {
    header = ["Invoice no", "Date", "Customer", "Phone", "GSTIN", "Inter-state", "Taxable", "CGST", "SGST", "IGST", "Round off", "Total", "Paid", "Balance", "Payment mode", "Status"];
    query = sql`select invoice_no, to_char(invoice_date, 'YYYY-MM-DD'), customer_name, customer_phone, customer_gstin,
                  case when is_interstate then 'Yes' else 'No' end, taxable, cgst, sgst, igst, round_off, total, amount_paid,
                  total - amount_paid, payment_mode, status
                from invoices where invoice_date between ${from} and ${to} order by id`;
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      ctrl.enqueue(enc.encode("﻿" + header.join(",") + "\n"));
      try {
        await query.values().cursor(2000, (rows) => {
          ctrl.enqueue(enc.encode(rows.map((r) => r.map(cell).join(",")).join("\n") + "\n"));
        });
      } catch (e) {
        console.error(e);
      }
      ctrl.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-${from}-to-${to}.csv"`,
    },
  });
}

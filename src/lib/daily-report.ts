import "server-only";
import { sql } from "./db";

export type DailyReportRow = {
  no: number;
  label: string;
  section: string;
  debit: number;
  credit: number;
};

export type DailyReport = {
  date: string;
  opening: number;
  rows: DailyReportRow[];
  totalDebit: number;
  totalCredit: number;
  closing: number;
};

export async function getDailyOpening(date: string, branchId: number): Promise<number> {
  const [row] = await sql<{ opening: number }[]>`
    select opening from daily_cash_balance where balance_date = ${date}::date and branch_id = ${branchId}`;
  return row ? Number(row.opening) : 0;
}

export async function saveDailyOpening(date: string, branchId: number, opening: number, userId: number) {
  await sql`
    insert into daily_cash_balance (balance_date, branch_id, opening, created_by, updated_at)
    values (${date}::date, ${branchId}, ${opening}, ${userId}, now())
    on conflict (balance_date, branch_id) do update set opening = excluded.opening, updated_at = now()`;
}

export async function getDailyReport(date: string, branchId: number): Promise<DailyReport> {
  const bf = sql`and branch_id = ${branchId}`;

  const [opening, spareParts, creditCollections, bikeActivity, expenses, stockIn] = await Promise.all([
    getDailyOpening(date, branchId),

    // Spare parts: new invoices billed today, grouped by payment mode (excludes Pay Later)
    sql<{ mode: string; total: number }[]>`
      select payment_mode as mode, coalesce(sum(amount_paid), 0) as total
      from invoices
      where invoice_date = ${date}::date and status <> 'cancelled' and payment_mode <> 'Pay Later' ${bf}
      group by payment_mode order by total desc`,

    // Credit collections: payments received today on previously due invoices
    sql<{ total: number }[]>`
      select coalesce(sum(p.amount), 0) as total
      from payments p
      join invoices i on i.id = p.invoice_id
      where p.paid_on::date = ${date}::date and i.invoice_date < ${date}::date and i.branch_id = ${branchId}`,

    // Bike sales and purchases on this date (join vehicles to filter by branch)
    sql<{ kind: string; mode: string; total: number }[]>`
      select d.kind, d.payment_mode as mode, coalesce(sum(d.price), 0) as total
      from vehicle_invoices d
      join vehicles v on v.id = d.vehicle_id
      where d.doc_date = ${date}::date and d.status = 'issued' and v.branch_id = ${branchId}
      group by d.kind, d.payment_mode order by d.kind, total desc`,

    // Expenses paid today
    sql<{ category: string; total: number }[]>`
      select category, coalesce(sum(amount), 0) as total
      from expenses
      where expense_date = ${date}::date ${bf}
      group by category order by total desc`,

    // Stock purchases today
    sql<{ supplier: string; total: number }[]>`
      select coalesce(nullif(trim(supplier_name), ''), 'Supplier') as supplier, coalesce(sum(total), 0) as total
      from purchases
      where purchase_date = ${date}::date ${bf}
      group by supplier_name order by total desc`,
  ]);

  const rows: DailyReportRow[] = [];
  let no = 1;

  // Spare parts collections (credit)
  for (const r of spareParts) {
    if (Number(r.total) > 0) {
      rows.push({ no: no++, label: `Spare parts — ${r.mode}`, section: "Spare parts collections", debit: 0, credit: Number(r.total) });
    }
  }
  // Credit collections (credit)
  if (Number(creditCollections[0]?.total ?? 0) > 0) {
    rows.push({ no: no++, label: "Due collected (credit sales)", section: "Spare parts collections", debit: 0, credit: Number(creditCollections[0].total) });
  }

  // Bike sales (credit) and purchases (debit)
  for (const r of bikeActivity) {
    if (Number(r.total) > 0) {
      if (r.kind === "sale") {
        rows.push({ no: no++, label: `Bike sale — ${r.mode}`, section: "Bike sales & purchases", debit: 0, credit: Number(r.total) });
      } else {
        rows.push({ no: no++, label: `Bike purchased — ${r.mode}`, section: "Bike sales & purchases", debit: Number(r.total), credit: 0 });
      }
    }
  }

  // Expenses (debit)
  for (const e of expenses) {
    if (Number(e.total) > 0) {
      rows.push({ no: no++, label: e.category, section: "Expenses paid", debit: Number(e.total), credit: 0 });
    }
  }

  // Stock purchases (debit)
  for (const s of stockIn) {
    if (Number(s.total) > 0) {
      rows.push({ no: no++, label: `Stock — ${s.supplier}`, section: "Stock purchases", debit: Number(s.total), credit: 0 });
    }
  }

  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const closing = opening + totalCredit - totalDebit;

  return { date, opening, rows, totalDebit, totalCredit, closing };
}

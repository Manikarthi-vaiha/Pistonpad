import "server-only";
import { sql } from "./db";

export type Financier = {
  id: number; name: string; interest_rate: number | null; rate_type: string;
  doc_charge: number | null; processing_fee_pct: number | null; round_to: number;
  notes: string; active: boolean;
};

export async function listFinanciers(activeOnly = false) {
  return sql<Financier[]>`
    select id, name, interest_rate, rate_type, doc_charge, processing_fee_pct, round_to, notes, active
    from financiers
    ${activeOnly ? sql`where active = true` : sql``}
    order by name`;
}

export async function getFinancier(id: number) {
  const [f] = await sql<Financier[]>`
    select id, name, interest_rate, rate_type, doc_charge, processing_fee_pct, round_to, notes, active
    from financiers where id = ${id}`;
  return f ?? null;
}

export async function saveFinancier(id: number | null, data: {
  name: string; interest_rate: number | null; rate_type: string;
  doc_charge: number | null; processing_fee_pct: number | null; round_to: number; notes: string;
}) {
  if (id) {
    await sql`update financiers set
      name = ${data.name}, interest_rate = ${data.interest_rate}, rate_type = ${data.rate_type},
      doc_charge = ${data.doc_charge}, processing_fee_pct = ${data.processing_fee_pct},
      round_to = ${data.round_to}, notes = ${data.notes}, updated_at = now()
      where id = ${id}`;
    return id;
  }
  const [row] = await sql<{ id: number }[]>`
    insert into financiers (name, interest_rate, rate_type, doc_charge, processing_fee_pct, round_to, notes)
    values (${data.name}, ${data.interest_rate}, ${data.rate_type}, ${data.doc_charge}, ${data.processing_fee_pct}, ${data.round_to}, ${data.notes})
    returning id`;
  return row.id;
}

export async function toggleFinancierActive(id: number, active: boolean) {
  await sql`update financiers set active = ${active}, updated_at = now() where id = ${id}`;
}

export async function deleteFinancier(id: number) {
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from vehicle_invoices where buyer_finance_id = ${id}`;
  if (n > 0) throw new Error(`This financier is on ${n} invoice${n === 1 ? "" : "s"} and cannot be deleted. Deactivate it instead.`);
  await sql`delete from financiers where id = ${id}`;
}

/**
 * Monthly EMI calculation.
 *   reducing: standard formula  P × r × (1+r)^n / ((1+r)^n − 1)
 *   flat:     interest = P × rate/100 × n/12, EMI = (P + interest) / n
 * roundTo: if > 0, round the EMI up to the nearest multiple (e.g. 100 → ₹3247 → ₹3300)
 */
export function calcEmi(principal: number, annualRatePct: number, months: number, rateType: "flat" | "reducing", roundTo = 0): number {
  if (principal <= 0 || months <= 0) return 0;
  let emi: number;
  if (rateType === "flat") {
    const totalInterest = principal * (annualRatePct / 100) * (months / 12);
    emi = (principal + totalInterest) / months;
  } else {
    const r = annualRatePct / 100 / 12;
    if (r === 0) return principal / months;
    emi = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  }
  if (roundTo > 0) emi = Math.ceil(emi / roundTo) * roundTo;
  return Math.round(emi * 100) / 100;
}

// GST bill arithmetic, shared by the billing screen (preview) and the server (source of truth).

export type CalcLine = { qty: number; rate: number; discountPct: number; gstRate: number; cost?: number };

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function calcLine(l: CalcLine) {
  const gross = r2(l.qty * l.rate);
  const discount = r2((gross * (l.discountPct || 0)) / 100);
  const taxable = r2(gross - discount);
  const tax = r2((taxable * l.gstRate) / 100);
  return { gross, discount, taxable, tax, total: r2(taxable + tax), cost: r2(l.qty * (l.cost ?? 0)) };
}

export function calcBill(lines: CalcLine[], interstate: boolean) {
  const calc = lines.map(calcLine);
  const sum = (k: keyof ReturnType<typeof calcLine>) => r2(calc.reduce((s, c) => s + c[k], 0));
  const subtotal = sum("gross");
  const discount = sum("discount");
  const taxable = sum("taxable");
  const tax = sum("tax");
  const igst = interstate ? tax : 0;
  const cgst = interstate ? 0 : r2(tax / 2);
  const sgst = interstate ? 0 : r2(tax - cgst);
  const raw = r2(taxable + tax);
  const total = Math.round(raw);
  return { lines: calc, subtotal, discount, taxable, tax, cgst, sgst, igst, roundOff: r2(total - raw), total, cost: sum("cost") };
}

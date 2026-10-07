// Client-safe helpers for Indian vehicle registration numbers.

export const RTO_STATES: Record<string, string> = {
  AN: "Andaman & Nicobar", AP: "Andhra Pradesh", AR: "Arunachal Pradesh", AS: "Assam", BR: "Bihar", CG: "Chhattisgarh",
  CH: "Chandigarh", DD: "Daman & Diu", DL: "Delhi", DN: "Dadra & Nagar Haveli", GA: "Goa", GJ: "Gujarat",
  HP: "Himachal Pradesh", HR: "Haryana", JH: "Jharkhand", JK: "Jammu & Kashmir", KA: "Karnataka", KL: "Kerala",
  LA: "Ladakh", LD: "Lakshadweep", MH: "Maharashtra", ML: "Meghalaya", MN: "Manipur", MP: "Madhya Pradesh",
  MZ: "Mizoram", NL: "Nagaland", OD: "Odisha", OR: "Odisha", PB: "Punjab", PY: "Puducherry", RJ: "Rajasthan",
  SK: "Sikkim", TN: "Tamil Nadu", TR: "Tripura", TS: "Telangana", TG: "Telangana", UK: "Uttarakhand",
  UA: "Uttarakhand", UP: "Uttar Pradesh", WB: "West Bengal",
};

/** "tn-76 ab 1234" → "TN76AB1234" */
export const normalizeReg = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

const STATE_RE = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/;
const BHARAT_RE = /^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/;

export type RegInfo =
  | { valid: true; kind: "state"; display: string; state: string; rto: string }
  | { valid: true; kind: "bharat"; display: string; year: string }
  | { valid: false; display: string };

/** Splits a registration number into its parts: TN76AB1234 → "TN 76 AB 1234", Tamil Nadu, RTO TN-76. */
export function parseReg(raw: string): RegInfo {
  const s = normalizeReg(raw);
  const b = BHARAT_RE.exec(s);
  if (b) return { valid: true, kind: "bharat", display: `${b[1]} BH ${b[3]} ${b[4]}`, year: `20${b[1]}` };
  const m = STATE_RE.exec(s);
  if (m && RTO_STATES[m[1]]) {
    const rto = m[2].padStart(2, "0");
    return { valid: true, kind: "state", display: [m[1], rto, m[3], m[4]].filter(Boolean).join(" "), state: RTO_STATES[m[1]], rto: `${m[1]}-${rto}` };
  }
  return { valid: false, display: s };
}

export const formatReg = (s: string) => parseReg(s).display;

export const VEHICLE_STATUS: Record<string, { label: string; tone: "good" | "warn" | "info" | "neutral" }> = {
  in_stock: { label: "In stock", tone: "good" },
  reserved: { label: "Reserved", tone: "warn" },
  in_service: { label: "In service", tone: "info" },
  sold: { label: "Sold", tone: "neutral" },
};

export const CONDITIONS = [
  ["excellent", "Excellent"], ["good", "Good"], ["fair", "Fair"], ["needs_work", "Needs work"],
] as const;

export const FUELS = ["Petrol", "Electric", "CNG"];

export const EVENT_KINDS: Record<string, string> = {
  purchase: "Bought", service: "Service", repair: "Repair", parts: "Parts fitted", accident: "Accident",
  inspection: "Inspection", insurance: "Insurance", transfer: "RC transfer", sale: "Sold", note: "Note",
};
/** Events whose cost counts as money spent getting the bike ready to sell. */
export const REFURB_KINDS = ["service", "repair", "parts", "insurance", "transfer", "inspection"];

/** Days until a document expires (negative = already expired), or null when not recorded. */
export function daysLeft(date: string | null | undefined, today = new Date()) {
  if (!date) return null;
  const d = new Date(date + "T00:00:00");
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}

/** 1 → "1st", 2 → "2nd", 11 → "11th" */
export function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
}

/** Parts checked on every used bike; staff can also type any other part. */
export const COMMON_PARTS = [
  "Battery", "Front tyre", "Rear tyre", "Chain & sprocket", "Front brake", "Rear brake", "Clutch", "Engine oil",
  "Air filter", "Spark plug", "Engine", "Gearbox", "Front suspension", "Rear shocks", "Headlight", "Tail light",
  "Indicators", "Horn", "Self starter", "Kick start", "Speedometer", "Mirrors", "Seat", "Fuel tank", "Side panels",
  "Front mudguard", "Silencer", "Wiring", "Keys",
];

export const PART_STATUS: Record<string, { label: string; tone: "neutral" | "bad" | "info" | "good" }> = {
  ok: { label: "OK", tone: "neutral" },
  damaged: { label: "Damaged", tone: "bad" },
  repaired: { label: "Repaired", tone: "info" },
  replaced: { label: "Replaced", tone: "good" },
};

export const PHOTO_KINDS: Record<string, string> = { vehicle: "Bike", damage: "Damage", document: "Documents", owner: "Owner" };

export const RC_STATUS: Record<string, { label: string; tone: "good" | "warn" | "bad" }> = {
  original: { label: "Original RC", tone: "good" },
  duplicate: { label: "Duplicate RC", tone: "warn" },
  with_financier: { label: "RC with financier", tone: "warn" },
  missing: { label: "RC missing", tone: "bad" },
};
export const RC_TYPES: Record<string, string> = { smart_card: "Smart card", paper: "Paper (old book)" };

export const INSURANCE_TYPES: Record<string, string> = {
  comprehensive: "Comprehensive", zero_dep: "Zero depreciation", third_party: "Third party only", own_damage: "Own damage only",
};

/** Papers the shop can physically hold for a used bike. `transfer` = needed to move the RC to the buyer. */
export const DOC_CHECKLIST: { key: string; label: string; transfer?: boolean }[] = [
  { key: "rc", label: "RC (original)", transfer: true },
  { key: "insurance", label: "Insurance copy", transfer: true },
  { key: "puc", label: "PUC certificate", transfer: true },
  { key: "form29", label: "Form 29 (transfer notice)", transfer: true },
  { key: "form30", label: "Form 30 (transfer report)", transfer: true },
  { key: "form28", label: "Form 28 (NOC for other state)" },
  { key: "form35", label: "Form 35 (loan closure)" },
  { key: "bank_noc", label: "Bank / finance NOC letter" },
  { key: "owner_id", label: "Owner ID proof (Aadhaar / PAN)", transfer: true },
  { key: "owner_address", label: "Owner address proof" },
  { key: "invoice", label: "Original purchase invoice" },
  { key: "service_book", label: "Service book" },
  { key: "spare_key", label: "Spare key" },
  { key: "manual", label: "Owner's manual" },
];

/** "Used bikes for every budget" bands on our asking price (₹). */
export const BUDGETS: { key: string; label: string; min: number; max: number | null }[] = [
  { key: "u50k", label: "Under ₹50K", min: 0, max: 50_000 },
  { key: "50-75k", label: "₹50K – 75K", min: 50_000, max: 75_000 },
  { key: "75k-1l", label: "₹75K – 1L", min: 75_000, max: 100_000 },
  { key: "1-1.5l", label: "₹1L – 1.5L", min: 100_000, max: 150_000 },
  { key: "1.5-2l", label: "₹1.5L – 2L", min: 150_000, max: 200_000 },
  { key: "2-3l", label: "₹2L – 3L", min: 200_000, max: 300_000 },
  { key: "a3l", label: "Above ₹3L", min: 300_000, max: null },
];

/** What still stops the RC being transferred to a buyer. */
export function transferCheck(
  v: { rc_status: string; docs_in_hand: string[]; hypothecation: string; loan_status: string; form35_submitted: boolean; insurance_valid_till: string | null; puc_valid_till: string | null },
  pendingFines: number,
) {
  const missing: string[] = [];
  if (v.rc_status === "missing") missing.push("RC is missing: apply for a duplicate RC");
  else if (v.rc_status === "with_financier") missing.push("Get the RC back from the financier");
  for (const d of DOC_CHECKLIST) if (d.transfer && !v.docs_in_hand.includes(d.key)) missing.push(`Collect ${d.label}`);
  const financier = v.hypothecation.trim() || "the financier";
  if (v.loan_status === "active") missing.push(`Close the loan with ${financier}`);
  if (v.loan_status === "active" || v.loan_status === "closed") missing.push(`Get the NOC from ${financier}`);
  if (v.loan_status === "noc_received" && !v.form35_submitted) missing.push("Submit Form 35 to the RTO to remove the loan from the RC");
  const ins = daysLeft(v.insurance_valid_till);
  if (ins == null || ins < 0) missing.push(ins == null ? "Add valid insurance" : "Renew the insurance (expired)");
  const puc = daysLeft(v.puc_valid_till);
  if (puc == null || puc < 0) missing.push(puc == null ? "Add a valid PUC" : "Renew the PUC (expired)");
  if (pendingFines > 0) missing.push(`Clear pending fines of ₹${pendingFines.toLocaleString("en-IN")}`);
  return { ready: missing.length === 0, missing };
}

export const LOAN_STATUS: Record<string, { label: string; tone: "good" | "warn" | "bad" | "info" | "neutral"; help: string }> = {
  none: { label: "No loan", tone: "good", help: "RC shows no hypothecation" },
  active: { label: "Active loan", tone: "bad", help: "EMIs still running; must be closed before transfer" },
  closed: { label: "Loan closed · NOC pending", tone: "warn", help: "Paid off, waiting for the financier's NOC" },
  noc_received: { label: "NOC received", tone: "info", help: "Submit Form 35 to the RTO to remove the loan from the RC" },
  removed: { label: "Removed from RC", tone: "good", help: "RTO has removed the hypothecation" },
};
export const LOAN_PAID_BY: Record<string, string> = { owner: "Previous owner (seller)", shop: "We (shop)", buyer: "Buyer (customer)" };
/** Loans cleared as part of the bike deal count in the bike's cost; only shop-paid ones are our cash. */
export const LOAN_IN_COST = ["shop", "buyer"];

/** Finance categories for the bikes list (by loan status). */
export const FINANCE_FILTERS: { key: string; label: string; statuses: string[]; tone: "bad" | "warn" | "info" | "good" }[] = [
  { key: "under", label: "Under finance", statuses: ["active"], tone: "bad" },
  { key: "noc", label: "NOC pending", statuses: ["closed"], tone: "warn" },
  { key: "form35", label: "Form 35 pending", statuses: ["noc_received"], tone: "info" },
  { key: "clear", label: "Loan-free", statuses: ["none", "removed"], tone: "good" },
];

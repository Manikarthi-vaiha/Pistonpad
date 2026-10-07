// Expense categories shared by the form (client) and the server.
export const EXPENSE_CATEGORIES = [
  "Rent",
  "Salary & wages",
  "Electricity",
  "Transport & freight",
  "Phone & internet",
  "Tea & refreshments",
  "Shop maintenance",
  "Packing material",
  "Bank charges",
  "Taxes & fees",
  "Other",
];

export const EXPENSE_MODES = ["Cash", "UPI", "Card", "Bank", "Cheque"];

/** The two businesses, plus costs they share. */
export const BUSINESSES: Record<string, { label: string; short: string; hint: string }> = {
  parts: { label: "Spare parts", short: "Parts", hint: "Parts shop: stock, billing, staff for the counter" },
  vehicles: { label: "Used bikes", short: "Bikes", hint: "Buying and selling second-hand bikes" },
  shared: { label: "Shared", short: "Shared", hint: "Used by both: rent, electricity, owner's phone…" },
};
export type Business = "parts" | "vehicles" | "shared";

/** Payment methods a bike buyer can use (finance = paid by the buyer's loan company). */
export const BIKE_PAYMENT_MODES = ["Cash", "UPI", "Bank", "Card", "Cheque", "Finance"];

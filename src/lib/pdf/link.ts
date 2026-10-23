import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Unguessable share links for invoice PDFs, so a customer can open their bill from WhatsApp
 * without signing in. The token is an HMAC of the invoice id with the app's SESSION_SECRET.
 */
function sign(id: number, scope = "invoice-pdf") {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", secret).update(`${scope}:${id}`).digest("base64url").slice(0, 24);
}

function matches(token: string, want: string) {
  const a = Buffer.from(want), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const invoicePdfPath = (id: number) => `/i/${id}/${sign(id)}`;
export const verifyInvoiceToken = (id: number, token: string) => matches(token, sign(id));

// Bike sale invoices and purchase receipts use their own scope, so a parts-invoice link can't open them.
export const vehicleDocPdfPath = (id: number) => `/v/${id}/${sign(id, "vehicle-doc")}`;
export const verifyVehicleDocToken = (id: number, token: string) => matches(token, sign(id, "vehicle-doc"));

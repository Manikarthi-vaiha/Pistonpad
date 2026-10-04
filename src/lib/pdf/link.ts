import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Unguessable share links for invoice PDFs, so a customer can open their bill from WhatsApp
 * without signing in. The token is an HMAC of the invoice id with the app's SESSION_SECRET.
 */
function sign(id: number) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", secret).update(`invoice-pdf:${id}`).digest("base64url").slice(0, 24);
}

export const invoicePdfPath = (id: number) => `/i/${id}/${sign(id)}`;

export function verifyInvoiceToken(id: number, token: string) {
  const want = Buffer.from(sign(id));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got);
}

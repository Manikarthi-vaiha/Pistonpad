import { verifyInvoiceToken } from "@/lib/pdf/link";
import { renderInvoicePdf } from "@/lib/pdf/invoice-pdf";

/** Public, token-protected invoice PDF — the link shared with customers on WhatsApp. */
export async function GET(req: Request, ctx: RouteContext<"/i/[id]/[token]">) {
  const { id, token } = await ctx.params;
  if (!/^\d+$/.test(id) || !verifyInvoiceToken(Number(id), token)) {
    return new Response("This invoice link is not valid.", { status: 404 });
  }
  const pdf = await renderInvoicePdf(Number(id));
  if (!pdf) return new Response("Invoice not found.", { status: 404 });
  const name = `${pdf.invoiceNo.replace(/[^A-Za-z0-9-]+/g, "-")}.pdf`;
  const download = new URL(req.url).searchParams.has("download");
  return new Response(new Uint8Array(pdf.buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

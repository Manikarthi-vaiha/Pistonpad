import { verifyVehicleDocToken } from "@/lib/pdf/link";
import { renderVehicleDocPdf } from "@/lib/pdf/vehicle-doc-pdf";

/** Public, token-protected PDF of a bike sale invoice or purchase receipt: the link shared on WhatsApp. */
export async function GET(req: Request, ctx: RouteContext<"/v/[id]/[token]">) {
  const { id, token } = await ctx.params;
  if (!/^\d+$/.test(id) || !verifyVehicleDocToken(Number(id), token)) {
    return new Response("This document link is not valid.", { status: 404 });
  }
  const pdf = await renderVehicleDocPdf(Number(id));
  if (!pdf) return new Response("Document not found.", { status: 404 });
  const name = `${pdf.docNo.replace(/[^A-Za-z0-9-]+/g, "-")}.pdf`;
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

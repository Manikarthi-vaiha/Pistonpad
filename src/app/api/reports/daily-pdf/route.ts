import { type NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { renderDailyPdf } from "@/lib/pdf/daily-pdf";

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user || (user.role !== "owner" && user.role !== "super_admin")) {
    return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  }
  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }
  const buf = await renderDailyPdf(date, user.branchId ?? 1);
  if (!buf) return NextResponse.json({ error: "Could not generate PDF." }, { status: 500 });
  const filename = `cash-book-${date}.pdf`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

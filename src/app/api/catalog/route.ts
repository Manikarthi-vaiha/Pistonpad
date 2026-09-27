import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getCatalog } from "@/lib/products";

export async function GET() {
  if (!(await currentUser())) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  return NextResponse.json(await getCatalog(), { headers: { "Cache-Control": "private, max-age=60" } });
}

import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { findBySku, suggestSku } from "@/lib/products";

const int = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : null);

/**
 * GET ?brand=&category=  → { suggestion }  next free part number for that brand + category
 * GET ?check=SKU          → { exists, id, name }  whether a part number is already used
 */
export async function GET(req: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const p = req.nextUrl.searchParams;
  const check = p.get("check");
  if (check !== null) {
    const hit = check.trim() ? await findBySku(check) : null;
    return NextResponse.json({ exists: !!hit, id: hit?.id ?? null, name: hit?.name ?? null });
  }
  const brand = int(p.get("brand"));
  if (!brand) return NextResponse.json({ suggestion: null });
  return NextResponse.json({ suggestion: await suggestSku(brand, int(p.get("category"))) });
}

import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { searchProducts } from "@/lib/products";

const int = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const p = req.nextUrl.searchParams;
  const stock = p.get("stock");
  const result = await searchProducts({
    q: p.get("q") ?? "",
    brandId: int(p.get("brand")),
    modelId: int(p.get("model")),
    categoryId: int(p.get("category")),
    stock: stock === "low" || stock === "out" || stock === "in" ? stock : undefined,
    after: int(p.get("after")),
    limit: int(p.get("limit")) ?? 25,
  });
  // Staff don't need purchase cost at the counter.
  const rows = user.role === "owner" ? result.rows : result.rows.map((r) => ({ ...r, cost_price: 0 }));
  return NextResponse.json({ rows, nextCursor: result.nextCursor });
}

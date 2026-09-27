import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ rows: [] });
  const digits = q.replace(/\D/g, "");
  const rows = await sql`
    select c.id, c.name, c.phone, c.gstin, c.state_code, c.credit_limit,
      coalesce((select sum(total - amount_paid) from invoices i where i.customer_id = c.id and i.status in ('due','partial')), 0) as due
    from customers c
    where ${digits.length >= 4 ? sql`c.phone like ${digits + "%"} or` : sql``} lower(c.name) like ${"%" + q.toLowerCase().replace(/[\\%_]/g, "\\$&") + "%"}
    order by c.name limit 8`;
  return NextResponse.json({ rows });
}

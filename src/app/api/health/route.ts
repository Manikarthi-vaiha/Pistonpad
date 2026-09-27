import { sql } from "@/lib/db";

/** For the hosting platform's uptime check: confirms the app can reach the database. */
export async function GET() {
  try {
    await sql`select 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}

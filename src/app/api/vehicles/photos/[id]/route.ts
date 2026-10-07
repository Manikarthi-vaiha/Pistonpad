import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

/** A used-bike photo for signed-in staff. `?size=thumb` returns the small version. Photos never change, so cache hard. */
export async function GET(req: Request, ctx: RouteContext<"/api/vehicles/photos/[id]">) {
  if (!(await currentUser())) return new Response(null, { status: 401 });
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return new Response(null, { status: 404 });
  const thumb = new URL(req.url).searchParams.get("size") === "thumb";
  const [p] = thumb
    ? await sql<{ bytes: Buffer }[]>`select thumb as bytes from vehicle_photos where id = ${id}`
    : await sql<{ bytes: Buffer; mime: string }[]>`select data as bytes, mime from vehicle_photos where id = ${id}`;
  if (!p) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(p.bytes), {
    headers: { "Content-Type": thumb ? "image/jpeg" : ("mime" in p ? p.mime : "image/jpeg"), "Cache-Control": "private, max-age=31536000, immutable" },
  });
}

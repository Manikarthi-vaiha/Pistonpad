import { sql } from "@/lib/db";

/** The shop's logo. Public (it's printed on every invoice); cached per upload version. */
export async function GET() {
  const [s] = await sql<{ logo: Buffer | null; logo_type: string | null }[]>`select logo, logo_type from settings where id = 1`;
  if (!s?.logo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(s.logo), {
    headers: { "Content-Type": s.logo_type ?? "image/png", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}

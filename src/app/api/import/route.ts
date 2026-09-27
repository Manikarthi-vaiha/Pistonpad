import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { importProductsCsv } from "@/lib/importer";

export const maxDuration = 3600;

/** Accepts a raw CSV body and streams progress back as newline-delimited JSON. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user || user.role !== "owner") return NextResponse.json({ error: "Only the owner can import parts." }, { status: 403 });
  if (!req.body) return NextResponse.json({ error: "No file received." }, { status: 400 });

  const body = req.body;
  async function* text() {
    const decoder = new TextDecoder();
    const reader = body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
    yield decoder.decode();
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: unknown) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const stats = await importProductsCsv(sql, text(), user.uid, (s) => send({ progress: s }));
        await sql`analyze products`;
        send({ done: stats });
      } catch (e) {
        send({ error: e instanceof Error ? e.message : "Import failed." });
      }
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}

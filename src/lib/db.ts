import "server-only";
import postgres from "postgres";

declare global {
  var __sql: ReturnType<typeof postgres> | undefined;
}

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  // Serverless hosts (Vercel) connect through a pooler such as Neon's "-pooler" host or PgBouncer,
  // which doesn't support prepared statements; keep each function instance's pool small there.
  const pooled = /-pooler\.|pgbouncer=true/.test(url);
  const serverless = !!process.env.VERCEL;
  return postgres(url, {
    max: Number(process.env.DB_POOL_SIZE ?? (serverless ? 3 : 10)),
    prepare: !pooled,
    idle_timeout: serverless ? 5 : 30,
    // numeric -> JS number. Money values stay well inside double precision.
    types: {
      numeric: {
        to: 1700,
        from: [1700],
        serialize: (x: number) => String(x),
        parse: (x: string) => Number(x),
      },
      bigint: {
        to: 20,
        from: [20],
        serialize: (x: number) => String(x),
        parse: (x: string) => Number(x),
      },
    },
  });
}

// Reuse one pool across hot reloads in development.
export const sql = globalThis.__sql ?? create();
if (process.env.NODE_ENV !== "production") globalThis.__sql = sql;

export type Sql = typeof sql;

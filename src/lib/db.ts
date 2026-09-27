import "server-only";
import postgres from "postgres";

declare global {
  var __sql: ReturnType<typeof postgres> | undefined;
}

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  return postgres(url, {
    max: Number(process.env.DB_POOL_SIZE ?? 10),
    idle_timeout: 30,
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

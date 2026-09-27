import "server-only";
import postgres from "postgres";

type Db = ReturnType<typeof postgres>;

declare global {
  var __sql: Db | undefined;
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

// Connect on first use, not when the module loads: `next build` imports every route
// and must work without a database (e.g. on Vercel before one is attached).
// One pool is reused across hot reloads in development.
function db(): Db {
  globalThis.__sql ??= create() as unknown as Db;
  return globalThis.__sql;
}

export const sql = new Proxy(function () {} as unknown as Db, {
  apply: (_t, _this, args) => (db() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_t, prop) => {
    const target = db();
    const value = Reflect.get(target, prop, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

export type Sql = Db;

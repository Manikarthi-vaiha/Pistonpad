// Applies db/migrations/*.sql in order, once each. Plain JS so it also runs inside the production image.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (see .env.example)");
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
const dir = join(process.cwd(), "db", "migrations");

try {
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql`select name from schema_migrations`).map((r) => r.name));
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    process.stdout.write(`Applying ${f} ... `);
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(join(dir, f), "utf8"));
      await tx`insert into schema_migrations (name) values (${f})`;
    });
    console.log("done");
  }
  console.log("Database is up to date.");
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await sql.end();
}

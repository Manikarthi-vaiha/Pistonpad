/**
 * Import parts from a CSV file on this computer — best for very large files (millions of rows).
 *   npm run import -- path/to/parts.csv
 * Same columns as the template in the app (Import parts → Download template).
 */
import { createReadStream } from "node:fs";
import { connect } from "./_db";
import { importProductsCsv } from "../src/lib/importer";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run import -- path/to/parts.csv");
  process.exit(1);
}
const sql = connect();
const t0 = Date.now();

async function* chunks() {
  for await (const c of createReadStream(file, { encoding: "utf8", highWaterMark: 1 << 20 })) yield c as string;
}

importProductsCsv(sql, chunks(), null, (s) => {
  const secs = (Date.now() - t0) / 1000;
  process.stdout.write(`\r  ${s.rows.toLocaleString("en-IN")} rows · ${s.inserted.toLocaleString("en-IN")} new · ${s.updated.toLocaleString("en-IN")} updated · ${Math.round(s.rows / secs).toLocaleString("en-IN")}/s   `);
})
  .then(async (s) => {
    await sql`analyze products`;
    console.log(`\nDone: ${s.inserted.toLocaleString("en-IN")} added, ${s.updated.toLocaleString("en-IN")} updated, ${s.skipped} skipped.`);
    for (const e of s.errors) console.log("  - " + e);
  })
  .catch((e) => { console.error("\n" + (e instanceof Error ? e.message : e)); process.exitCode = 1; })
  .finally(() => sql.end());

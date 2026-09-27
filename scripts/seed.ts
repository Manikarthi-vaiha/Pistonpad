import bcrypt from "bcryptjs";
import { connect } from "./_db";
import { BRAND_MODELS, CATEGORIES, UNIVERSAL_BRAND } from "../db/catalog-data";

const sql = connect();

async function main() {
  // Brands and models
  let order = 10;
  for (const [brand, models] of Object.entries(BRAND_MODELS)) {
    const [b] = await sql<{ id: number }[]>`
      insert into brands (name, sort_order) values (${brand}, ${order})
      on conflict (name) do update set sort_order = excluded.sort_order
      returning id`;
    order += 10;
    if (models.length) {
      await sql`
        insert into bike_models ${sql(models.map((name) => ({ brand_id: b.id, name })))}
        on conflict (brand_id, name) do nothing`;
    }
  }
  await sql`
    insert into brands (name, sort_order, is_universal) values (${UNIVERSAL_BRAND}, 999, true)
    on conflict (name) do update set is_universal = true`;

  await sql`insert into categories ${sql(CATEGORIES.map((name) => ({ name })))} on conflict (name) do nothing`;

  // First owner account
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD;
  const [existing] = await sql`select id from users where username = ${username}`;
  if (!existing) {
    if (!password) throw new Error("Set ADMIN_PASSWORD in .env.local before seeding.");
    await sql`
      insert into users (name, username, password_hash, role)
      values ('Owner', ${username}, ${await bcrypt.hash(password, 10)}, 'owner')`;
    console.log(`Created owner login "${username}" (password from ADMIN_PASSWORD in .env.local).`);
  }

  const [{ brands, models }] = await sql`
    select (select count(*) from brands)::int as brands, (select count(*) from bike_models)::int as models`;
  console.log(`Catalogue ready: ${brands} brands, ${models} bike models, ${CATEGORIES.length} categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());

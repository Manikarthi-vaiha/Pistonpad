"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { GSTIN_RE } from "@/lib/format";

export type SettingsState = { error?: string; ok?: string };
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const isUnique = (e: unknown) => !!e && typeof e === "object" && "code" in e && e.code === "23505";

export async function saveShop(_: SettingsState, f: FormData): Promise<SettingsState> {
  await requireUser("owner");
  const gstin = s(f, "gstin").toUpperCase();
  if (gstin && !GSTIN_RE.test(gstin)) return { error: "The GSTIN doesn't look right. It should be 15 characters, like 33ABCDE1234F1Z5." };
  const prefix = s(f, "invoice_prefix").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "INV";
  await sql`update settings set shop_name = ${s(f, "shop_name") || "My Spares Shop"}, address = ${s(f, "address")}, phone = ${s(f, "phone")},
            email = ${s(f, "email")}, gstin = ${gstin}, state_code = ${gstin ? gstin.slice(0, 2) : s(f, "state_code") || "33"},
            invoice_prefix = ${prefix}, invoice_footer = ${s(f, "invoice_footer")}, updated_at = now() where id = 1`;
  revalidatePath("/", "layout");
  return { ok: "Shop details saved." };
}

export async function addBrand(_: SettingsState, f: FormData): Promise<SettingsState> {
  await requireUser("owner");
  const name = s(f, "name");
  if (!name) return { error: "Enter a brand name." };
  try { await sql`insert into brands (name) values (${name})`; } catch (e) { if (isUnique(e)) return { error: `${name} already exists.` }; throw e; }
  revalidatePath("/settings");
  return { ok: `Added ${name}.` };
}

export async function addModels(brandId: number, _: SettingsState, f: FormData): Promise<SettingsState> {
  await requireUser("owner");
  const names = s(f, "names").split(/[,\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 200);
  if (!names.length) return { error: "Type one or more model names, separated by commas." };
  const r = await sql`insert into bike_models ${sql(names.map((name) => ({ brand_id: brandId, name })))}
                      on conflict (brand_id, name) do update set active = true`;
  revalidatePath("/settings");
  return { ok: `${r.count} model${r.count === 1 ? "" : "s"} saved.` };
}

export async function toggleModel(modelId: number, active: boolean) {
  await requireUser("owner");
  await sql`update bike_models set active = ${active} where id = ${modelId}`;
  revalidatePath("/settings");
}

export async function addCategory(_: SettingsState, f: FormData): Promise<SettingsState> {
  await requireUser("owner");
  const name = s(f, "name");
  if (!name) return { error: "Enter a category name." };
  try { await sql`insert into categories (name) values (${name})`; } catch (e) { if (isUnique(e)) return { error: `${name} already exists.` }; throw e; }
  revalidatePath("/settings");
  return { ok: `Added ${name}.` };
}

export async function addUser(_: SettingsState, f: FormData): Promise<SettingsState> {
  await requireUser("owner");
  const name = s(f, "name"), username = s(f, "username").toLowerCase(), password = String(f.get("password") ?? "");
  const role = f.get("role") === "owner" ? "owner" : "staff";
  if (!name || !username) return { error: "Enter a name and a username." };
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) return { error: "Usernames use 3–30 letters, numbers, dots or dashes." };
  if (password.length < 8) return { error: "Passwords need at least 8 characters." };
  try {
    await sql`insert into users (name, username, password_hash, role) values (${name}, ${username}, ${await bcrypt.hash(password, 10)}, ${role})`;
  } catch (e) { if (isUnique(e)) return { error: `The username ${username} is taken.` }; throw e; }
  revalidatePath("/settings");
  return { ok: `${name} can now sign in as ${username}.` };
}

export async function setUserActive(userId: number, active: boolean): Promise<SettingsState> {
  const me = await requireUser("owner");
  if (me.uid === userId) return { error: "You can't disable your own login." };
  await sql`update users set active = ${active} where id = ${userId}`;
  revalidatePath("/settings");
  return { ok: active ? "Login enabled." : "Login disabled." };
}

export async function changePassword(_: SettingsState, f: FormData): Promise<SettingsState> {
  const me = await requireUser();
  const target = me.role === "owner" && f.get("userId") ? Number(f.get("userId")) : me.uid;
  const password = String(f.get("password") ?? "");
  if (password.length < 8) return { error: "Passwords need at least 8 characters." };
  if (target === me.uid) {
    const [u] = await sql<{ password_hash: string }[]>`select password_hash from users where id = ${me.uid}`;
    if (!(await bcrypt.compare(String(f.get("current") ?? ""), u.password_hash))) return { error: "Your current password is wrong." };
  }
  await sql`update users set password_hash = ${await bcrypt.hash(password, 10)} where id = ${target}`;
  return { ok: "Password changed." };
}

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function uploadLogo(_: SettingsState, f: FormData): Promise<SettingsState> {
  await requireUser("owner");
  const file = f.get("logo");
  if (!(file instanceof File) || !file.size) return { error: "Choose an image file." };
  if (!LOGO_TYPES.includes(file.type)) return { error: "Use a PNG, JPG or WebP image." };
  if (file.size > 1024 * 1024) return { error: "The logo must be under 1 MB. A 400 × 400 px image is plenty." };
  const bytes = Buffer.from(await file.arrayBuffer());
  await sql`update settings set logo = ${bytes}, logo_type = ${file.type}, logo_version = logo_version + 1 where id = 1`;
  revalidatePath("/", "layout");
  return { ok: "Logo updated." };
}

export async function removeLogo(): Promise<SettingsState> {
  await requireUser("owner");
  await sql`update settings set logo = null, logo_type = null, logo_version = logo_version + 1 where id = 1`;
  revalidatePath("/", "layout");
  return { ok: "Logo removed." };
}

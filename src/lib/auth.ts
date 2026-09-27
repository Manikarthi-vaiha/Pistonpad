import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";
import { SESSION_COOKIE, readSession, type SessionUser } from "./session";

/** Current signed-in user, re-checked against the database once per request. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const s = await readSession(jar.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const [u] = await sql<{ id: number; name: string; role: "owner" | "staff" }[]>`
    select id, name, role from users where id = ${s.uid} and active`;
  return u ? { uid: u.id, name: u.name, role: u.role } : null;
});

/** For pages and actions: redirects to login when signed out, and blocks staff from owner-only areas. */
export async function requireUser(role?: "owner") {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (role === "owner" && u.role !== "owner") redirect("/?denied=1");
  return u;
}

export class ActionError extends Error {}

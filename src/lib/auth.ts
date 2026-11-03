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
  const [u] = await sql<{ id: number; name: string; role: "owner" | "staff" | "super_admin" }[]>`
    select id, name, role from users where id = ${s.uid} and active`;
  if (!u) return null;
  // Owners use whatever branchId is in the session (null = all branches view).
  // Staff: ignore cookie value and always derive from user_branches.
  let branchId: number | null = s.branchId;
  if (u.role === "staff") {
    const [ub] = await sql<{ branch_id: number }[]>`
      select branch_id from user_branches where user_id = ${u.id} limit 1`;
    branchId = ub?.branch_id ?? null;
  }
  return { uid: u.id, name: u.name, role: u.role, branchId };
});

/** For pages and actions: redirects to login when signed out, and blocks staff from owner-only areas. */
export async function requireUser(role?: "owner" | "super_admin") {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (role === "super_admin" && u.role !== "super_admin") redirect("/?denied=1");
  if (role === "owner" && u.role !== "owner" && u.role !== "super_admin") redirect("/?denied=1");
  return u;
}

export class ActionError extends Error {}

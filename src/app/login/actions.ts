"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { SESSION_COOKIE, SESSION_HOURS, signSession } from "@/lib/session";

export type LoginState = { error?: string };

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");
  if (!username || !password) return { error: "Enter your username and password." };

  const [u] = await sql<{ id: number; name: string; role: "owner" | "staff"; password_hash: string; active: boolean }[]>`
    select id, name, role, password_hash, active from users where username = ${username}`;
  const ok = u && u.active && (await bcrypt.compare(password, u.password_hash));
  if (!ok) return { error: "That username and password don't match. Check them and try again." };

  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession({ uid: u.id, name: u.name, role: u.role }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

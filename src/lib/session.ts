// Session token helpers. Edge-safe (used by proxy.ts), no database access here.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "sp_session";
export const SESSION_HOURS = 12;

export type SessionUser = { uid: number; name: string; role: "owner" | "staff" };

function key() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set to a long random string");
  return new TextEncoder().encode(s);
}

export async function signSession(u: SessionUser) {
  return new SignJWT({ ...u })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key());
}

export async function readSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return { uid: Number(payload.uid), name: String(payload.name), role: payload.role === "owner" ? "owner" : "staff" };
  } catch {
    return null;
  }
}

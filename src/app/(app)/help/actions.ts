"use server";

import { cookies } from "next/headers";
import { HELP_LANG_COOKIE, isHelpLang } from "@/lib/help";

/** Remembers the help language for next time. */
export async function saveHelpLang(lang: string) {
  if (!isHelpLang(lang)) return;
  (await cookies()).set(HELP_LANG_COOKIE, lang, { path: "/", maxAge: 365 * 24 * 3600, sameSite: "lax" });
}

import { en } from "./en";
import { ta } from "./ta";
import type { Block, HelpLang } from "./types";

export const HELP_LANGS = { en, ta } as const;
export type HelpLangId = keyof typeof HELP_LANGS;
export const HELP_LANG_COOKIE = "help_lang";

export const isHelpLang = (v: unknown): v is HelpLangId => v === "en" || v === "ta";

/** Plain text of a block, for search. */
function blockText(b: Block): string {
  switch (b.type) {
    case "p": case "h": case "tip": case "warn": return b.text;
    case "steps": case "list": return b.items.join(" ");
    case "example": return [b.title, b.note ?? "", ...b.lines.map((l) => `${l.label} ${l.value} ${l.note ?? ""}`)].join(" ");
    case "table": return [...b.head, ...b.rows.flat()].join(" ");
  }
}

/** Lowercased searchable text per topic (title, summary and every block), markdown stripped. */
export function searchIndex(lang: HelpLang) {
  return Object.fromEntries(lang.topics.map((t) => [
    t.id,
    [t.title, t.summary, ...t.blocks.map(blockText)].join(" ").replace(/\*\*/g, "").toLowerCase(),
  ]));
}

// Both languages must describe the same topics in the same order, so switching language keeps your place.
if (process.env.NODE_ENV !== "production") {
  const a = en.topics.map((t) => t.id).join(), b = ta.topics.map((t) => t.id).join();
  if (a !== b) console.warn(`[help] English and Tamil topics differ:\n en: ${a}\n ta: ${b}`);
}

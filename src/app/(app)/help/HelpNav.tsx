"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cx, Input } from "@/components/ui";
import { saveHelpLang } from "./actions";

type Item = { id: string; title: string; summary: string; ownerOnly?: boolean };
type Group = { id: string; label: string; items: Item[] };

/** English / தமிழ் switch. The choice is remembered in a cookie for next time. */
export function LangSwitch({ lang, topic }: { lang: "en" | "ta"; topic: string }) {
  const router = useRouter();
  const pick = async (l: "en" | "ta") => {
    await saveHelpLang(l);
    router.push(`/help?lang=${l}&topic=${topic}`);
  };
  return (
    <div role="radiogroup" aria-label="Language / மொழி" className="flex rounded-xl border border-line-2 bg-surface p-1">
      {([["en", "English"], ["ta", "தமிழ்"]] as const).map(([l, label]) => (
        <button key={l} type="button" role="radio" aria-checked={lang === l} onClick={() => pick(l)} lang={l}
          className={cx("rounded-lg px-4 py-2 text-sm font-semibold transition-colors", lang === l ? "bg-primary text-primary-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Topic list with search. Search looks through every word of every topic, not just titles. */
export function TopicList({ groups, index, active, lang, placeholder, empty, ownerLabel }: {
  groups: Group[]; index: Record<string, string>; active: string; lang: string; placeholder: string; empty: string; ownerLabel: string;
}) {
  const [q, setQ] = useState("");
  const searching = q.trim() !== "";
  const shown = useMemo(() => {
    const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return groups.map((g) => ({ ...g, items: g.items.filter((t) => words.every((w) => index[t.id]?.includes(w))) })).filter((g) => g.items.length);
  }, [groups, index, q]);
  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="pl-9" aria-label={placeholder} />
      </div>
      {shown.length ? shown.map((g) => (
        <div key={g.id}>
          <p className="px-2 pb-1.5 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">{g.label}</p>
          <ul className="flex flex-col gap-0.5">
            {g.items.map((t) => (
              <li key={t.id}>
                <Link href={`/help?lang=${lang}&topic=${t.id}`} aria-current={active === t.id ? "page" : undefined}
                  className={cx("block rounded-lg px-2.5 py-2 text-[14px] leading-snug", active === t.id ? "bg-primary-soft font-semibold text-primary" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}>
                  {t.title}
                  {t.ownerOnly ? <span className="ml-1.5 align-middle text-[10.5px] font-semibold text-ink-3">· {ownerLabel}</span> : null}
                  {searching ? <span className="mt-0.5 block text-xs font-normal text-ink-3">{t.summary}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )) : <p className="px-2 text-sm text-ink-3">{empty}</p>}
    </div>
  );
}

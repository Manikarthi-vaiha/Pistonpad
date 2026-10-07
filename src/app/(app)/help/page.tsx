import "@fontsource-variable/noto-sans-tamil";
import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { AlertTriangle, ArrowLeft, ArrowRight, ChevronDown, Lightbulb, Lock } from "lucide-react";
import { Card, cx } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { HELP_LANG_COOKIE, HELP_LANGS, isHelpLang, searchIndex } from "@/lib/help";
import type { Block, GroupId } from "@/lib/help/types";
import { LangSwitch, TopicList } from "./HelpNav";

export const metadata: Metadata = { title: "Help" };

const GROUP_ORDER: GroupId[] = ["start", "parts", "bikes", "money", "reports", "admin"];

export default async function HelpPage({ searchParams }: PageProps<"/help">) {
  await requireUser();
  const sp = await searchParams;
  const saved = (await cookies()).get(HELP_LANG_COOKIE)?.value;
  const lang = isHelpLang(sp.lang) ? sp.lang : isHelpLang(saved) ? saved : "en";
  const { ui, topics } = HELP_LANGS[lang];
  const i = Math.max(0, topics.findIndex((t) => t.id === sp.topic));
  const topic = topics[i];
  const prev = topics[i - 1], next = topics[i + 1];

  const groups = GROUP_ORDER.map((g) => ({
    id: g, label: ui.groups[g],
    items: topics.filter((t) => t.group === g).map(({ id, title, summary, ownerOnly }) => ({ id, title, summary, ownerOnly })),
  }));
  const list = (
    <TopicList groups={groups} index={searchIndex(HELP_LANGS[lang])} active={topic.id} lang={lang}
      placeholder={ui.search} empty={ui.noResults} ownerLabel={ui.ownerOnly} />
  );

  return (
    // Tamil reads better with a Tamil font and a little more line height.
    <div lang={lang} className={cx(lang === "ta" && "help-ta")}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{ui.title}</h1>
          <p className="mt-1 text-sm text-ink-2">{ui.sub}</p>
        </div>
        <LangSwitch lang={lang} topic={topic.id} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Topics: a sidebar on large screens, a collapsible menu on phones */}
        <aside className="hidden lg:sticky lg:top-6 lg:block lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">{list}</aside>
        <details className="group rounded-xl border border-line bg-surface lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
            {ui.topics}: <span className="ml-1 flex-1 truncate font-normal text-ink-2">{topic.title}</span>
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-line p-4">{list}</div>
        </details>

        <article className="min-w-0">
          <Card className="p-5 sm:p-8">
            <p className="text-[12px] font-semibold tracking-wider text-primary uppercase">{ui.groups[topic.group]}</p>
            <h2 className="mt-1 text-[26px] leading-tight font-bold tracking-tight text-ink">{topic.title}</h2>
            <p className="mt-2 text-[15px] text-ink-2">{topic.summary}</p>
            {topic.ownerOnly ? (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-ink-2">
                <Lock className="h-3.5 w-3.5" /> {ui.ownerOnly}
              </p>
            ) : null}
            <div className="help-body mt-6 flex flex-col gap-5 text-[15px] text-ink">
              {topic.blocks.map((b, k) => <BlockView key={k} block={b} ui={ui} />)}
            </div>
          </Card>

          <nav className="mt-4 grid grid-cols-2 gap-3" aria-label={ui.topics}>
            {prev ? (
              <Link href={`/help?lang=${lang}&topic=${prev.id}`} className="rounded-xl border border-line bg-surface p-4 hover:border-primary/60">
                <span className="flex items-center gap-1 text-xs font-semibold text-ink-3"><ArrowLeft className="h-3.5 w-3.5" /> {ui.previous}</span>
                <span className="mt-1 block text-sm font-semibold text-ink">{prev.title}</span>
              </Link>
            ) : <span />}
            {next ? (
              <Link href={`/help?lang=${lang}&topic=${next.id}`} className="rounded-xl border border-line bg-surface p-4 text-right hover:border-primary/60">
                <span className="flex items-center justify-end gap-1 text-xs font-semibold text-ink-3">{ui.next} <ArrowRight className="h-3.5 w-3.5" /></span>
                <span className="mt-1 block text-sm font-semibold text-ink">{next.title}</span>
              </Link>
            ) : null}
          </nav>
        </article>
      </div>
    </div>
  );
}

/** Renders **bold** inside help text. */
function rich(text: string): ReactNode {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i} className="font-semibold text-ink">{part}</strong> : <Fragment key={i}>{part}</Fragment>));
}

function BlockView({ block: b, ui }: { block: Block; ui: (typeof HELP_LANGS)["en"]["ui"] }) {
  switch (b.type) {
    case "p":
      return <p className="leading-relaxed text-ink-2">{rich(b.text)}</p>;
    case "h":
      return <h3 className="mt-2 text-lg font-bold text-ink">{rich(b.text)}</h3>;
    case "steps":
      return (
        <ol className="flex flex-col gap-3" aria-label={ui.steps}>
          {b.items.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-[13px] font-bold text-primary-ink">{i + 1}</span>
              <span className="pt-0.5 leading-relaxed text-ink-2">{rich(s)}</span>
            </li>
          ))}
        </ol>
      );
    case "list":
      return (
        <ul className="flex flex-col gap-2.5">
          {b.items.map((s, i) => (
            <li key={i} className="flex gap-3 leading-relaxed text-ink-2">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              <span>{rich(s)}</span>
            </li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="num w-full min-w-[480px] text-left text-sm">
            <thead><tr className="bg-surface-2">{b.head.map((h, i) => <th key={i} className="border-b border-line px-4 py-2.5 text-[12px] font-semibold text-ink-2">{h}</th>)}</tr></thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  {r.map((c, j) => <td key={j} className={cx("px-4 py-2.5 align-top leading-relaxed", j === 0 ? "font-medium text-ink" : "text-ink-2")}>{rich(c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "example":
      return (
        <figure className="overflow-hidden rounded-xl border border-primary/30 bg-primary-soft/40">
          <figcaption className="border-b border-primary/20 px-4 py-2.5 text-sm font-semibold text-primary">{ui.example}: <span className="text-ink">{b.title}</span></figcaption>
          <dl className="num grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 px-4 py-3 text-sm">
            {b.lines.map((l, i) => (
              <Fragment key={i}>
                <dt className={cx("py-1.5 leading-snug", l.kind === "total" ? "border-t border-ink/20 font-bold text-ink" : l.kind === "muted" ? "text-ink-3" : "text-ink-2")}>
                  {l.kind === "minus" ? "− " : l.kind === "plus" ? "+ " : ""}{rich(l.label)}
                </dt>
                <dd className={cx("py-1.5 text-right whitespace-nowrap", l.kind === "total" ? "border-t border-ink/20 font-bold text-primary" : l.kind === "muted" ? "text-ink-3" : "font-medium text-ink")}>{l.value}</dd>
              </Fragment>
            ))}
          </dl>
          {b.note ? <p className="border-t border-primary/20 px-4 py-3 text-[13.5px] leading-relaxed text-ink-2">{rich(b.note)}</p> : null}
        </figure>
      );
    case "tip":
      return (
        <p className="flex gap-3 rounded-xl bg-info-soft px-4 py-3 text-[14px] leading-relaxed text-ink-2">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden /><span><b className="font-semibold text-info">{ui.tip}: </b>{rich(b.text)}</span>
        </p>
      );
    case "warn":
      return (
        <p className="flex gap-3 rounded-xl bg-warn-soft px-4 py-3 text-[14px] leading-relaxed text-ink-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden /><span><b className="font-semibold text-warn">{ui.warn}: </b>{rich(b.text)}</span>
        </p>
      );
  }
}

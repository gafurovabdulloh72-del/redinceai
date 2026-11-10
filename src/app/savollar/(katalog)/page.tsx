import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Eye, MessageCircle, MessagesSquare, Plus } from "lucide-react";
import { Avatar, ButtonLink, EmptyState } from "@/components/ui";
import { CATEGORY_GROUPS } from "@/lib/categories";
import { listQuestions, type QuestionCard } from "@/lib/qa/service";
import { timeAgo } from "@/lib/utils";
import { getLocale } from "@/lib/i18n/server";
import { tr, type Locale } from "@/lib/i18n";
import { SAVOL } from "@/lib/i18n/dict/community";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Maslahat — savol-javob",
  description: "Kasb Egalari hamjamiyati savol-javob maydoni: ish, narx, texnika, mijoz bilan muloqot — tajribali ijodkorlardan maslahat oling.",
  alternates: { canonical: "/savollar" },
  other: { "m-title": "Maslahat" },
};

function Row({ q, til }: { q: QuestionCard; til: Locale }) {
  return (
    <li className="m-plain card p-0 transition hover:border-fg/25">
      <Link href={`/savollar/${q.id}`} className="flex items-start gap-3.5 p-4">
        <Avatar name={q.author.name} src={q.author.avatarUrl} size={40} decorative />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[14.5px] font-bold leading-snug text-fg">{q.title}</span>
            {q.answered && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10.5px] font-bold text-success-text">
                <CheckCircle2 size={11} /> {tr(til, SAVOL.answeredBadge)}
              </span>
            )}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-fg-3">
            <span className="font-semibold text-fg-2">{q.author.name}</span>
            {q.author.title && <span>{q.author.title}</span>}
            {q.categoryName && <span className="rounded-full border border-line px-2 py-px text-[11px]">{q.categoryName}</span>}
            <span>{timeAgo(q.createdAt)}</span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 text-[12px] text-fg-3">
          <span className={`inline-flex items-center gap-1 ${q.answersCount > 0 ? "font-bold text-fg" : ""}`}>
            <MessageCircle size={13} /> {q.answersCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye size={13} /> {q.viewsCount}
          </span>
        </span>
      </Link>
    </li>
  );
}

type Search = Promise<{ tab?: string; cat?: string }>;

export default async function QuestionsPage({ searchParams }: { searchParams: Search }) {
  const [til, sp] = await Promise.all([getLocale(), searchParams]);
  const tab = sp.tab === "open" || sp.tab === "answered" ? sp.tab : "all";
  const cat = CATEGORY_GROUPS.some((g) => g.slug === sp.cat) ? sp.cat : undefined;
  const { items } = await listQuestions({ tab, category: cat });
  const tabHref = (t: string) => `/savollar${t === "all" ? "" : `?tab=${t}`}${cat ? `${t === "all" ? "?" : "&"}cat=${cat}` : ""}`;
  const catHref = (c?: string) => `/savollar${tab === "all" ? "" : `?tab=${tab}`}${c ? `${tab === "all" ? "?" : "&"}cat=${c}` : ""}`;
  return (
    <div className="container-x animate-fade-up py-6">
      <header className="mb-4 flex items-start justify-between gap-3 max-sm:mb-3">
        <div className="max-sm:hidden">
          <h1 className="display-xl text-fg">{tr(til, SAVOL.title)}</h1>
          <p className="mt-1.5 max-w-xl text-[14px] text-fg-2">{tr(til, SAVOL.subtitle)}</p>
        </div>
        <ButtonLink href="/savollar/yangi" className="shrink-0 max-sm:w-full">
          <Plus size={16} /> {tr(til, SAVOL.ask)}
        </ButtonLink>
      </header>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {([
          ["all", tr(til, SAVOL.tabAll)],
          ["open", tr(til, SAVOL.tabOpen)],
          ["answered", tr(til, SAVOL.tabAnswered)],
        ] as const).map(([t, label]) => (
          <Link key={t} href={tabHref(t)} className="chip text-[12.5px]" data-active={tab === t}>
            {label}
          </Link>
        ))}
        <span className="mx-1 h-4 w-px bg-line max-sm:hidden" aria-hidden />
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_GROUPS.slice(0, 6).map((g) => (
            <Link key={g.slug} href={catHref(cat === g.slug ? undefined : g.slug)} className="chip text-[12.5px]" data-active={cat === g.slug}>
              {g.name}
            </Link>
          ))}
        </div>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={MessagesSquare} title={tr(til, SAVOL.emptyTitle)} description={tr(til, SAVOL.emptyDesc)} />
      ) : (
        <ul className="grid gap-3 max-sm:gap-0 max-sm:divide-y max-sm:divide-line max-sm:border-y max-sm:border-line">
          {items.map((q) => (
            <Row key={q.id} q={q} til={til} />
          ))}
        </ul>
      )}
    </div>
  );
}

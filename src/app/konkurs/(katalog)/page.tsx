import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Crown, Trophy, Users } from "lucide-react";
import { Avatar } from "@/components/ui";
import { listChallenges, type ChallengeCard } from "@/lib/challenges/service";
import { formatDate } from "@/lib/utils";
import { getLocale } from "@/lib/i18n/server";
import { tr, type Locale } from "@/lib/i18n";
import { KONKURS } from "@/lib/i18n/dict/community";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ijod konkurslari",
  description: "Kasb Egalari haftalik ijod konkurslari — eng yaxshi ishingizni qo'shing, ovoz to'plang va g'olib bo'ling.",
  alternates: { canonical: "/konkurs" },
  other: { "m-title": "Konkurs" },
};

/** Tugashigacha qolgan vaqt — qisqa yorliq («3 kun qoldi» / «Bugun tugaydi») */
function leftLabel(endsAt: number, til: Locale): string {
  const ms = endsAt - Date.now();
  if (ms <= 0) return tr(til, KONKURS.finished);
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return KONKURS.daysLeft[til](days);
  const hours = Math.max(1, Math.floor(ms / 3_600_000));
  return hours >= 24 ? KONKURS.daysLeft[til](1) : KONKURS.hoursLeft[til](hours);
}

function Card({ c, til }: { c: ChallengeCard; til: Locale }) {
  return (
    <li className="m-plain card overflow-hidden p-0 transition hover:border-fg/25">
      <Link href={`/konkurs/${c.id}`} className="flex gap-4 p-4">
        <span className="relative block h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-surface-2 max-sm:h-16 max-sm:w-20">
          {c.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-fg-3">
              <Trophy size={26} strokeWidth={1.6} />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[15px] font-bold text-fg">{c.title}</span>
            {c.state === "open" && <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-success-text">{tr(til, KONKURS.open)}</span>}
            {c.state === "soon" && <span className="rounded-full bg-fg/6 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-fg-3">{tr(til, KONKURS.soon)}</span>}
          </span>
          {c.description && <span className="mt-1 line-clamp-2 block text-[13px] leading-snug text-fg-2">{c.description}</span>}
          <span className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px] text-fg-3">
            <span className="inline-flex items-center gap-1">
              <Users size={13} /> {KONKURS.entries[til](c.entriesCount)}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock size={13} /> {c.state === "done" ? formatDate(new Date(c.endsAt), til) : leftLabel(c.endsAt, til)}
            </span>
            {c.winner && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-fg">
                <Crown size={13} className="text-accent" />
                <Avatar name={c.winner.name} src={c.winner.avatarUrl} size={18} decorative />
                {c.winner.name}
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}

export default async function ChallengesPage() {
  const [til, all] = await Promise.all([getLocale(), listChallenges()]);
  const live = all.filter((c) => c.state !== "done");
  const past = all.filter((c) => c.state === "done");
  return (
    <div className="container-x animate-fade-up py-6">
      <header className="mb-5 max-sm:hidden">
        <h1 className="display-xl text-fg">{tr(til, KONKURS.title)}</h1>
        <p className="mt-1.5 max-w-xl text-[14px] text-fg-2">{tr(til, KONKURS.subtitle)}</p>
      </header>
      {all.length === 0 ? (
        <div className="card p-10 text-center text-[14px] text-fg-3 max-sm:!border-0 max-sm:!bg-transparent max-sm:!shadow-none">
          <Trophy size={34} strokeWidth={1.5} className="mx-auto mb-3 text-fg-3" />
          {tr(til, KONKURS.empty)}
        </div>
      ) : (
        <>
          {live.length > 0 && (
            <ul className="grid gap-3 max-sm:gap-0 max-sm:divide-y max-sm:divide-line max-sm:border-y max-sm:border-line">
              {live.map((c) => (
                <Card key={c.id} c={c} til={til} />
              ))}
            </ul>
          )}
          {past.length > 0 && (
            <section className="mt-8">
              <h2 className="m-label mb-2.5 text-[13px] font-bold text-fg-3">{tr(til, KONKURS.past)}</h2>
              <ul className="grid gap-3 max-sm:gap-0 max-sm:divide-y max-sm:divide-line max-sm:border-y max-sm:border-line">
                {past.map((c) => (
                  <Card key={c.id} c={c} til={til} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

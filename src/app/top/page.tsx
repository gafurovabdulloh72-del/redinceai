import type { Metadata } from "next";
import { SHELL } from "@/lib/i18n/dict/shell";
import Link from "next/link";
import { CalendarClock, Crown, Eye, Heart, MessageCircle, Play, Sparkles, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui";
import { ShareButton } from "@/components/specialists/ShareButton";
import { CATEGORY_BY_SLUG } from "@/lib/constants";
import { monthKeyOf, monthLabel, monthRange, publishAtOf, publishedMonths, TOP_AWARD_COUNT, type AwardView } from "@/lib/top";
import { cn, compactCount, formatDate } from "@/lib/utils";
import { tr, type Locale } from "@/lib/i18n";
import { TOP } from "@/lib/i18n/dict/social";
import { getLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return {
    title: "Oyning TOP ijodkorlari",
    description: "Kasb Egalari: har oyning oxirgi kunida e'lon qilinadigan eng yaxshi ijodkorlar reytingi. G'oliblarga premium imtiyoz beriladi.",
    alternates: { canonical: "/top" },
    other: { "m-title": tr(til, SHELL.nav.top) },
  };
}

const MEDAL = [
  { ring: "linear-gradient(135deg,#ffe08a,#f2a31b)", chip: "linear-gradient(135deg,#ffe08a,#f2a31b)", label: "1" },
  { ring: "linear-gradient(135deg,#eef2f6,#a3afbb)", chip: "linear-gradient(135deg,#eef2f6,#a3afbb)", label: "2" },
  { ring: "linear-gradient(135deg,#f6bf93,#bf6a36)", chip: "linear-gradient(135deg,#f6bf93,#bf6a36)", label: "3" },
];

function nextPublish(now: number): number {
  const key = monthKeyOf(now);
  const at = publishAtOf(key);
  return at > now ? at : publishAtOf(monthKeyOf(monthRange(key).to.getTime()));
}

function Winner({ w, big, til }: { w: AwardView; big?: boolean; til: Locale }) {
  const medal = MEDAL[w.rank - 1];
  const size = big ? 104 : 84;
  return (
    <li className={cn("flex flex-col items-center text-center", big ? "order-2" : w.rank === 2 ? "order-1 pt-8" : "order-3 pt-12")}>
      <div className="relative">
        {big && <Crown size={26} className="absolute -top-7 left-1/2 -translate-x-1/2 text-[#f2a31b]" aria-hidden />}
        <span className="block rounded-full p-[3px]" style={{ background: medal.ring }}>
          <span className="block rounded-full bg-surface p-[3px]">
            <Avatar name={w.author.name} src={w.author.avatarUrl} size={size} decorative className="!ring-0 !shadow-none" />
          </span>
        </span>
        <span className="absolute -bottom-2.5 left-1/2 grid h-7 w-7 -translate-x-1/2 place-items-center rounded-full text-[13px] font-extrabold text-black ring-[3px] ring-surface" style={{ background: medal.chip }}>
          {medal.label}
        </span>
      </div>
      <Link href={w.author.slug ? `/mutaxassislar/${w.author.slug}` : "#"} className="mt-5 line-clamp-2 max-w-[150px] text-[14.5px] font-bold leading-tight text-fg hover:underline sm:text-[16px]">
        {w.author.name}
      </Link>
      <span className="mt-0.5 line-clamp-1 text-[12px] text-fg-3">{w.category ? CATEGORY_BY_SLUG[w.category]?.name : ""}</span>
      <span className="mt-2 font-display text-[20px] font-extrabold tabular-nums text-fg">{compactCount(w.score)}</span>
      <span className="text-[11px] uppercase tracking-wider text-fg-4">{tr(til, TOP.points)}</span>
    </li>
  );
}

/** Oylik reyting: faqat e'lon qilingan oy g'oliblari ko'rinadi (e'lon — har oyning oxirgi kuni). Jonli reyting faqat adminda */
export default async function TopPage() {
  const til = await getLocale();
  const now = Date.now();
  const [latest, ...older] = await publishedMonths(6);
  const next = nextPublish(now);
  const days = Math.max(0, Math.ceil((next - now) / 86_400_000));

  return (
    <div className="container-x">
      <div className="mx-auto max-w-[680px] py-2">
        <header className="mb-5 text-center">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[11.5px] font-bold uppercase tracking-[0.14em] text-accent-text">
            <Crown size={13} /> {tr(til, TOP.badge)}
          </p>
          <div className="mt-3 flex items-start justify-center gap-3">
            <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-tight text-fg sm:text-[34px]">{tr(til, TOP.title)}</h1>
            {/* Oylik g'oliblar ro'yxatini ulashish — ijodkorlar o'z o'rnini e'lon qiladi */}
            <ShareButton title={tr(til, TOP.title)} size="md" variant="outline" iconOnly className="mt-1 shrink-0" />
          </div>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-fg-3">{tr(til, TOP.lead)}</p>
        </header>

        {latest ? (
          <section className="card m-flat overflow-hidden">
            <div className="border-b border-line px-5 py-3.5 text-center">
              <p className="font-display text-[15px] font-bold text-fg">{latest.label}</p>
              <p className="text-[12px] text-fg-3">{tr(til, TOP.published)}: {formatDate(new Date(latest.publishedAt), til)}</p>
            </div>
            <ol className="grid grid-cols-3 items-start gap-2 px-3 pb-8 pt-12 sm:gap-6 sm:px-6">
              {[latest.winners.find((w) => w.rank === 2), latest.winners.find((w) => w.rank === 1), latest.winners.find((w) => w.rank === 3)].map((w, i) => (w ? <Winner key={w.author.id} w={w} big={w.rank === 1} til={til} /> : <li key={i} className={i === 1 ? "order-2" : i === 0 ? "order-1" : "order-3"} />))}
            </ol>
            <ul className="divide-y divide-line border-t border-line">
              {latest.winners.map((w) => (
                <li key={w.author.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-[12.5px] text-fg-3">
                  <span className="min-w-0 flex-1 truncate font-semibold text-fg-2">
                    {w.rank}. {w.author.name}
                  </span>
                  <span className="inline-flex items-center gap-1"><Heart size={12} /> {compactCount(w.likes)}</span>
                  <span className="inline-flex items-center gap-1"><MessageCircle size={12} /> {compactCount(w.comments)}</span>
                  <span className="inline-flex items-center gap-1"><Eye size={12} /> {compactCount(w.views)}</span>
                  <span className="inline-flex items-center gap-1"><UserPlus size={12} /> {compactCount(w.followers)}</span>
                </li>
              ))}
            </ul>
            <p className="flex items-center justify-center gap-1.5 border-t border-line bg-accent-soft/50 px-4 py-3 text-center text-[12.5px] font-semibold text-accent-text">
              <Sparkles size={14} /> {tr(til, TOP.premiumGiven)}{latest.premiumUntil ? ` — ${formatDate(new Date(latest.premiumUntil - 1), til)} ${tr(til, TOP.until)}` : ""}
            </p>
          </section>
        ) : (
          <section className="card m-flat px-6 py-12 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent-text">
              <Crown size={26} />
            </span>
            <p className="mt-4 font-display text-[19px] font-bold text-fg">{tr(til, TOP.soonTitle)}</p>
            <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-relaxed text-fg-3">{tr(til, TOP.soonText)}</p>
          </section>
        )}

        <div className="mt-4 flex items-center justify-center gap-2 rounded-card border border-line px-4 py-3 text-[13px] text-fg-2">
          <CalendarClock size={16} className="text-fg-3" />
          {tr(til, TOP.nextLabel)}: <b className="text-fg">{formatDate(new Date(next), til)}</b>
          <span className="text-fg-4">· {days === 0 ? tr(til, TOP.today) : TOP.daysLeft[til](days)} ({monthLabel(monthKeyOf(next), til)})</span>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="card p-4">
            <p className="font-display text-[14px] font-bold text-fg">{tr(til, TOP.howTitle)}</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-3">{tr(til, TOP.howText)}</p>
          </div>
          <Link href="/lenta?tab=top" className="card card-hover flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-white">
              <Play size={16} />
            </span>
            <span>
              <span className="block font-display text-[14px] font-bold text-fg">{tr(til, TOP.topPostsTitle)}</span>
              <span className="block text-[12.5px] text-fg-3">{tr(til, TOP.topPostsText)}</span>
            </span>
          </Link>
        </section>

        {older.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 font-display text-[14px] font-bold text-fg">{tr(til, TOP.older)}</h2>
            <ul className="card m-flat divide-y divide-line">
              {older.map((m) => (
                <li key={m.month} className="px-4 py-3">
                  <p className="text-[13px] font-semibold text-fg">{m.label}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-4 text-[12.5px] text-fg-3">
                    {m.winners.map((w) => (
                      <span key={w.author.id}>
                        {w.rank}. {w.author.name}
                      </span>
                    ))}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

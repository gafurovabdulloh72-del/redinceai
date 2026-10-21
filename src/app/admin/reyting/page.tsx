import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Crown, Eye, Heart, MessageCircle, UserPlus } from "lucide-react";
import { PublishTopButton } from "@/components/admin/PublishTopButton";
import { AdminMusicPanel } from "@/components/admin/AdminMusicPanel";
import { Avatar, Badge } from "@/components/ui";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { CATEGORY_BY_SLUG } from "@/lib/constants";
import type { TopCreator } from "@/lib/reels";
import { allTimeTop, currentMonthTop, monthKeyOf, monthLabel, publishAtOf, publishedMonths, TOP_AWARD_COUNT } from "@/lib/top";
import { compactCount, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reyting (admin)", robots: { index: false, follow: false } };

function Board({ title, hint, rows }: { title: string; hint: string; rows: TopCreator[] }) {
  return (
    <section className="card overflow-hidden">
      <header className="border-b border-line px-4 py-3">
        <h2 className="font-display text-[16px] font-semibold text-fg">{title}</h2>
        <p className="mt-0.5 text-[12.5px] text-fg-3">{hint}</p>
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13.5px] text-fg-3">Hozircha ma&apos;lumot yo&apos;q</p>
      ) : (
        <ol className="divide-y divide-line">
          {rows.map((t) => (
            <li key={t.author.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-6 shrink-0 text-center font-display text-[14px] font-bold tabular-nums text-fg-3">{t.rank}</span>
              <Avatar name={t.author.name} src={t.author.avatarUrl} size={36} decorative />
              <div className="min-w-0 flex-1">
                <Link href={t.author.slug ? `/mutaxassislar/${t.author.slug}` : "#"} className="block truncate text-[14px] font-semibold text-fg hover:underline">
                  {t.author.name}
                </Link>
                <p className="flex flex-wrap gap-x-3 text-[11.5px] text-fg-3">
                  <span>{t.author.category ? CATEGORY_BY_SLUG[t.author.category]?.name : "—"}</span>
                  <span className="inline-flex items-center gap-1"><Heart size={11} />{compactCount(t.likes)}</span>
                  <span className="inline-flex items-center gap-1"><MessageCircle size={11} />{compactCount(t.comments)}</span>
                  <span className="inline-flex items-center gap-1"><Eye size={11} />{compactCount(t.views)}</span>
                  <span className="inline-flex items-center gap-1"><UserPlus size={11} />{compactCount(t.followers)}</span>
                </p>
              </div>
              <span className="shrink-0 font-display text-[15px] font-bold tabular-nums text-fg">{compactCount(t.score)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default async function AdminRatingPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/admin/reyting"));
  if (user.role !== "admin") redirect("/kabinet");
  const now = Date.now();
  const month = monthKeyOf(now);
  const [monthTop, allTop, history] = await Promise.all([currentMonthTop(30, now), allTimeTop(30, now), publishedMonths(12)]);
  const publishedThis = history.some((h) => h.month === month);

  return (
    <div className="container-x">
      <div className="mx-auto max-w-[1040px] py-2">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-3 hover:text-fg">
          <ArrowLeft size={14} /> Boshqaruv markazi
        </Link>
        <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-display text-[26px] font-semibold tracking-tight text-fg">
              <Crown size={22} className="text-accent" /> TOP reyting
            </h1>
            <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-fg-3">
              Ommaga reyting faqat har oyning oxirgi kuni (Toshkent 08:00) e&apos;lon qilinadi: TOP-{TOP_AWARD_COUNT} ga keyingi oy oxirigacha premium beriladi. Bu yerda — jonli va doimiy reyting.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {publishedThis ? <Badge tone="success">{monthLabel(month)} e&apos;lon qilingan</Badge> : <PublishTopButton month={month} monthLabel={monthLabel(month)} />}
            {!publishedThis && <span className="text-[12px] text-fg-3">Avtomatik: {formatDateTime(new Date(publishAtOf(month)))}</span>}
          </div>
        </header>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <Board title={`${monthLabel(month)} — jonli reyting`} hint="Joriy oyning boshidan hozirgacha (ommaga ko'rinmaydi)" rows={monthTop} />
          <Board title="Doimiy reyting" hint="Butun vaqt davomidagi ball" rows={allTop} />
        </div>

        <section className="card mt-5 overflow-hidden">
          <header className="border-b border-line px-4 py-3">
            <h2 className="font-display text-[16px] font-semibold text-fg">E&apos;lon qilingan oylar</h2>
          </header>
          {history.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13.5px] text-fg-3">Hali reyting e&apos;lon qilinmagan</p>
          ) : (
            <ul className="divide-y divide-line">
              {history.map((h) => (
                <li key={h.month} className="px-4 py-3">
                  <p className="text-[13.5px] font-semibold text-fg">
                    {h.label} <span className="font-normal text-fg-3">· e&apos;lon: {formatDateTime(new Date(h.publishedAt))}</span>
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-fg-2">
                    {h.winners.map((w) => (
                      <span key={w.author.id}>
                        <b className="tabular-nums">{w.rank}.</b> {w.author.name} <span className="text-fg-4">({compactCount(w.score)})</span>
                      </span>
                    ))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <AdminMusicPanel />
      </div>
    </div>
  );
}

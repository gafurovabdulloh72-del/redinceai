import type { Metadata } from "next";
import Link from "next/link";
import { Crown, Eye, Heart, MessageCircle, Play, UserPlus } from "lucide-react";
import { Avatar, VerifiedBadge } from "@/components/ui";
import { CATEGORY_BY_SLUG } from "@/lib/constants";
import { weeklyTopCreators } from "@/lib/reels";
import { compactCount, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Haftaning TOP ijodkorlari",
  description: "Kasb Egalari: so'nggi 7 kunda eng ko'p reaksiya, izoh, ko'rish va obunachi yig'gan ijodkorlar reytingi.",
  alternates: { canonical: "/top" },
};

const MEDAL = ["linear-gradient(135deg,#ffd76a,#f39c2a)", "linear-gradient(135deg,#e8edf2,#a9b4bf)", "linear-gradient(135deg,#f3b58a,#c26b3a)"];

/** Haftalik reyting: TOP-3 shohsupada, qolganlari ro'yxatda. Ball: reaksiya×3 + izoh×4 + saqlash×5 + ko'rish×0.3 + yangi obunachi×6 */
export default async function TopPage() {
  const top = await weeklyTopCreators(30);
  const podium = top.slice(0, 3);
  const rest = top.slice(3);
  return (
    <div className="container-x">
      <div className="mx-auto max-w-[760px] py-2">
        <header className="mb-6">
          <p className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-accent-text">
            <Crown size={14} /> Reyting
          </p>
          <h1 className="mt-2 font-display text-[30px] font-extrabold leading-tight tracking-tight text-fg sm:text-[36px]">Haftaning TOP ijodkorlari</h1>
          <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-fg-3">So&apos;nggi 7 kunda postlariga eng ko&apos;p reaksiya, izoh, saqlash, ko&apos;rish va yangi obunachi yig&apos;ganlar. Reyting har kuni yangilanadi.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/lenta?tab=top" className="btn-accent inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-semibold">
              <Play size={15} /> Top postlarni ko&apos;rish
            </Link>
          </div>
        </header>

        {top.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="font-display text-[18px] font-bold text-fg">Bu hafta hali reyting shakllanmadi</p>
            <p className="mt-2 text-[14px] text-fg-3">Post joylang — birinchi bo&apos;lib TOPga chiqing!</p>
          </div>
        ) : (
          <>
            <ol className="grid grid-cols-3 items-end gap-2.5 sm:gap-4">
              {[podium[1], podium[0], podium[2]].map((t, i) =>
                t ? (
                  <li key={t.author.id} className={cn("card flex flex-col items-center p-3 text-center sm:p-5", i === 1 ? "pb-6 sm:pb-8" : "")}>
                    <span className="relative">
                      <Avatar name={t.author.name} src={t.author.avatarUrl} size={i === 1 ? 76 : 60} decorative />
                      <span className="absolute -bottom-2 left-1/2 grid h-7 w-7 -translate-x-1/2 place-items-center rounded-full text-[13px] font-extrabold text-black ring-2 ring-surface" style={{ background: MEDAL[t.rank - 1] }}>
                        {t.rank}
                      </span>
                    </span>
                    <Link href={t.author.slug ? `/mutaxassislar/${t.author.slug}` : "#"} className="mt-4 line-clamp-2 text-[13.5px] font-bold leading-tight text-fg hover:underline sm:text-[15px]">
                      {t.author.name}
                    </Link>
                    <span className="mt-0.5 line-clamp-1 text-[11.5px] text-fg-3">{t.author.category ? CATEGORY_BY_SLUG[t.author.category]?.name : ""}</span>
                    <span className="mt-2 font-display text-[18px] font-extrabold tabular-nums text-fg">{compactCount(t.score)}</span>
                    <span className="text-[11px] text-fg-4">ball</span>
                  </li>
                ) : (
                  <li key={i} />
                ),
              )}
            </ol>

            {rest.length > 0 && (
              <ol className="card mt-5 divide-y divide-line">
                {rest.map((t) => (
                  <li key={t.author.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-7 shrink-0 text-center font-display text-[15px] font-extrabold tabular-nums text-fg-3">{t.rank}</span>
                    <Avatar name={t.author.name} src={t.author.avatarUrl} size={42} decorative />
                    <div className="min-w-0 flex-1">
                      <Link href={t.author.slug ? `/mutaxassislar/${t.author.slug}` : "#"} className="flex items-center gap-1.5 text-[14.5px] font-semibold text-fg hover:underline">
                        <span className="truncate">{t.author.name}</span>
                        {t.author.isVerified && <VerifiedBadge size={14} />}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-fg-3">
                        <span className="inline-flex items-center gap-1"><Heart size={12} /> {compactCount(t.likes)}</span>
                        <span className="inline-flex items-center gap-1"><MessageCircle size={12} /> {compactCount(t.comments)}</span>
                        <span className="inline-flex items-center gap-1"><Eye size={12} /> {compactCount(t.views)}</span>
                        <span className="inline-flex items-center gap-1"><UserPlus size={12} /> {compactCount(t.followers)}</span>
                      </p>
                    </div>
                    <span className="shrink-0 text-right">
                      <span className="block font-display text-[16px] font-extrabold tabular-nums text-fg">{compactCount(t.score)}</span>
                      <span className="block text-[11px] text-fg-4">ball</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </div>
  );
}

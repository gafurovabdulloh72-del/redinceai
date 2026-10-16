import { BadgeCheck, CornerDownRight, MessageSquareText, Star, ThumbsUp } from "lucide-react";
import { Avatar, EmptyState, Stars } from "@/components/ui";
import { RATING_CRITERIA, type RatingCriterionKey } from "@/lib/constants";
import { tr } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { timeAgoLabel } from "@/lib/i18n/dict/catalog";
import { MEZON, PROFIL } from "@/lib/i18n/dict/profile";
import { cn, formatDateTime } from "@/lib/utils";
import { ReviewDeleteButton } from "./ReviewDeleteButton";
import { ReviewReplyForm } from "./ReviewReplyForm";
import { ReportButton } from "./ReportButton";

export interface ReviewListItem {
  id: string;
  rating: number;
  text: string;
  createdAt: Date | number | string;
  /** Muallif identifikatori — "Siz" belgisi ism emas, id bo'yicha aniqlanadi */
  authorId?: string;
  author: { name: string; avatarUrl: string | null };
  /** Muallifning shu mutaxassis bilan qabul qilingan/bajarilgan buyurtmasi bor (F4) */
  verified?: boolean;
  /** Mutaxassisning javobi (F43) */
  reply?: string | null;
  replyAt?: Date | number | string | null;
  /** Mezonlar bo'yicha baho 1–5 (F44) */
  quality?: number | null;
  timeliness?: number | null;
  communication?: number | null;
  /** Sharh rasmlari (F45) */
  media?: string[] | null;
  /** «Tavsiya qilaman» (F46) */
  recommend?: boolean | null;
}

/** Xulosa uchun kerakli maydonlar (reviews jadvali qatorlari ham to'g'ri keladi) */
export type ReviewCriteriaSource = Pick<ReviewListItem, "quality" | "timeliness" | "communication" | "recommend">;

/** Mezonlar o'rtachasi va tavsiya foizi; ma'lumot bo'lmasa — null */
export function reviewCriteriaSummary(items: ReviewCriteriaSource[]): { averages: Partial<Record<RatingCriterionKey, { avg: number; n: number }>>; recommendPct: number | null; recommendN: number } {
  const averages: Partial<Record<RatingCriterionKey, { avg: number; n: number }>> = {};
  for (const c of RATING_CRITERIA) {
    const vals = items.map((r) => r[c.key]).filter((v): v is number => typeof v === "number" && v >= 1 && v <= 5);
    if (vals.length) averages[c.key] = { avg: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length };
  }
  const answered = items.filter((r) => typeof r.recommend === "boolean");
  const yes = answered.filter((r) => r.recommend).length;
  return { averages, recommendPct: answered.length ? Math.round((yes / answered.length) * 100) : null, recommendN: answered.length };
}

/** Mezon chizig'i: yorliq + to'ldirilgan chiziq + qiymat */
function CriterionBar({ label, value, compact = false }: { label: string; value: number; compact?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <div className={cn("min-w-0", compact ? "space-y-1" : "flex items-center gap-2.5")}>
      <span className={cn("text-fg-2", compact ? "flex items-center justify-between gap-1 text-[11px]" : "w-16 shrink-0 text-[12px] font-semibold")}>
        {label}
        {compact && <span className="font-semibold tabular-nums text-fg">{value.toFixed(0)}</span>}
      </span>
      <span className={cn("block overflow-hidden rounded-full bg-surface-3", compact ? "h-1.5 w-full" : "h-2 flex-1")} role="img" aria-label={`${label}: ${value.toFixed(1)} / 5`}>
        <span className="block h-full rounded-full bg-accent-3" style={{ width: `${pct}%` }} />
      </span>
      {!compact && <span className="w-8 shrink-0 text-right text-[12px] font-semibold tabular-nums text-fg">{value.toFixed(1)}</span>}
    </div>
  );
}

/**
 * Reyting xulosasi: katta o'rtacha baho + 5★…1★ taqsimot chiziqlari.
 * Sahifada reyting faqat shu yerda (va hero'da) ko'rsatiladi — takror yo'q.
 */
export async function ReviewSummary({
  rating,
  count,
  distribution,
  items,
  className,
}: {
  rating: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  /** Sharhlar (mezonlar va tavsiya) — berilsa o'rtacha mezonlar va «% tavsiya qiladi» ko'rsatiladi */
  items?: ReviewCriteriaSource[];
  className?: string;
}) {
  if (count === 0) return null;
  const til = await getLocale();
  const max = Math.max(1, ...Object.values(distribution));
  const extra = items?.length ? reviewCriteriaSummary(items) : null;
  const hasCriteria = Boolean(extra && Object.keys(extra.averages).length);
  return (
    <div className={cn("card-outline p-5 sm:p-6", className)}>
      <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
        <div className="flex items-center gap-4 sm:flex-col sm:items-start sm:gap-1">
          <p className="font-display text-[44px] font-semibold leading-none tracking-tight text-fg sm:text-[52px]">{rating.toFixed(1)}</p>
          <div>
            <Stars value={rating} size={14} showValue={false} />
            <p className="mt-1 text-[12px] text-fg-3">{PROFIL.reviewsOf5[til](count)}</p>
          </div>
        </div>
        <ul className="space-y-1.5" aria-label={tr(til, PROFIL.distributionAria)}>
          {([5, 4, 3, 2, 1] as const).map((n) => {
            const v = distribution[n] ?? 0;
            const pct = count ? Math.round((v / count) * 100) : 0;
            return (
              <li key={n} className="flex items-center gap-2.5 text-[12px]">
                <span className="inline-flex w-7 shrink-0 items-center gap-0.5 font-semibold text-fg-2 tabular-nums">
                  {n} <Star size={10} className="fill-accent-3 text-accent-3" />
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={PROFIL.starsRowAria[til](n, v, pct)}>
                  <span className="block h-full rounded-full bg-accent-3 transition-[width] duration-700" style={{ width: `${Math.round((v / max) * 100)}%` }} />
                </span>
                <span className="w-10 shrink-0 text-right text-fg-3 tabular-nums">{pct}%</span>
              </li>
            );
          })}
        </ul>
      </div>
      {extra && (hasCriteria || extra.recommendPct != null) && (
        <div className="mt-5 grid gap-5 border-t border-line pt-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
          {extra.recommendPct != null ? (
            <div className="flex items-center gap-3 sm:min-w-[132px] sm:flex-col sm:items-start sm:gap-1">
              <p className="font-display text-[32px] font-semibold leading-none tracking-tight text-success-text">{extra.recommendPct}%</p>
              <p className="flex items-center gap-1.5 text-[12px] leading-snug text-fg-3">
                <ThumbsUp size={13} className="shrink-0 text-success-text" /> {tr(til, PROFIL.recommendPct)}
              </p>
            </div>
          ) : (
            <span className="hidden sm:block" />
          )}
          {hasCriteria && (
            <div className="space-y-2" aria-label={tr(til, PROFIL.criteriaAria)}>
              {RATING_CRITERIA.map((c) => {
                const a = extra.averages[c.key];
                return a ? <CriterionBar key={c.key} label={MEZON[c.key] ? tr(til, MEZON[c.key]) : c.label} value={a.avg} /> : null;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Sharhlar ro'yxati (server va client'da ishlaydi).
 * Har bir sharh — alohida karta: avatar, ism, yulduzlar, vaqt va matn.
 */
export async function ReviewList({
  reviews,
  highlightAuthorId,
  specialistId,
  canModerate = false,
  canReply = false,
  canReport = false,
  replyAuthor,
}: {
  reviews: ReviewListItem[];
  highlightAuthorId?: string | null;
  /** Moderatsiya (admin): har bir sharh yonida "O'chirish" — specialistId bilan birga beriladi; o'z sharhini o'chirish ham shu id bilan */
  specialistId?: string;
  canModerate?: boolean;
  /** Profil egasi: har bir sharhga "Javob yozish" */
  canReply?: boolean;
  /** Kirgan foydalanuvchi: boshqalarning sharhiga "Shikoyat qilish" */
  canReport?: boolean;
  /** Javob bloki sarlavhasi uchun mutaxassis (ism + avatar) */
  replyAuthor?: { name: string; avatarUrl: string | null };
}) {
  const til = await getLocale();
  if (reviews.length === 0) {
    return <EmptyState icon={MessageSquareText} title={tr(til, PROFIL.noReviewsTitle)} description={tr(til, PROFIL.noReviewsDesc)} />;
  }

  return (
    <ul className="space-y-3">
      {reviews.map((r, i) => {
        const mine = highlightAuthorId != null && r.authorId === highlightAuthorId;
        return (
          <li
            key={r.id}
            id={`sharh-${r.id}`}
            className={cn("card animate-fade-up scroll-mt-28 p-4 sm:p-5", mine && "border-accent/40")}
            style={{ animationDelay: `${Math.min(i, 6) * 60}ms`, animationDuration: "0.5s" }}
          >
            <div className="flex items-start gap-3">
              <Avatar name={r.author.name} src={r.author.avatarUrl} size={40} decorative />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold text-fg">
                    <span className="truncate">{r.author.name}</span>
                    {mine && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-text">{tr(til, PROFIL.you)}</span>}
                    {r.verified && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success-text"
                        title={tr(til, PROFIL.orderVerifiedHint)}
                      >
                        <BadgeCheck size={12} /> {tr(til, PROFIL.orderVerified)}
                      </span>
                    )}
                  </p>
                  <span className="flex items-center gap-2">
                    <time className="text-[12px] text-fg-3" dateTime={new Date(r.createdAt).toISOString()} title={formatDateTime(r.createdAt)}>
                      {timeAgoLabel(til, r.createdAt)}
                    </time>
                    {canModerate && specialistId && r.authorId && !mine && <ReviewDeleteButton specialistId={specialistId} authorId={r.authorId} />}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Stars value={r.rating} size={13} showValue={false} />
                  {r.recommend === true && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success-text">
                      <ThumbsUp size={11} /> {tr(til, PROFIL.recommends)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-fg-2">{r.text}</p>
            {RATING_CRITERIA.some((c) => typeof r[c.key] === "number") && (
              <div className="mt-3 grid grid-cols-3 gap-3 sm:max-w-md">
                {RATING_CRITERIA.map((c) => {
                  const v = r[c.key];
                  return typeof v === "number" ? <CriterionBar key={c.key} label={MEZON[c.key] ? tr(til, MEZON[c.key]) : c.label} value={v} compact /> : <span key={c.key} />;
                })}
              </div>
            )}
            {r.media && r.media.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {r.media.slice(0, 4).map((url, k) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block h-20 w-20 overflow-hidden rounded-[12px] border border-line bg-surface-3 transition hover:opacity-90">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={PROFIL.reviewImageAlt[til](r.author.name, k + 1)} loading="lazy" className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            )}

            {/* Mutaxassis javobi */}
            {r.reply && (
              <div className="mt-3.5 rounded-[16px] bg-surface-3 px-4 py-3 sm:ml-[52px]">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] font-semibold text-fg">
                  <CornerDownRight size={13} className="text-accent" aria-hidden />
                  {replyAuthor ? PROFIL.replyOf[til](replyAuthor.name) : tr(til, PROFIL.specialistReply)}
                  {r.replyAt && (
                    <time className="font-normal text-fg-3" dateTime={new Date(r.replyAt).toISOString()} title={formatDateTime(r.replyAt)}>
                      · {timeAgoLabel(til, r.replyAt)}
                    </time>
                  )}
                </p>
                <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-fg-2">{r.reply}</p>
              </div>
            )}

            {/* Amallar: javob (egasi), o'z sharhini o'chirish, shikoyat */}
            {(canReply || (mine && specialistId) || (canReport && !mine)) && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5">
                <div className="flex flex-wrap items-center gap-1">
                  {canReply && <ReviewReplyForm reviewId={r.id} existing={r.reply ?? null} />}
                  {mine && specialistId && <ReviewDeleteButton specialistId={specialistId} />}
                </div>
                {canReport && !mine && <ReportButton targetType="review" targetId={r.id} loggedIn className="ml-auto" />}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

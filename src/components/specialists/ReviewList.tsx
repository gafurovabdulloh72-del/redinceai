import { BadgeCheck, CornerDownRight, MessageSquareText, Star } from "lucide-react";
import { Avatar, EmptyState, Stars } from "@/components/ui";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
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
}

/**
 * Reyting xulosasi: katta o'rtacha baho + 5★…1★ taqsimot chiziqlari.
 * Sahifada reyting faqat shu yerda (va hero'da) ko'rsatiladi — takror yo'q.
 */
export function ReviewSummary({
  rating,
  count,
  distribution,
  className,
}: {
  rating: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  className?: string;
}) {
  if (count === 0) return null;
  const max = Math.max(1, ...Object.values(distribution));
  return (
    <div className={cn("card-outline grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8 sm:p-6", className)}>
      <div className="flex items-center gap-4 sm:flex-col sm:items-start sm:gap-1">
        <p className="font-display text-[44px] font-semibold leading-none tracking-tight text-fg sm:text-[52px]">{rating.toFixed(1)}</p>
        <div>
          <Stars value={rating} size={14} showValue={false} />
          <p className="mt-1 text-[12px] text-fg-3">
            {count} ta sharh · 5 dan
          </p>
        </div>
      </div>
      <ul className="space-y-1.5" aria-label="Baholar taqsimoti">
        {([5, 4, 3, 2, 1] as const).map((n) => {
          const v = distribution[n] ?? 0;
          const pct = count ? Math.round((v / count) * 100) : 0;
          return (
            <li key={n} className="flex items-center gap-2.5 text-[12px]">
              <span className="inline-flex w-7 shrink-0 items-center gap-0.5 font-semibold text-fg-2 tabular-nums">
                {n} <Star size={10} className="fill-accent-3 text-accent-3" />
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${n} yulduz: ${v} ta (${pct}%)`}>
                <span className="block h-full rounded-full bg-accent-3 transition-[width] duration-700" style={{ width: `${Math.round((v / max) * 100)}%` }} />
              </span>
              <span className="w-10 shrink-0 text-right text-fg-3 tabular-nums">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Sharhlar ro'yxati (server va client'da ishlaydi).
 * Har bir sharh — alohida karta: avatar, ism, yulduzlar, vaqt va matn.
 */
export function ReviewList({
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
  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareText}
        title="Hali sharhlar yo'q"
        description="Birinchi bo'lib fikr bildiring — bu boshqa mijozlarga to'g'ri tanlov qilishga yordam beradi."
      />
    );
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
                    {mine && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-text">Siz</span>}
                    {r.verified && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success-text"
                        title="Muallifning shu mutaxassis bilan qabul qilingan buyurtmasi bor"
                      >
                        <BadgeCheck size={12} /> Buyurtma tasdiqlangan
                      </span>
                    )}
                  </p>
                  <span className="flex items-center gap-2">
                    <time className="text-[12px] text-fg-3" dateTime={new Date(r.createdAt).toISOString()} title={formatDateTime(r.createdAt)}>
                      {timeAgo(r.createdAt)}
                    </time>
                    {canModerate && specialistId && r.authorId && !mine && <ReviewDeleteButton specialistId={specialistId} authorId={r.authorId} />}
                  </span>
                </div>
                <div className="mt-1">
                  <Stars value={r.rating} size={13} showValue={false} />
                </div>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-fg-2">{r.text}</p>

            {/* Mutaxassis javobi */}
            {r.reply && (
              <div className="mt-3.5 rounded-[16px] bg-surface-3 px-4 py-3 sm:ml-[52px]">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] font-semibold text-fg">
                  <CornerDownRight size={13} className="text-accent" aria-hidden />
                  {replyAuthor ? `${replyAuthor.name} javobi` : "Mutaxassis javobi"}
                  {r.replyAt && (
                    <time className="font-normal text-fg-3" dateTime={new Date(r.replyAt).toISOString()} title={formatDateTime(r.replyAt)}>
                      · {timeAgo(r.replyAt)}
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

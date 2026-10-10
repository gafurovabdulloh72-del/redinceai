import { MessageSquareText } from "lucide-react";
import { Avatar, EmptyState, Stars } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

export interface ReviewListItem {
  id: string;
  rating: number;
  text: string;
  createdAt: Date | number | string;
  author: { name: string; avatarUrl: string | null };
}

/**
 * Sharhlar ro'yxati (server va client'da ishlaydi).
 * Har bir sharh — alohida shisha karta: avatar, ism, yulduzlar, vaqt va matn.
 */
export function ReviewList({ reviews, highlightAuthorName }: { reviews: ReviewListItem[]; highlightAuthorName?: string | null }) {
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
        const mine = highlightAuthorName != null && r.author.name === highlightAuthorName;
        return (
          <li
            key={r.id}
            className="glass animate-fade-up p-4 sm:p-5"
            style={{ animationDelay: `${Math.min(i, 6) * 60}ms`, animationDuration: "0.5s" }}
          >
            <div className="flex items-start gap-3">
              <Avatar name={r.author.name} src={r.author.avatarUrl} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <p className="flex items-center gap-2 truncate text-[15px] font-semibold text-fg">
                    {r.author.name}
                    {mine && <span className="rounded-full bg-tint-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-tint">Siz</span>}
                  </p>
                  <time className="text-[12px] text-fg-3">{timeAgo(r.createdAt)}</time>
                </div>
                <div className="mt-1">
                  <Stars value={r.rating} size={13} showValue={false} />
                </div>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-fg-2">{r.text}</p>
          </li>
        );
      })}
    </ul>
  );
}

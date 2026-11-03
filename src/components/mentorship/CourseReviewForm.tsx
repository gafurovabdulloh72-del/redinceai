"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { MENTOR_LIMITS } from "@/lib/mentorship/format";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { MS } from "@/lib/i18n/dict/mentorship";

/** Yozilgan talaba kursga baho + fikr qoldiradi (bir marta — keyin tahrirlanadi) */
export function CourseReviewForm({ courseId, initial }: { courseId: string; initial: { rating: number; body: string } | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const til = useLocale();
  const [rating, setRating] = useState(initial?.rating ?? 5);
  const [body, setBody] = useState(initial?.body ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/mentorlik/kurslar/${encodeURIComponent(courseId)}/sharh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, body: body.trim() }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || tr(til, MS.notSent));
      toast(initial ? tr(til, MS.reviewUpdated) : tr(til, MS.reviewThanks), "success");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : tr(til, MS.error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-4">
      <p className="text-[14px] font-semibold text-fg">{initial ? tr(til, MS.yourReview) : tr(til, MS.rateCourse)}</p>
      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} aria-label={MS.stars[til](n)} className="press p-0.5">
            <Star size={24} className={cn("transition", n <= rating ? "fill-accent text-accent" : "text-fg-4")} />
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MENTOR_LIMITS.reviewMax}
        rows={3}
        placeholder={tr(til, MS.reviewPh)}
        className="field mt-3 w-full resize-y py-2.5 text-[14px] leading-relaxed"
      />
      <button onClick={submit} disabled={busy} className="btn-accent mt-2.5 inline-flex h-10 items-center gap-2 rounded-[12px] px-4 text-[14px] font-semibold disabled:opacity-60">
        {busy ? <Loader2 size={15} className="animate-spin" /> : null} {initial ? tr(til, MS.update) : tr(til, MS.send)}
      </button>
    </div>
  );
}

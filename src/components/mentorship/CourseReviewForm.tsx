"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { MENTOR_LIMITS } from "@/lib/mentorship/format";
import { cn } from "@/lib/utils";

/** Yozilgan talaba kursga baho + fikr qoldiradi (bir marta — keyin tahrirlanadi) */
export function CourseReviewForm({ courseId, initial }: { courseId: string; initial: { rating: number; body: string } | null }) {
  const router = useRouter();
  const { toast } = useToast();
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
      if (!res.ok || !j.ok) throw new Error(j.error || "Yuborilmadi");
      toast(initial ? "Sharh yangilandi" : "Sharhingiz uchun rahmat 🙌", "success");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-4">
      <p className="text-[14px] font-semibold text-fg">{initial ? "Sharhingiz" : "Kursni baholang"}</p>
      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} yulduz`} className="press p-0.5">
            <Star size={24} className={cn("transition", n <= rating ? "fill-accent text-accent" : "text-fg-4")} />
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MENTOR_LIMITS.reviewMax}
        rows={3}
        placeholder="Kurs haqida fikringiz (ixtiyoriy)…"
        className="field mt-3 w-full resize-y py-2.5 text-[14px] leading-relaxed"
      />
      <button onClick={submit} disabled={busy} className="btn-accent mt-2.5 inline-flex h-10 items-center gap-2 rounded-[12px] px-4 text-[14px] font-semibold disabled:opacity-60">
        {busy ? <Loader2 size={15} className="animate-spin" /> : null} {initial ? "Yangilash" : "Yuborish"}
      </button>
    </div>
  );
}

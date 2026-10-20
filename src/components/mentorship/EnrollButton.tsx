"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, PlayCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast";

/** Kursga yozilish tugmasi; yozilgach birinchi darsga o'tadi (yoki sahifani yangilaydi) */
export function EnrollButton({ courseId, enrolled, loggedIn, firstLessonId, price }: { courseId: string; enrolled: boolean; loggedIn: boolean; firstLessonId: string | null; price: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  if (enrolled) {
    return firstLessonId ? (
      <button onClick={() => router.push(`/mentorlik/dars/${firstLessonId}`)} className="btn-accent inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] text-[15px] font-semibold">
        <PlayCircle size={18} /> Davom etish
      </button>
    ) : (
      <span className="inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-success-soft text-[14px] font-semibold text-success-text">Siz yozilgansiz</span>
    );
  }

  const enroll = async () => {
    if (!loggedIn) {
      router.push(`/auth/kirish?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/mentorlik/kurslar/${encodeURIComponent(courseId)}/yozilish`, { method: "POST" });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Yozilib bo'lmadi");
      toast("Kursga yozildingiz 🎓", "success");
      if (firstLessonId) router.push(`/mentorlik/dars/${firstLessonId}`);
      else router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Xatolik", "error");
      setBusy(false);
    }
  };

  return (
    <button onClick={enroll} disabled={busy} className="btn-accent inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] text-[15px] font-semibold disabled:opacity-60">
      {busy ? <Loader2 size={18} className="animate-spin" /> : <GraduationCap size={18} />}
      {price ? "Kursga yozilish" : "Bepul boshlash"}
    </button>
  );
}

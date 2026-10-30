"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/** Darsni «tugatildi» deb belgilash tugmasi; progressni yangilaydi, keyingi darsga o'tish taklif qiladi */
export function LessonComplete({ lessonId, completed, nextId, blockedReason = null }: { lessonId: string; completed: boolean; nextId: string | null; blockedReason?: string | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [done, setDone] = useState(completed);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    if (blockedReason && !done) {
      toast(blockedReason, "info");
      return;
    }
    setBusy(true);
    const next = !done;
    try {
      const res = await fetch(`/api/mentorlik/darslar/${encodeURIComponent(lessonId)}/bajarildi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: next }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string; data?: { progressPct: number; certificateCode?: string | null; certificateNew?: boolean; streak?: number } };
      if (!res.ok || !j.ok) throw new Error(j.error || "Xatolik");
      setDone(next);
      if (j.data?.certificateNew && j.data.certificateCode) {
        toast("Tabriklaymiz! Kurs tugadi — sertifikat tayyor 🎓", "success");
        router.push(`/sertifikat/${j.data.certificateCode}`);
        return;
      }
      router.refresh();
      if (next && (j.data?.streak ?? 0) >= 2) toast(`🔥 ${j.data?.streak} kunlik seriya — shu zaylda davom eting!`, "success");
      else if (next && nextId) toast("Dars belgilandi — keyingisiga o'ting", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-[14px] px-5 text-[14.5px] font-semibold transition disabled:opacity-60",
        done ? "bg-success-soft text-success-text" : "btn-accent",
      )}
    >
      {busy ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
      {done ? "Tugatildi" : "Tugatdim"}
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/** Vakansiyani saqlash (bookmark) — Kabinet → Arizalarim → "Saqlangan vakansiyalar" da chiqadi */
export function SaveVacancyButton({ vacancyId, initialSaved, loggedIn, className }: { vacancyId: string; initialSaved: boolean; loggedIn: boolean; className?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    if (!loggedIn) {
      router.push(`/auth/kirish?next=${encodeURIComponent(`/vakansiyalar/${vacancyId}`)}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !saved;
    setSaved(next);
    try {
      const res = await fetch(`/api/vakansiyalar/${encodeURIComponent(vacancyId)}/saqlash`, { method: "POST" });
      const j = (await res.json()) as { ok: boolean; data?: { saved: boolean } };
      if (!j.ok || !j.data) throw new Error();
      setSaved(j.data.saved);
      toast(j.data.saved ? "Saqlandi — Kabinet → Arizalarim" : "Saqlanganlardan olindi", "info");
    } catch {
      setSaved(!next);
      toast("Bo'lmadi", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? "Saqlanganlardan olish" : "Vakansiyani saqlash"}
      className={cn("press inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-[14px] font-semibold transition disabled:opacity-50", saved ? "border-accent bg-accent-soft text-accent-text" : "border-line-2 text-fg hover:border-fg", className)}
    >
      {saved ? <BookmarkCheck size={16} className="animate-pop" /> : <Bookmark size={16} />}
      {saved ? "Saqlangan" : "Saqlash"}
    </button>
  );
}

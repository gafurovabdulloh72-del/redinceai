"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { haptic } from "@/components/motion/haptics";
import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Kursni saqlash (Udemy «Wishlist»): belgi tugmasi — optimistik, mehmon bosса kirish sahifasiga.
 * Saqlanganlar: Kabinet → Saqlanganlar → Kurslar.
 */
export function CourseSaveButton({ courseId, initialSaved, loggedIn, className, size = 40 }: { courseId: string; initialSaved: boolean; loggedIn: boolean; className?: string; size?: number }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!loggedIn) {
      router.push(`/auth/kirish?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (busy) return;
    const next = !saved;
    setSaved(next);
    haptic("light");
    setBusy(true);
    try {
      const r = await fetch(`/api/mentorlik/kurslar/${courseId}/saqlash`, { method: "POST" });
      const j = (await r.json()) as { ok: boolean; data?: { saved: boolean }; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error || "Saqlanmadi");
      setSaved(j.data?.saved ?? next);
      if (j.data?.saved) showToast("Saqlandi — Kabinet → Saqlanganlar → Kurslar", "success");
    } catch (e) {
      setSaved(!next);
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={saved}
      aria-label={saved ? "Saqlanganlardan olish" : "Kursni saqlash"}
      data-tip={saved ? "Saqlangan" : "Saqlash"}
      className={cn("press inline-flex shrink-0 items-center justify-center rounded-full border transition", saved ? "border-fg bg-fg text-bg" : "border-line text-fg-2 hover:border-fg hover:text-fg", className)}
      style={{ width: size, height: size }}
    >
      <Bookmark size={Math.round(size * 0.45)} className={saved ? "fill-current" : ""} />
    </button>
  );
}

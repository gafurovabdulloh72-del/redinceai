"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { haptic } from "@/components/motion/haptics";
import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { MS } from "@/lib/i18n/dict/mentorship";

/**
 * Kursni saqlash (Udemy «Wishlist»): belgi tugmasi — optimistik, mehmon bosса kirish sahifasiga.
 * Saqlanganlar: Kabinet → Saqlanganlar → Kurslar.
 */
export function CourseSaveButton({ courseId, initialSaved, loggedIn, className, size = 40 }: { courseId: string; initialSaved: boolean; loggedIn: boolean; className?: string; size?: number }) {
  const router = useRouter();
  const til = useLocale();
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
      if (!r.ok || !j.ok) throw new Error(j.error || tr(til, MS.notSaved));
      setSaved(j.data?.saved ?? next);
      if (j.data?.saved) showToast(tr(til, MS.savedToast), "success");
    } catch (e) {
      setSaved(!next);
      showToast(e instanceof Error ? e.message : tr(til, MS.error), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={saved}
      aria-label={saved ? tr(til, MS.unsave) : tr(til, MS.saveCourse)}
      data-tip={saved ? tr(til, MS.saved) : tr(til, MS.save)}
      className={cn("press inline-flex shrink-0 items-center justify-center rounded-full border transition", saved ? "border-fg bg-fg text-bg" : "border-line text-fg-2 hover:border-fg hover:text-fg", className)}
      style={{ width: size, height: size }}
    >
      <Bookmark size={Math.round(size * 0.45)} className={saved ? "fill-current" : ""} />
    </button>
  );
}

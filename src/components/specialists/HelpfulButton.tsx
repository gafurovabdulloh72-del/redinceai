"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ThumbsUp } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useToast } from "@/components/ui/toast";
import { tr } from "@/lib/i18n";
import { PROFIL_X } from "@/lib/i18n/dict/profile";
import { cn } from "@/lib/utils";

type Resp = { ok: true; data: { voted: boolean; n: number } } | { ok: false; error: string };

/**
 * Sharhga «Foydali» ovozi: optimistik almashinadi, xatoda qaytariladi. Mehmon — kirish sahifasiga.
 * O'z sharhida ko'rsatilmaydi (server ham rad etadi).
 */
export function HelpfulButton({ reviewId, count, voted, loggedIn, loginHref, className }: { reviewId: string; count: number; voted: boolean; loggedIn: boolean; loginHref: string; className?: string }) {
  const til = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [on, setOn] = useState(voted);
  const [n, setN] = useState(count);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!loggedIn) {
      router.push(loginHref);
      return;
    }
    if (busy) return;
    setBusy(true);
    const prev = { on, n };
    setOn(!on);
    setN((v) => Math.max(0, v + (on ? -1 : 1)));
    try {
      const res = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}/helpful`, { method: "POST" });
      const j = (await res.json()) as Resp;
      if (!j.ok) throw new Error(j.error);
      setOn(j.data.voted);
      setN(j.data.n);
    } catch (e) {
      setOn(prev.on);
      setN(prev.n);
      toast(e instanceof Error && e.message ? e.message : tr(til, PROFIL_X.helpfulLogin), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? tr(til, PROFIL_X.helpfulOn) : PROFIL_X.helpfulAria[til](n)}
      title={loggedIn ? undefined : tr(til, PROFIL_X.helpfulLogin)}
      className={cn(
        "press inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold transition",
        on ? "border-transparent bg-fg/8 text-fg" : "border-line text-fg-3 hover:border-fg hover:text-fg",
        className,
      )}
    >
      <ThumbsUp size={12} className={cn(on && "fill-current")} aria-hidden /> {tr(til, PROFIL_X.helpful)}
      {n > 0 && <span className="tabular-nums">{n}</span>}
    </button>
  );
}

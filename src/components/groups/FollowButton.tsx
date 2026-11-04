"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Clock, UserCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { SOROVLAR } from "@/lib/i18n/dict/moderation";
import { NotifyBell, type NotifyLevel } from "./NotifyBell";

/**
 * Ijodkorga obuna bo'lish (follow): bosilganda darhol almashadi, server javobi bilan son yangilanadi.
 * Kirmagan foydalanuvchi — kirish sahifasiga (qaytib kelganda shu profil).
 */
export function FollowButton({
  userId,
  initialFollowing,
  initialCount,
  loggedIn,
  size = "sm",
  compact = false,
  showCount = true,
  variant = "accent",
  initialNotifyLevel = null,
  showBell = false,
  initialRequested = false,
}: {
  userId: string;
  initialFollowing: boolean;
  initialCount: number;
  loggedIn: boolean;
  size?: "sm" | "md" | "lg";
  /** Faqat ikonka + son (tor joylar uchun) */
  compact?: boolean;
  /** Ro'yxatlarda son ko'rsatilmaydi */
  showCount?: boolean;
  /** accent — profil sahifasidagi asosiy tugma; outline — ro'yxat/panel ichida (v3: ko'p coral bo'lmasin) */
  variant?: "accent" | "outline";
  /** Obuna qo'ng'irog'i boshlang'ich darajasi (followState.notifyLevel) */
  initialNotifyLevel?: NotifyLevel | null;
  /** Obuna bo'lganda yonida qo'ng'iroq tugmasi (profil sahifasi) */
  showBell?: boolean;
  /** Yopiq profilga so'rov yuborilgan, hali tasdiqlanmagan (followState.requested) */
  initialRequested?: boolean;
}) {
  const router = useRouter();
  const til = useLocale();
  const [following, setFollowing] = useState(initialFollowing);
  const [requested, setRequested] = useState(initialRequested);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!loggedIn) {
      router.push(`/auth/kirish?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    const prev = { following, count, requested };
    // Yopiq profil: so'rov holati bo'lsa bosish uni bekor qiladi — optimistik almashish faqat oddiy obunada
    if (requested) setRequested(false);
    else {
      setFollowing(!following);
      setCount((c) => Math.max(0, c + (following ? -1 : 1)));
    }
    try {
      const res = await fetch(`/api/follow/${encodeURIComponent(userId)}`, { method: "POST" });
      const j = (await res.json()) as { ok: boolean; data?: { following: boolean; followersCount: number; status?: string } };
      if (!j.ok || !j.data) throw new Error();
      setFollowing(j.data.following);
      setCount(j.data.followersCount);
      setRequested(j.data.status === "requested");
    } catch {
      setFollowing(prev.following);
      setCount(prev.count);
      setRequested(prev.requested);
    } finally {
      setBusy(false);
    }
  }

  const btn = requested ? (
    <Button type="button" variant="ghost" size={size} onClick={toggle} disabled={busy} aria-pressed title={tr(til, SOROVLAR.hint)}>
      <Clock size={15} />
      {!compact && tr(til, SOROVLAR.requested)}
      <span className="sr-only">{tr(til, SOROVLAR.cancel)}</span>
    </Button>
  ) : (
    <Button type="button" variant={following ? "ghost" : variant} size={size} onClick={toggle} disabled={busy} aria-pressed={following} title={following ? "Obunani bekor qilish" : "Yangi ishlaridan xabardor bo'ling"}>
      {following ? <UserCheck size={15} /> : <UserPlus size={15} />}
      {!compact && (following ? "Obunasiz" : "Obuna bo'lish")}
      {showCount && <span className={following ? "text-fg-3" : "opacity-80"}>{count}</span>}
    </Button>
  );
  if (!showBell) return btn;
  return (
    <span className="inline-flex items-center gap-1.5">
      {btn}
      {following && <NotifyBell userId={userId} initial={initialNotifyLevel ?? "highlights"} />}
    </span>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui";

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
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!loggedIn) {
      router.push(`/auth/kirish?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    const prev = { following, count };
    setFollowing(!following);
    setCount((c) => Math.max(0, c + (following ? -1 : 1)));
    try {
      const res = await fetch(`/api/follow/${encodeURIComponent(userId)}`, { method: "POST" });
      const j = (await res.json()) as { ok: boolean; data?: { following: boolean; followersCount: number } };
      if (!j.ok || !j.data) throw new Error();
      setFollowing(j.data.following);
      setCount(j.data.followersCount);
    } catch {
      setFollowing(prev.following);
      setCount(prev.count);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant={following ? "outline" : "accent"} size={size} onClick={toggle} disabled={busy} aria-pressed={following} title={following ? "Obunani bekor qilish" : "Yangi ishlaridan xabardor bo'ling"}>
      {following ? <UserCheck size={15} /> : <UserPlus size={15} />}
      {!compact && (following ? "Obunasiz" : "Obuna bo'lish")}
      {showCount && <span className={following ? "text-fg-3" : "opacity-80"}>{count}</span>}
    </Button>
  );
}

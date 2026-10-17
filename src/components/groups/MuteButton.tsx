"use client";

import { useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useToast } from "@/components/ui/toast";

/** Jamoa bildirishnomalarini o'chirish/yoqish — a'zolik saqlanadi (rasmiy kanaldan chiqib bo'lmaydi, lekin jim qilish mumkin) */
export function MuteButton({ slug, initialMuted }: { slug: string; initialMuted: boolean }) {
  const { toast } = useToast();
  const [muted, setMuted] = useState(initialMuted);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !muted;
    setMuted(next);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(slug)}/mute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ muted: next }) });
      if (!res.ok) throw new Error();
      toast(next ? "Bildirishnomalar o'chirildi" : "Bildirishnomalar yoqildi", "info");
    } catch {
      setMuted(!next);
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
      aria-pressed={muted}
      aria-label={muted ? "Bildirishnomalarni yoqish" : "Bildirishnomalarni o'chirish"}
      title={muted ? "Bildirishnomalar o'chirilgan" : "Bildirishnomalarni o'chirish"}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-line-2 text-fg-3 transition hover:text-fg disabled:opacity-50"
    >
      {muted ? <BellOff size={16} /> : <Bell size={16} />}
    </button>
  );
}

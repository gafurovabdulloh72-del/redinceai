"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, Check, RadioTower } from "lucide-react";
import { Switch } from "@/components/specialists/Filters";
import { useToast } from "@/components/ui/toast";
import { usePresence } from "@/components/motion/usePresence";
import { MUTE_OPTIONS } from "@/lib/groups/limits";
import { cn, formatDateTime } from "@/lib/utils";

type MuteKey = (typeof MUTE_OPTIONS)[number]["key"];

/**
 * Bildirishnoma menyusi: jim qilish (1 soat / 8 soat / doim) va efir eslatmalari — a'zolik saqlanadi
 * (rasmiy kanaldan chiqib bo'lmaydi, lekin jim qilish mumkin). Popover `.pop-in/.pop-out`, Esc/tashqi bosish yopadi.
 */
export function MuteButton({ slug, initialMuted, initialMutedUntil = null, initialEventReminders = true }: { slug: string; initialMuted: boolean; initialMutedUntil?: number | null; initialEventReminders?: boolean }) {
  const { toast } = useToast();
  const [muted, setMuted] = useState(initialMuted);
  const [until, setUntil] = useState<number | null>(initialMutedUntil);
  const [reminders, setReminders] = useState(initialEventReminders);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const { mounted, closing } = usePresence(open, 160);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function post(body: Record<string, unknown>) {
    const res = await fetch(`/api/groups/${encodeURIComponent(slug)}/mute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await res.json()) as { ok: boolean; data?: { muted: boolean | null; mutedUntil: number | null }; error?: string };
    if (!res.ok || !j.ok) throw new Error(j.error || "Bo'lmadi");
    return j.data;
  }

  async function setMute(key: MuteKey | null) {
    if (busy) return;
    setBusy(true);
    try {
      const d = await post(key ? { muted: true, duration: key } : { muted: false });
      setMuted(Boolean(d?.muted));
      setUntil(d?.mutedUntil ?? null);
      const label = MUTE_OPTIONS.find((o) => o.key === key)?.label;
      toast(key ? (key === "forever" ? "Bildirishnomalar o'chirildi" : `${label} jim`) : "Bildirishnomalar yoqildi", "info");
      setOpen(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bo'lmadi", "error");
    } finally {
      setBusy(false);
    }
  }

  async function setRem(v: boolean) {
    if (busy) return;
    setBusy(true);
    const prev = reminders;
    setReminders(v);
    try {
      await post({ eventReminders: v });
    } catch (e) {
      setReminders(prev);
      toast(e instanceof Error ? e.message : "Bo'lmadi", "error");
    } finally {
      setBusy(false);
    }
  }

  const activeKey: MuteKey | null = muted ? (until ? null : "forever") : null;

  return (
    <span ref={wrap} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={muted ? "Bildirishnomalar jim — sozlash" : "Bildirishnomalar"}
        title={muted ? (until ? `${formatDateTime(until)} gacha jim` : "Bildirishnomalar o'chirilgan") : "Bildirishnomalar"}
        className={cn("flex h-11 w-11 items-center justify-center rounded-full border border-line-2 transition hover:text-fg disabled:opacity-50", muted ? "text-fg" : "text-fg-3")}
      >
        {muted ? <BellOff size={16} /> : <Bell size={16} />}
      </button>
      {mounted && (
        <div role="menu" aria-label="Bildirishnomalar" className={cn("absolute right-0 top-full z-30 mt-1.5 w-60 rounded-[14px] bg-surface p-1.5 shadow-[var(--shadow-3)]", closing ? "pop-out" : "pop-in")}>
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-3">{muted ? (until ? `${formatDateTime(until)} gacha jim` : "Jim") : "Jim qilish"}</p>
          {MUTE_OPTIONS.map((o) => (
            <button key={o.key} type="button" role="menuitemradio" aria-checked={activeKey === o.key} onClick={() => void setMute(o.key)} className="flex h-9 w-full items-center justify-between rounded-[10px] px-2.5 text-[13px] font-semibold text-fg-2 transition hover:bg-fg/6 hover:text-fg">
              {o.label}
              {activeKey === o.key && <Check size={14} className="text-fg" />}
            </button>
          ))}
          {muted && (
            <button type="button" role="menuitem" onClick={() => void setMute(null)} className="flex h-9 w-full items-center gap-2 rounded-[10px] px-2.5 text-[13px] font-semibold text-fg transition hover:bg-fg/6">
              <Bell size={14} /> Yoqish
            </button>
          )}
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-line px-2.5 pb-1 pt-2">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-fg-2">
              <RadioTower size={14} className="text-fg-3" /> Efir eslatmalari
            </span>
            <Switch checked={reminders} onChange={(v) => void setRem(v)} label="Efir eslatmalari" />
          </div>
        </div>
      )}
    </span>
  );
}

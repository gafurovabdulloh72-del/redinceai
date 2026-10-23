"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellMinus, BellOff, BellRing, Check } from "lucide-react";
import { usePresence } from "@/components/motion/usePresence";
import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export type NotifyLevel = "all" | "highlights" | "off";

const LEVELS: Array<{ key: NotifyLevel; label: string; hint: string; icon: typeof Bell }> = [
  { key: "all", label: "Hammasi", hint: "Har bir yangi post va efir haqida xabar", icon: BellRing },
  { key: "highlights", label: "Faqat muhimi", hint: "Jonli efir va muhim e'lonlar", icon: Bell },
  { key: "off", label: "Jim", hint: "Xabar kelmaydi — lentada baribir ko'rinadi", icon: BellOff },
];

/**
 * Obuna qo'ng'irog'i (YouTube naqshi): obuna bo'lgandan keyin yonida chiqadi —
 * hammasi / faqat muhimi / jim. Tanlov serverga darhol yoziladi (follows.notify_level).
 */
export function NotifyBell({ userId, initial, className }: { userId: string; initial: NotifyLevel; className?: string }) {
  const [level, setLevel] = useState<NotifyLevel>(initial);
  const [open, setOpen] = useState(false);
  const presence = usePresence(open, 160);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function pick(next: NotifyLevel) {
    const prev = level;
    setLevel(next);
    setOpen(false);
    try {
      const res = await fetch(`/api/follow/${encodeURIComponent(userId)}/notify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ level: next }) });
      if (!res.ok) throw new Error();
    } catch {
      setLevel(prev);
      showToast("Saqlanmadi", "error");
    }
  }

  const current = LEVELS.find((l) => l.key === level) ?? LEVELS[1];
  const Icon = level === "off" ? BellMinus : current.icon;

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Bildirishnoma: ${current.label}`}
        title={`Bildirishnoma: ${current.label}`}
        className={cn("press grid h-9 w-9 place-items-center rounded-full border border-line-2 text-fg-2 transition hover:text-fg", open && "bg-fg/6 text-fg")}
      >
        <Icon size={16} />
      </button>
      {presence.mounted && (
        <div role="menu" aria-label="Bildirishnoma darajasi" className={cn("card-floating absolute right-0 top-[calc(100%+6px)] z-30 min-w-[220px] origin-top-right p-1", presence.closing ? "pop-out" : "pop-in")}>
          {LEVELS.map((l) => {
            const LIcon = l.icon;
            return (
              <button key={l.key} type="button" role="menuitemradio" aria-checked={level === l.key} onClick={() => void pick(l.key)} className="flex w-full items-start gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition hover:bg-fg/6">
                <LIcon size={15} className="mt-0.5 shrink-0 text-fg-3" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-fg">{l.label}</span>
                  <span className="block text-[12px] leading-snug text-fg-3">{l.hint}</span>
                </span>
                {level === l.key && <Check size={14} className="mt-0.5 shrink-0 text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

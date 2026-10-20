"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Globe } from "lucide-react";
import { useDisplayLocale } from "./DisplayLocale";
import { DISPLAY_LOCALES, DISPLAY_LABEL, DISPLAY_SHORT, type DisplayLocale } from "@/lib/i18n";
import { usePresence } from "@/components/motion/usePresence";
import { cn } from "@/lib/utils";

/** 2-bosqichда to'liq ishga tushadi (ingliz lug'ati + avtomatik tarjima API) */
const COMING: Record<DisplayLocale, boolean> = { uz: false, uz_cyrl: false, ru: false, en: true };

/**
 * Til almashtirgich (4 til): O'zbekcha · Ўзбекча (kirill) · Русский · English.
 * Bosilganda ro'yxat ochiladi; tanlansa POST /api/til + router.refresh() (server qayta chiziladi).
 * «Ўзбекча» — butun sahifa avtomatik kirillga aylanadi (CyrillicLayer).
 */
export function LocaleSwitch({ className, align = "end" }: { className?: string; align?: "start" | "end" }) {
  const display = useDisplayLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<DisplayLocale | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menu = usePresence(open, 160);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = async (til: DisplayLocale) => {
    if (til === display || pending) {
      setOpen(false);
      return;
    }
    setPending(til);
    try {
      const res = await fetch("/api/til", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ til }) });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } catch {
      /* tarmoq xatosi */
    } finally {
      setPending(null);
    }
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Til"
        data-no-cyrl
        className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12.5px] font-bold tracking-wide text-fg-2 shadow-1 transition hover:border-line-2 hover:text-fg"
      >
        <Globe size={15} className="text-fg-3" />
        {DISPLAY_SHORT[display]}
      </button>
      {menu.mounted && (
        <div
          role="menu"
          data-no-cyrl
          className={cn(
            "absolute top-full z-[135] mt-1.5 min-w-[172px] overflow-hidden rounded-[14px] border border-line bg-surface p-1 shadow-3",
            align === "end" ? "right-0" : "left-0",
            menu.closing ? "pop-out" : "pop-in",
          )}
        >
          {DISPLAY_LOCALES.map((l) => {
            const active = l === display;
            const soon = COMING[l];
            return (
              <button
                key={l}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                disabled={soon || pending !== null}
                onClick={() => void choose(l)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13.5px] font-semibold transition disabled:opacity-45",
                  active ? "bg-fg/6 text-fg" : "text-fg-2 hover:bg-fg/5 hover:text-fg",
                )}
              >
                <span className="grid h-6 w-7 shrink-0 place-items-center rounded-md bg-fg/6 text-[11px] font-bold tabular-nums">{DISPLAY_SHORT[l]}</span>
                <span className="flex-1">{DISPLAY_LABEL[l]}</span>
                {soon && <span className="text-[10.5px] font-medium text-fg-4">tez orada</span>}
                {active && <Check size={15} className="text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

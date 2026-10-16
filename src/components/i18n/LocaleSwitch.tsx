"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "./LocaleProvider";
import { LOCALE_SHORT, tr, type Locale } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";
import { cn } from "@/lib/utils";

/**
 * Ixcham til almashtirgich (navbar uslubida, ThemeToggle bilan bir xil o'lcham):
 * tugmada QAYSI TILGA o'tish ko'rsatiladi (uz rejimida "RU", ru rejimida "UZ").
 * Bosilganda POST /api/til cookie'ni o'rnatadi, so'ng router.refresh() —
 * server komponentlar yangi til bilan qayta chiziladi (sahifa to'liq qayta yuklanmaydi).
 */
export function LocaleSwitch({ className }: { className?: string }) {
  const til = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const next: Locale = til === "uz" ? "ru" : "uz";
  const label = tr(til, SHELL.locale.switchTo);

  const switchTo = async () => {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/til", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ til: next }),
      });
      if (res.ok) router.refresh();
    } catch {
      /* tarmoq xatosi — til o'zgarmaydi, tugma yana faol bo'ladi */
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void switchTo()}
      disabled={pending}
      aria-label={label}
      title={label}
      aria-busy={pending}
      className={cn(
        "card card-hover flex h-10 w-10 shrink-0 items-center justify-center !rounded-full text-[12px] font-bold tracking-wide text-fg-2 transition hover:text-fg",
        pending && "opacity-50",
        className,
      )}
    >
      {LOCALE_SHORT[next]}
    </button>
  );
}

"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { formatUsd } from "@/lib/utils";

/**
 * Narx yonida so'm ⇄ taxminiy dollar ko'rsatkichi (platforma kursi `usdRate` bo'yicha). Kurs sozlanmagan bo'lsa chiqmaydi.
 * Bosilganda ko'rsatkich almashinadi; faqat ma'lumot uchun — to'lov so'mda.
 */
export function UsdHint({ amount, usdRate, til = "uz", className }: { amount: number; usdRate: number | null | undefined; til?: Locale; className?: string }) {
  const [show, setShow] = useState(false);
  const usd = formatUsd(amount, usdRate);
  if (!usd) return null;
  const label = til === "ru" ? "в долларах" : "dollarda";
  return (
    <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? (til === "ru" ? "Показать в сумах" : "So'mda ko'rsatish") : `${label} ko'rsatish`} className={`press inline-flex h-7 items-center rounded-full border border-line px-2.5 text-[12px] font-semibold text-fg-3 transition hover:border-fg hover:text-fg ${className ?? ""}`}>
      <span key={String(show)} className="animate-swap">
        {show ? usd : "USD"}
      </span>
    </button>
  );
}

"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";
import { cn } from "@/lib/utils";

/** Logotip: "K" harfli siyoh plitka + coral nuqta (tinch — hover'da harakat yo'q). aria-label joriy tilda */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  const til = useLocale();
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5", className)} aria-label={tr(til, SHELL.common.logoAria)}>
      <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-[10px] bg-ink text-ink-fg">
        <svg viewBox="0 0 24 24" className="relative h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 4v16" />
          <path d="M18 4l-8.5 8L18 20" />
          <path d="M6 12h3.5" />
        </svg>
        <span aria-hidden className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
      </span>
      {!compact && (
        <span className="whitespace-nowrap font-display text-[17px] font-semibold tracking-[-0.03em] text-fg">
          Kasb Egalari<span className="text-accent">.</span>
        </span>
      )}
    </Link>
  );
}

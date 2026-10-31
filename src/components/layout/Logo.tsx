"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";
import { cn } from "@/lib/utils";

/**
 * Brend belgisi (2026-10-31): «k» harfi — Space Grotesk 700 glifi (shriftga bog'liq emas, path),
 * siyoh plitka + marjon nuqta (so'z belgisidagi «i» nuqtasining aksi). Favicon (`app/icon.svg`) va
 * ilova ikonkalari aynan shu geometriya — hamma joyda bir xil ko'rinadi.
 */
export const LOGO_K_PATH = "M70 0V700H196V313H214L378 496H542L313 256L550 0H388L214 197H196V0Z";

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <rect width="64" height="64" rx="18" className="fill-ink" />
      <path d={LOGO_K_PATH} transform="translate(18.7 47) scale(0.0429 -0.0429)" className="fill-ink-fg" />
      <circle cx="47" cy="17" r="4.6" fill="#ff5a36" />
    </svg>
  );
}

/** So'z belgisi: «kasb egalari» — Space Grotesk 700, kichik harf, «i» nuqtasi marjon doira */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("whitespace-nowrap font-brand font-bold leading-none tracking-[-0.045em] text-fg", className)}>
      kasb egalar
      <span className="relative">
        ı
        <span aria-hidden className="absolute left-1/2 top-[0.06em] h-[0.24em] w-[0.24em] -translate-x-1/2 rounded-full bg-accent" />
      </span>
    </span>
  );
}

/** Logotip: belgi + so'z (compact — faqat belgi). aria-label joriy tilda; hover'da harakat yo'q (tinch) */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  const til = useLocale();
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5", className)} aria-label={tr(til, SHELL.common.logoAria)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center">
        <LogoMark size={36} />
      </span>
      {!compact && <Wordmark className="text-[19px]" />}
    </Link>
  );
}

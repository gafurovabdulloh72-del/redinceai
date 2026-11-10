"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { usePresence } from "@/components/motion/usePresence";
import { cn } from "@/lib/utils";
import { BANNER_COOKIE, BANNER_STORAGE_KEY } from "./banner-keys";

/**
 * E'lon chizig'ini yopish («×»). Yopilgan versiya `localStorage`da eslab qolinadi — admin e'lonni o'zgartirsa
 * (yangi `version`) chiziq yana ko'rinadi. Qo'shimcha cookie nusxasi: keyingi to'liq yuklanishda server chiziqni
 * umuman chizmaydi (yopilgan e'lon bir zum miltillab ko'rinmaydi).
 *
 * Gidratsiya: birinchi render serverniki bilan bir xil (ochiq) — saqlangan holat faqat effektda o'qiladi
 * (server chizgan DOM gidratsiyadan oldin o'zgartirilmaydi). Yopilish: balandlik silliq yig'iladi (grid-rows 1fr → 0fr,
 * aniq xususiyatlar bo'yicha transition; reduced-motion'da global qoida uni o'chiradi), so'ng DOM'dan olinadi.
 */
export function SiteBannerFrame({ version, dismissLabel, className, children }: { version: number; dismissLabel: string; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const { mounted } = usePresence(open, 280);

  useEffect(() => {
    try {
      if (localStorage.getItem(BANNER_STORAGE_KEY) === String(version)) setOpen(false);
    } catch {
      /* localStorage yopiq (maxfiy rejim) — e'lon ko'rinib turaveradi */
    }
  }, [version]);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(BANNER_STORAGE_KEY, String(version));
    } catch {
      /* eslab qolinmaydi — shu sahifada baribir yopiladi */
    }
    // 180 kun; qiymat — faqat versiya raqami (shaxsiy ma'lumot emas)
    document.cookie = `${BANNER_COOKIE}=${version}; path=/; max-age=${180 * 24 * 60 * 60}; samesite=lax`;
  };

  if (!mounted) return null;
  return (
    <div className={cn("grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out", open ? "grid-rows-[1fr]" : "!my-0 grid-rows-[0fr] opacity-0", className)} data-print-hide>
      <div className="relative min-h-0 overflow-hidden">
        {children}
        {/* md+: o'ng tepada til/tema kapsulasi (fixed) turadi — tugma undan chapda */}
        <button type="button" onClick={dismiss} aria-label={dismissLabel} title={dismissLabel} className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-fg-2 transition-colors hover:bg-fg/8 hover:text-fg md:right-28">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

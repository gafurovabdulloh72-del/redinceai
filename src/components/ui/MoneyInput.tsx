"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** "1500000" → "1 500 000": faqat raqamlar, uch xonali guruhlar (tushunarli o'qilishi uchun) */
export const groupDigits = (v: string): string => v.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Guruhlangan summani songa aylantiradi (probellar olib tashlanadi); bo'sh bo'lsa 0 */
export const parseMoney = (v: string): number => Number(v.replace(/\s/g, "")) || 0;

/**
 * Pul kiritish maydoni: yozayotganda avtomatik "100 000 000" ko'rinishiga keladi, o'ngda valyuta belgisi.
 * Qiymat — guruhlangan matn (probelli); songa aylantirish uchun parseMoney().
 */
export function MoneyInput({
  value,
  onChange,
  suffix = "so'm",
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & { value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <div className="relative">
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(groupDigits(e.target.value))}
        className={cn("field pr-16 tabular-nums", className)}
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[13px] font-medium text-fg-3">{suffix}</span>
    </div>
  );
}

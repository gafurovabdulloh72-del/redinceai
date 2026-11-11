"use client";

import { timeAgo } from "@/lib/utils";

/**
 * «5 daqiqa oldin» — gidratsiyaga chidamli (2026-11-11). `timeAgo` `Date.now()` dan hisoblaydi: server chizgan
 * paytdan brauzer jonlantirgan paytgacha daqiqa chegarasi o'tsa matn farq qiladi va React #418 beradi (sekin
 * telefonlarda — admin panelida ko'p sanali ro'yxatlar bilan — tez-tez). `suppressHydrationWarning` faqat shu
 * tegning o'z matnidagi farqni yutadi. Klient komponentda relativ vaqtni FAQAT shu orqali chizing.
 */
export function Ago({ at, className }: { at: Date | number | string; className?: string }) {
  const ms = at instanceof Date ? at.getTime() : typeof at === "number" ? at : Date.parse(at);
  return (
    <time dateTime={Number.isFinite(ms) ? new Date(ms).toISOString() : undefined} className={className} suppressHydrationWarning>
      {timeAgo(at)}
    </time>
  );
}

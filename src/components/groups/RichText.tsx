import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Matn ichidagi #teg, @foydalanuvchi va http(s) havolalarni bosiladigan qiladi (lenta, izohlar, chat).
 * - @eslatma faqat so'z boshida (oldida harf/raqam yo'q) — `ism@domen.uz` ichidagi @domen eslatma emas
 * - #teg lentaning teg filtriga olib boradi (/?tag=), oldida harf/raqam bo'lsa teg emas (C#, №1#2)
 * - havola oxiridagi tinish belgilari (.,;:!?) va yopuvchi qavslar/qo'shtirnoq havolaga kirmaydi
 * Rang: havola — accent (semantik), teg/eslatma — matn rangi, qalin (aksent faqat havola/faol holat uchun).
 */
const TOKEN = /((?<![\p{L}\p{N}_#])#[\p{L}\p{N}_]{2,40}|(?<![\p{L}\p{N}_@.])@[a-z0-9_.-]{3,32}(?![\p{L}\p{N}_.-])|https?:\/\/[^\s<]+)/giu;
const URL_TAIL = /[.,;:!?»”"')\]]+$/;
const URL_SHOW = 60;

export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(TOKEN);
  const out: ReactNode[] = [];
  parts.forEach((part, i) => {
    if (!part) return;
    if (i % 2 === 0) {
      out.push(part);
      return;
    }
    if (part.startsWith("#")) {
      out.push(
        <Link key={i} href={`/?tag=${encodeURIComponent(part.slice(1).toLowerCase())}`} className="font-semibold text-fg underline-offset-2 hover:underline">
          {part}
        </Link>,
      );
    } else if (part.startsWith("@")) {
      out.push(
        <Link key={i} href={`/yozish/${encodeURIComponent(part.slice(1))}`} className="font-semibold text-fg underline-offset-2 hover:underline">
          {part}
        </Link>,
      );
    } else {
      // Qavs ichidagi havola: ochuvchi qavs matnda bo'lsa yopuvchi qavs havolaning qismi bo'lishi mumkin (vikipediya) — balans tekshiruvi
      let trimmed = part.replace(URL_TAIL, "");
      const opens = (trimmed.match(/\(/g) ?? []).length;
      const closes = (trimmed.match(/\)/g) ?? []).length;
      if (part.length > trimmed.length && part[trimmed.length] === ")" && opens > closes) trimmed = part.slice(0, trimmed.length + 1);
      const tail = part.slice(trimmed.length);
      const shown = trimmed.replace(/^https?:\/\//, "").replace(/\/$/, "");
      out.push(
        <a key={i} href={trimmed} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-accent-text underline underline-offset-2" title={trimmed}>
          {shown.length > URL_SHOW ? `${shown.slice(0, URL_SHOW)}…` : shown}
        </a>,
        tail,
      );
    }
  });
  return <span className={className}>{out}</span>;
}

/** Matndagi birinchi http(s) havola (havola kartasi uchun); yo'q bo'lsa null */
export function firstUrl(text: string): string | null {
  const m = /https?:\/\/[^\s<]+/i.exec(text);
  if (!m) return null;
  return m[0].replace(URL_TAIL, "");
}

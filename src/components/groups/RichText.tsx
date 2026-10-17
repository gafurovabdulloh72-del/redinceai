import Link from "next/link";
import type { ReactNode } from "react";

/** Matn ichidagi #teg, @foydalanuvchi va https havolalarni bosiladigan qiladi (lenta, izohlar, chat) */
const TOKEN = /(#[\p{L}\p{N}_]{2,40}|@[a-z0-9_.-]{3,32}|https?:\/\/[^\s<]+)/giu;

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
        <Link key={i} href={`/jamoalar?q=${encodeURIComponent(part.slice(1))}`} className="font-semibold text-accent-text underline-offset-2 hover:underline">
          {part}
        </Link>,
      );
    } else if (part.startsWith("@")) {
      out.push(
        <Link key={i} href={`/yozish/${encodeURIComponent(part.slice(1))}`} className="font-semibold text-accent-text underline-offset-2 hover:underline">
          {part}
        </Link>,
      );
    } else {
      const trimmed = part.replace(/[.,;:!?)]+$/, "");
      const tail = part.slice(trimmed.length);
      out.push(
        <a key={i} href={trimmed} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-accent-text underline underline-offset-2">
          {trimmed.replace(/^https?:\/\//, "").slice(0, 60)}
          {trimmed.length > 68 ? "…" : ""}
        </a>,
        tail,
      );
    }
  });
  return <span className={className}>{out}</span>;
}

import type { ReactNode } from "react";

/** Apostrof variantlari va katta-kichik harf farqsiz solishtirish uchun oddiy normalizatsiya (uzunlik saqlanadi) */
const norm = (s: string) => s.toLowerCase().replace(/[’'ʻ`´‘]/g, "'");

/**
 * Qidiruv so'ziga mos bo'laklarni `<mark>` bilan ajratib ko'rsatadi (server va klientda ishlaydi, hook yo'q).
 * Bo'sh so'rovda matn o'zgarishsiz qaytadi. Faqat birinchi 8 ta moslik belgilanadi (uzun matnlarda og'irlashmasin).
 */
export function Highlight({ text, q, className }: { text: string; q: string; className?: string }): ReactNode {
  const needle = norm(q.trim());
  if (!needle || needle.length < 2) return className ? <span className={className}>{text}</span> : text;
  const hay = norm(text);
  const parts: ReactNode[] = [];
  let i = 0;
  let hits = 0;
  while (i < text.length && hits < 8) {
    const at = hay.indexOf(needle, i);
    if (at === -1) break;
    if (at > i) parts.push(text.slice(i, at));
    parts.push(
      <mark key={at} className="rounded-[3px] bg-accent-soft px-0.5 text-inherit">
        {text.slice(at, at + needle.length)}
      </mark>,
    );
    i = at + needle.length;
    hits++;
  }
  if (i < text.length) parts.push(text.slice(i));
  return className ? <span className={className}>{parts}</span> : <>{parts}</>;
}

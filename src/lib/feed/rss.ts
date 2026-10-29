import "server-only";
import { SITE_URL } from "@/lib/site-url";

/**
 * RSS 2.0 quruvchi — tashqi paketsiz (2026-10-29).
 * Nega kerak: ish qidiruvchilar va o'quvchilar yangi e'lonlarni kuzatish uchun
 * lenta o'quvchi (Feedly, Telegram RSS bot, Inoreader) ishlatadi; qidiruv tizimlari
 * ham lentani yangilik manbasi sifatida tezroq oladi. Sayt kundalik yangilanadi,
 * lekin obuna bo'ladigan yagona kanal Telegram edi.
 */
export interface FeedItem {
  /** Sayt ichidagi yo'l — `/vakansiyalar/<id>` */
  path: string;
  title: string;
  /** Oddiy matn (HTML emas) — quruvchi o'zi CDATA ichiga oladi */
  description: string;
  /** Millisekund */
  published: number;
  category?: string;
}

/** XML matn tugunlari uchun — `<`, `&`, `]]>` ni zararsizlantiradi */
function xmlText(s: string): string {
  return s.replace(/]]>/g, "]]&gt;").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function rfc822(ms: number): string {
  return new Date(ms).toUTCString();
}

export function buildRss(opts: { title: string; description: string; path: string; items: FeedItem[] }): string {
  const self = `${SITE_URL}${opts.path}`;
  const latest = opts.items[0]?.published ?? Date.now();
  const entries = opts.items
    .map((it) => {
      const url = `${SITE_URL}${it.path}`;
      return [
        "    <item>",
        `      <title>${xmlText(it.title)}</title>`,
        `      <link>${xmlText(url)}</link>`,
        `      <guid isPermaLink="true">${xmlText(url)}</guid>`,
        `      <pubDate>${rfc822(it.published)}</pubDate>`,
        it.category ? `      <category>${xmlText(it.category)}</category>` : "",
        `      <description>${xmlText(it.description)}</description>`,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${xmlText(opts.title)}</title>`,
    `    <link>${xmlText(SITE_URL)}</link>`,
    `    <description>${xmlText(opts.description)}</description>`,
    "    <language>uz</language>",
    `    <lastBuildDate>${rfc822(latest)}</lastBuildDate>`,
    `    <atom:link href="${xmlText(self)}" rel="self" type="application/rss+xml"/>`,
    entries,
    "  </channel>",
    "</rss>",
  ].join("\n");
}

/** Lenta javobi: 1 soat keshlanadi (CDN ham, o'quvchi ham) */
export function rssResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

/**
 * Ochiq Telegram kanalining veb-ko'rinishi (`https://t.me/s/<username>`) — sof tahlilchi (tarmoqsiz, testlanadi).
 * Sahifada oxirgi ~20 post bo'ladi: har biri `data-post="<kanal>/<raqam>"` blokida, matni `tgme_widget_message_text` ichida.
 * Matn O'ZGARTIRILMAYDI: `<br>` → yangi qator, havolalar saqlanadi (matni manzildan farq qilsa — «matn (manzil)»),
 * HTML belgilari ochiladi. Telegram sahifa tuzilishini o'zgartirsa — shu fayl tuzatiladi.
 */

export const CHANNEL_USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{3,31}$/;

export interface ChannelPost {
  id: number;
  text: string;
  /** ISO vaqt (bo'lmasa null) */
  date: string | null;
  url: string;
  /** Rasm/video bormi (faqat ma'lumot uchun) */
  hasMedia: boolean;
}

export interface ChannelPage {
  username: string;
  title: string;
  posts: ChannelPost[];
}

/** «@kanal», «t.me/kanal», «https://t.me/s/kanal/123» → «kanal» (yaroqsiz — null) */
export function normalizeChannel(input: string): string | null {
  let s = input.trim();
  s = s.replace(/^https?:\/\//i, "").replace(/^(www\.)?(t|telegram)\.me\//i, "").replace(/^s\//i, "").replace(/^@/, "");
  s = s.split(/[/?#\s]/)[0] ?? "";
  if (!CHANNEL_USERNAME_RE.test(s)) return null;
  // Taklif havolalari (+kod / joinchat) — yopiq kanal, veb-ko'rinishi yo'q
  if (/^joinchat$/i.test(s)) return null;
  return s.toLowerCase();
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k.startsWith("#x")) return safeChar(parseInt(k.slice(2), 16), m);
    if (k.startsWith("#")) return ENTITIES[k] ?? safeChar(parseInt(k.slice(1), 10), m);
    return ENTITIES[k] ?? m;
  });
}
function safeChar(code: number, fallback: string): string {
  return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : fallback;
}

/** Xabar matni HTML'i → oddiy matn (havolalar saqlanadi) */
export function htmlToText(html: string): string {
  let s = html;
  s = s.replace(/<br\s*\/?>/gi, "\n");
  // Havola: matni manzilning o'zi yoki @username/#teg bo'lsa — faqat matn; aks holda «matn (manzil)»
  s = s.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, inner: string) => {
    const text = decodeEntities(inner.replace(/<[^>]+>/g, "")).trim();
    const url = decodeEntities(href).trim();
    if (!text) return url;
    if (!/^https?:\/\//i.test(url) || /^[@#]/.test(text)) return text;
    const bare = (x: string) => x.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "").toLowerCase();
    if (bare(text) === bare(url) || bare(url).startsWith(bare(text).replace(/…$/, ""))) return url;
    return `${text} (${url})`;
  });
  // Emoji rasmlari: <i class="emoji" ...><b>🔥</b></i> — ichidagi belgi qoladi
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  return s
    .replace(/\r/g, "")
    .replace(/[ \t ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** `<div class="…tgme_widget_message_text…">` dan mos `</div>` gacha (ichki div'lar sanaladi) */
function extractMessageTextHtml(chunk: string): string | null {
  const m = /<div class="[^"]*\btgme_widget_message_text\b[^"]*"[^>]*>/.exec(chunk);
  if (!m) return null;
  let i = m.index + m[0].length;
  const start = i;
  let depth = 1;
  const re = /<(\/?)div\b[^>]*>/gi;
  re.lastIndex = i;
  let t: RegExpExecArray | null;
  while ((t = re.exec(chunk))) {
    depth += t[1] ? -1 : 1;
    if (depth === 0) return chunk.slice(start, t.index);
    i = re.lastIndex;
  }
  return chunk.slice(start);
}

export function parseChannelPage(html: string, username: string): ChannelPage {
  const title =
    decodeEntities(/<meta property="og:title" content="([^"]*)"/.exec(html)?.[1] ?? "").trim() ||
    decodeEntities((/<div class="tgme_channel_info_header_title"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "").replace(/<[^>]+>/g, "")).trim() ||
    username;
  const posts: ChannelPost[] = [];
  const parts = html.split(/(?=<div class="tgme_widget_message_wrap)/);
  for (const part of parts) {
    const post = /data-post="([^"/]+)\/(\d+)"/.exec(part);
    if (!post) continue;
    const id = Number(post[2]);
    if (!Number.isSafeInteger(id) || id <= 0) continue;
    // Xizmat xabarlari (kanal nomi o'zgardi va h.k.) — matn yo'q
    if (/\bservice_message\b/.test(part)) continue;
    const inner = extractMessageTextHtml(part);
    const text = inner ? htmlToText(inner) : "";
    if (!text) continue;
    const date = /<time[^>]*datetime="([^"]+)"/.exec(part)?.[1] ?? null;
    posts.push({
      id,
      text,
      date,
      url: `https://t.me/${post[1]}/${id}`,
      hasMedia: /tgme_widget_message_(photo|video|document|roundvideo)/.test(part),
    });
  }
  // Takrorlarni olib tashlash va eskisidan yangisiga tartiblash
  const uniq = new Map(posts.map((p) => [p.id, p]));
  return { username, title, posts: [...uniq.values()].sort((a, b) => a.id - b.id) };
}

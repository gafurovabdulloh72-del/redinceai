import "server-only";
import { safeFetchText } from "@/lib/security/safe-fetch";
import type { LinkPreviewView } from "./constants";

/**
 * Havola prevyusi (Open Graph) — xabar matnidagi birinchi https havola uchun.
 * Xavfsizlik (SSRF): tarmoq so'rovi `safeFetchText` orqali — faqat https, 443-port, foydalanuvchi ma'lumotisiz URL;
 * IP ULANISH PAYTIDA tekshiriladi (DNS rebinding ham ishlamaydi), redirect qo'lda (3 tagacha, har qadamda tekshiruv);
 * 4 soniya timeout, 256 KB gacha o'qiladi, faqat text/html. Natija (null bo'lsa ham) 1 soat keshlanadi.
 */

const TIMEOUT_MS = 4000;
const MAX_BYTES = 256 * 1024;
const CACHE_TTL = 60 * 60 * 1000;
const CACHE_MAX = 500;

const cache = new Map<string, { at: number; v: LinkPreviewView | null }>();

/** Matndagi birinchi http(s) havola (oxiridagi tinish belgilari olib tashlanadi) */
export function firstUrl(text: string): string | null {
  const m = /https?:\/\/[^\s<>"'()]+/i.exec(text);
  if (!m) return null;
  return m[0].replace(/[.,;:!?…]+$/, "");
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
function decode(s: string): string {
  return s
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      const k = e.toLowerCase();
      if (k.startsWith("#x")) return String.fromCodePoint(parseInt(k.slice(2), 16)) || m;
      if (k.startsWith("#")) return String.fromCodePoint(parseInt(k.slice(1), 10)) || m;
      return ENT[k] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key.replace(/[:.]/g, "\\$&")}["'][^>]*>`, "i");
    const tag = re.exec(html)?.[0];
    const content = tag && /content=["']([^"']*)["']/i.exec(tag)?.[1];
    if (content) return decode(content);
    // content oldin kelgan variant: <meta content="…" property="og:title">
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key.replace(/[:.]/g, "\\$&")}["']`, "i");
    const c2 = re2.exec(html)?.[1];
    if (c2) return decode(c2);
  }
  return null;
}

/** Prevyu olish (xato/taqiq — null). Natija keshlanadi. */
export async function fetchLinkPreview(raw: string): Promise<LinkPreviewView | null> {
  const key = raw.slice(0, 500);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.v;
  const v = await fetchUncached(raw).catch(() => null);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), v });
  return v;
}

async function fetchUncached(raw: string): Promise<LinkPreviewView | null> {
  const res = await safeFetchText(raw, { timeoutMs: TIMEOUT_MS, maxBytes: MAX_BYTES, maxHops: 3, stopAt: /<\/head>/i });
  if (!res || res.status < 200 || res.status >= 300) return null;
  if (!/text\/html|application\/xhtml/i.test(res.contentType)) return null;
  const u = res.url;
  const html = res.body;
  const title = meta(html, ["og:title", "twitter:title"]) ?? decode(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? "");
  if (!title) return null;
  const description = meta(html, ["og:description", "twitter:description", "description"]);
  let image: string | null = null;
  const img = meta(html, ["og:image", "og:image:secure_url", "twitter:image"]);
  if (img) {
    try {
      const iu = new URL(img, u);
      if (iu.protocol === "https:") image = iu.toString().slice(0, 500);
    } catch {
      image = null;
    }
  }
  const site = meta(html, ["og:site_name"]) ?? u.hostname.replace(/^www\./, "");
  return { url: u.toString().slice(0, 500), title: title.slice(0, 140), description: description ? description.slice(0, 220) : null, image, site: site.slice(0, 60) };
}

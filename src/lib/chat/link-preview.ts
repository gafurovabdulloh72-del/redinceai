import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { LinkPreviewView } from "./constants";

/**
 * Havola prevyusi (Open Graph) — xabar matnidagi birinchi https havola uchun.
 * Xavfsizlik (SSRF): faqat https, 443-port, foydalanuvchi ma'lumotisiz URL; host DNS orqali
 * aniqlanib, xususiy/loopback/link-local manzillar rad etiladi; redirect qo'lda (2 tagacha, har qadamda tekshiruv);
 * 4 soniya timeout, 256 KB gacha o'qiladi, faqat text/html. Natija (null bo'lsa ham) 1 soat keshlanadi.
 */

const TIMEOUT_MS = 4000;
const MAX_BYTES = 256 * 1024;
const CACHE_TTL = 60 * 60 * 1000;
const CACHE_MAX = 500;
const UA = "Mozilla/5.0 (compatible; KasbEgalariBot/1.0; +https://kasbegalari.vercel.app)";

const cache = new Map<string, { at: number; v: LinkPreviewView | null }>();

/** Matndagi birinchi http(s) havola (oxiridagi tinish belgilari olib tashlanadi) */
export function firstUrl(text: string): string | null {
  const m = /https?:\/\/[^\s<>"'()]+/i.exec(text);
  if (!m) return null;
  return m[0].replace(/[.,;:!?…]+$/, "");
}

function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a >= 224;
  }
  if (v === 6) {
    const low = ip.toLowerCase();
    if (low === "::1" || low === "::") return true;
    if (low.startsWith("fc") || low.startsWith("fd") || low.startsWith("fe8") || low.startsWith("fe9") || low.startsWith("fea") || low.startsWith("feb")) return true;
    const m4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(low);
    if (m4) return isPrivateIp(m4[1]);
  }
  return false;
}

/** URL'ni tekshirish: https, standart port, user-info yo'q, host xususiy emas */
async function safeUrl(raw: string): Promise<URL | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password) return null;
  if (u.port && u.port !== "443") return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) return null;
  if (isIP(host)) return isPrivateIp(host) ? null : u;
  try {
    const addrs = await lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) return null;
  } catch {
    return null;
  }
  return u;
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

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { value, done } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.byteLength;
  }
  void reader.cancel().catch(() => undefined);
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

async function fetchOnce(u: URL, signal: AbortSignal): Promise<Response> {
  return fetch(u, { signal, redirect: "manual", headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1", "accept-language": "uz,ru;q=0.8,en;q=0.5" } });
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
  let u = await safeUrl(raw);
  if (!u) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    let res: Response | null = null;
    for (let hop = 0; hop < 3; hop++) {
      res = await fetchOnce(u, ctl.signal);
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        const next = await safeUrl(new URL(loc, u).toString());
        if (!next) return null;
        u = next;
        continue;
      }
      break;
    }
    if (!res || !res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(ct)) return null;
    const html = await readLimited(res);
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
  } finally {
    clearTimeout(timer);
  }
}

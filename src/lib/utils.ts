/** Tailwind klasslarini qo'shish uchun engil yordamchi (clsx o'rnini bosadi) */
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/*
 * Sana/son formatlash ATAYLAB Intl'siz qilingan: server (Node ICU) va brauzer
 * (Chromium ICU) "uz-UZ" lokalini turlicha chiqaradi, bu esa hydration
 * xatolariga olib keladi. Shuning uchun format deterministik va qo'lda.
 */
const NBSP = " ";

/** 3500000 -> "3 500 000" (bo'linmas probel bilan) */
export function formatNumber(n: number) {
  if (!Number.isFinite(n)) return "0";
  const sign = n < 0 ? "-" : "";
  const [int, frac] = Math.abs(n).toFixed(frac0(n)).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return sign + grouped + (frac ? `,${frac}` : "");
}
function frac0(n: number) {
  return Number.isInteger(n) ? 0 : Math.min(2, (n.toString().split(".")[1] ?? "").length);
}

export function formatPrice(amount: number | null | undefined, opts: { compact?: boolean } = {}) {
  if (amount == null) return "—";
  if (opts.compact) {
    const k = Math.round(amount / 1_000);
    if (k >= 1_000) {
      // Kasr ajratuvchi — vergul (formatNumber bilan bir xil): "1,5 mln so'm"; 999 500+ ham "1 mln" ("1000 ming" emas)
      const m = Math.round(amount / 100_000) / 10;
      return `${String(m).replace(".", ",")} mln so'm`;
    }
    if (amount >= 1_000) return `${k} ming so'm`;
  }
  return `${formatNumber(amount)} so'm`;
}

/**
 * Taxminiy dollar ekvivalenti (F99): "≈ $394". usdRate — 1 USD necha so'm (platforma sozlamasi usdRate).
 * 1 dollardan kam — "< $1"; summa yoki kurs noto'g'ri bo'lsa — bo'sh satr (UI ko'rsatmaydi).
 */
export function formatUsd(amount: number | null | undefined, usdRate: number | null | undefined): string {
  if (!amount || amount <= 0 || !usdRate || usdRate <= 0 || !Number.isFinite(amount / usdRate)) return "";
  const usd = amount / usdRate;
  if (usd < 1) return "< $1";
  // 1 000 dan katta summalar o'nlikka yaxlitlanadi — "taxminiy" ekanini ta'kidlaydi
  const rounded = usd >= 1_000 ? Math.round(usd / 10) * 10 : Math.round(usd);
  return `≈ $${formatNumber(rounded)}`;
}

export function formatPriceRange(from: number, to?: number | null) {
  if (!from && !to) return "Kelishiladi";
  if (!from && to) return `${formatPrice(to, { compact: true })} gacha`;
  if (to && to > from) return `${formatPrice(from, { compact: true })} – ${formatPrice(to, { compact: true })}`;
  return `${formatPrice(from, { compact: true })} dan`;
}

const TRANSLIT: Record<string, string> = {
  "o'": "o", "g'": "g", "oʻ": "o", "gʻ": "g", "o‘": "o", "g‘": "g", "ʼ": "", "'": "", "’": "",
  sh: "sh", ch: "ch", ng: "ng",
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh",
  ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

export function slugify(input: string) {
  let s = input.toLowerCase().trim();
  for (const [from, to] of Object.entries(TRANSLIT)) s = s.split(from).join(to);
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Apostrof variantlari (o' / oʻ / o‘ / o’ / oʼ) — qidiruvda e'tiborsiz */
const APOSTROPHES_RE = /[ʼ'’‘ʻ`´]/g;

/**
 * Qidiruv uchun normalizatsiya: kirill → lotin (TRANSLIT jadvali), kichik harf, apostroflar olib tashlanadi,
 * bo'shliqlar bittaga keltiriladi. "Фарғона" → "fargona", "Farg'ona" → "fargona", "Qo‘qon" → "qoqon".
 * Bazadagi ustun ham shu tarzda (apostrofsiz, kichik harf) solishtiriladi — ikkala yozuv ham topiladi.
 */
export function translit(input: string): string {
  let s = input.toLowerCase().trim();
  for (const [from, to] of Object.entries(TRANSLIT)) s = s.split(from).join(to);
  return s.replace(APOSTROPHES_RE, "").replace(/\s+/g, " ").trim();
}

/** Faqat apostroflarni olib tashlash (lotin matn uchun; translit'siz) */
export function stripApostrophes(input: string): string {
  return input.replace(APOSTROPHES_RE, "");
}

/** O'zbekiston raqamini kanonik "+998XXXXXXXXX" ko'rinishiga keltiradi; boshqa yoki noto'g'ri raqam — null */
export function normalizeUzPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 12 && digits.startsWith("998")) return `+${digits}`;
  return null;
}

/** "+998901234567" → "+998 90 123 45 67"; O'zbekiston raqami bo'lmasa — kiritilganicha */
export function formatUzPhone(raw: string): string {
  const n = normalizeUzPhone(raw);
  if (!n) return raw;
  return `${n.slice(0, 4)} ${n.slice(4, 6)} ${n.slice(6, 9)} ${n.slice(9, 11)} ${n.slice(11)}`;
}

/** Qisqa nomlar (A21/F9): boshqa modullar `normalizePhone` / `formatPhone` deb chaqiradi */
export const normalizePhone = normalizeUzPhone;
export const formatPhone = formatUzPhone;

/** Sana oxirgi `days` kun ichidami ("Yangi" belgisi uchun) */
export function isRecent(date: Date | number | string, days = 7) {
  const ms = toMs(date);
  return Number.isFinite(ms) && Date.now() - ms < days * 24 * 60 * 60 * 1000;
}

export type ActivityBucket = "today" | "week" | "month";
export const ACTIVITY_LABEL: Record<ActivityBucket, string> = { today: "bugun", week: "shu hafta", month: "shu oy" };

/** "Oxirgi faollik" chelagi (F68): bugun / shu hafta (7 kun) / shu oy (30 kun); eskiroq yoki noma'lum — null */
export function activityBucket(date: Date | number | string | null | undefined, now = Date.now()): ActivityBucket | null {
  if (date == null) return null;
  const ms = toMs(date);
  if (!Number.isFinite(ms)) return null;
  const diff = now - ms;
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return "today";
  if (diff < 7 * day) return "week";
  if (diff < 30 * day) return "month";
  return null;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function toMs(date: Date | number | string) {
  return typeof date === "object" ? date.getTime() : new Date(date).getTime();
}

/**
 * Nisbiy vaqt ("5 daqiqa oldin"). Date.now() ga bog'liq, shuning uchun
 * klient komponentlarda uni ko'rsatuvchi elementga suppressHydrationWarning qo'ying.
 */
export function timeAgo(date: Date | number | string) {
  const diff = Math.max(0, Date.now() - toMs(date));
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "hozirgina";
  if (m < 60) return `${m} daqiqa oldin`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} soat oldin`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} kun oldin`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} oy oldin`;
  return `${Math.floor(months / 12)} yil oldin`;
}

const MONTHS_UZ = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
/** O'zbekiston vaqti: UTC+5, yozgi vaqt yo'q — server va brauzerda bir xil natija */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

function tashkentParts(date: Date | number | string) {
  const ms = toMs(date);
  if (!Number.isFinite(ms)) return null;
  const t = new Date(ms + TASHKENT_OFFSET_MS);
  return { y: t.getUTCFullYear(), mo: t.getUTCMonth(), d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes() };
}

/** Toshkent vaqti bo'yicha joriy soat (0–23) — server UTC bo'lsa ham to'g'ri */
export function tashkentHour(now = Date.now()) {
  return new Date(now + TASHKENT_OFFSET_MS).getUTCHours();
}

/** Kun vaqtiga qarab salomlashuv (Toshkent vaqti) */
export function greetingFor(hour = tashkentHour()) {
  if (hour < 6) return "Xayrli tun";
  if (hour < 12) return "Xayrli tong";
  if (hour < 18) return "Xayrli kun";
  return "Xayrli kech";
}

/** Ichki yo'l tekshiruvi: faqat "/..." bilan boshlanadigan, boshqa domenga olib ketmaydigan manzil */
export function safeInternalPath(next: string | null | undefined, origin = "http://local.invalid"): string | undefined {
  if (!next || typeof next !== "string") return undefined;
  if (!next.startsWith("/") || /[\\\u0000-\u001f]/.test(next)) return undefined;
  try {
    const u = new URL(next, origin);
    if (u.origin !== origin) return undefined;
    return u.pathname + u.search + u.hash;
  } catch {
    return undefined;
  }
}

/** LIKE uchun % va _ belgilarini ekranlash (escape '\\' bilan ishlatiladi) */
export function escapeLike(term: string) {
  return term.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** "10-oktabr, 2026" */
export function formatDate(date: Date | number | string) {
  const p = tashkentParts(date);
  if (!p) return "—";
  return `${p.d}-${MONTHS_UZ[p.mo]}, ${p.y}`;
}

/** "10.10.2026, 13:34" (Toshkent vaqti) */
export function formatDateTime(date: Date | number | string) {
  const p = tashkentParts(date);
  if (!p) return "—";
  return `${pad(p.d)}.${pad(p.mo + 1)}.${p.y}, ${pad(p.h)}:${pad(p.mi)}`;
}

/** YouTube havolasidan video ID ajratib olish */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(embed|shorts|v)\/([\w-]+)/);
      if (m) return m[2];
    }
  } catch {
    /* noop */
  }
  return null;
}

/** Vimeo havolasidan video ID (vimeo.com/123456, player.vimeo.com/video/123456) */
export function vimeoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)vimeo\.com$/.test(u.hostname)) return null;
    const m = u.pathname.match(/(?:^|\/)(?:video\/)?(\d{6,12})(?:\/|$)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Deterministik rang (avatar fonlari uchun) */
export function hashHue(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function uid() {
  return crypto.randomUUID();
}

/** Ixcham son: 999 → "999", 1 234 → "1,2K", 15 600 → "16K", 2 300 000 → "2,3M" (ko'rishlar, obunachilar) */
export function compactCount(n: number): string {
  if (!Number.isFinite(n) || n < 1000) return String(Math.max(0, Math.round(n || 0)));
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(".", ",").replace(",0", "")}K`;
  // 999 500+ → "1M" ("1000K" emas)
  if (n < 999_500) return `${Math.round(n / 1000)}K`;
  return `${(n / 1_000_000).toFixed(1).replace(".", ",").replace(",0", "")}M`;
}

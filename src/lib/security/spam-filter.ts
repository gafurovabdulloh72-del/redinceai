import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { platformSettings } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { translit } from "@/lib/utils";

/**
 * Spam filtri — admin paneldan boshqariladigan taqiqlangan so'zlar va havola siyosati.
 * Sozlama platform_settings jadvalida bitta JSON kalit ostida (`spamFilter`), raqamli sozlamalardan alohida.
 *
 * Foydalanish (post/izoh/chat/vakansiya validatorlarida):
 *   await assertNotSpam(body);            // mos kelsa ApiError(422) — foydalanuvchiga tushunarli sabab bilan
 *   const r = await checkSpam(body);      // throw qilmasdan natija
 *   checkSpamText(text, settings)         // sof funksiya (testlar uchun)
 *
 * Moslashtirish: so'zlar registrsiz, kirill/lotin translitdan o'tkazilib, so'z chegarasida solishtiriladi
 * ("reklama" → "reklamachi" ham tutiladi, lekin "sex" → "sexta" tutilmaydi: prefiks qoidasi faqat 4+ harfli so'zlarda).
 */

export const SPAM_FILTER_KEY = "spamFilter";

export interface SpamFilterSettings {
  /** Taqiqlangan so'z/iboralar (kichik harf, translit) */
  words: string[];
  /** true — ruxsat etilgan domenlardan tashqari barcha havolalar bloklanadi */
  blockLinks: boolean;
  /** Ruxsat etilgan domenlar (suffiks bo'yicha: "t.me" → "t.me/kanal", "sub.t.me") */
  allowDomains: string[];
}

export const SPAM_LIMITS = { maxWords: 200, maxWordLen: 40, maxDomains: 50, maxDomainLen: 80 } as const;

export const SPAM_FILTER_DEFAULTS: SpamFilterSettings = {
  words: [],
  blockLinks: false,
  allowDomains: ["kasbegalari.vercel.app", "t.me", "telegram.me", "youtube.com", "youtu.be", "instagram.com", "vimeo.com", "behance.net", "dribbble.com", "drive.google.com", "figma.com"],
};

const DOMAIN_RE = /^(?=.{1,80}$)([a-z0-9-]+\.)+[a-z]{2,}$/;

/** So'zni solishtirish shakliga keltirish: kichik harf, translit, apostrof/ortiqcha bo'shliqsiz */
const norm = (s: string) => translit(s).replace(/['’`ʻʼ]/g, "").replace(/\s+/g, " ").trim();

/** Har qanday kirishdan xavfsiz sozlama: noto'g'ri/ortiqcha elementlar tashlab yuboriladi, takrorlar yo'q */
export function normalizeSpamSettings(input: unknown): SpamFilterSettings {
  const o = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const words = Array.isArray(o.words) ? [...new Set(o.words.filter((w): w is string => typeof w === "string").map((w) => norm(w).slice(0, SPAM_LIMITS.maxWordLen)).filter((w) => w.length >= 2))].slice(0, SPAM_LIMITS.maxWords) : [];
  const allowDomains = Array.isArray(o.allowDomains)
    ? [...new Set(o.allowDomains.filter((d): d is string => typeof d === "string").map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "")).filter((d) => DOMAIN_RE.test(d)))].slice(0, SPAM_LIMITS.maxDomains)
    : [];
  return { words, blockLinks: Boolean(o.blockLinks), allowDomains };
}

/** Sozlamani o'qish (so'rov ichida keshlanadi); bazada yo'q bo'lsa — standart */
export const getSpamFilter = cache(async (): Promise<SpamFilterSettings> => {
  try {
    const row = await db.query.platformSettings.findFirst({ where: eq(platformSettings.key, SPAM_FILTER_KEY) });
    if (!row) return SPAM_FILTER_DEFAULTS;
    return normalizeSpamSettings(row.value);
  } catch (e) {
    console.error("[spam-filter] o'qib bo'lmadi, standart ishlatiladi", e);
    return SPAM_FILTER_DEFAULTS;
  }
});

/** Admin: sozlamani saqlash (upsert) */
export async function saveSpamFilter(input: unknown): Promise<SpamFilterSettings> {
  const value = normalizeSpamSettings(input);
  const now = new Date();
  await db
    .insert(platformSettings)
    .values({ key: SPAM_FILTER_KEY, value, updatedAt: now })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedAt: now } });
  return value;
}

export type SpamCheck = { ok: true } | { ok: false; reason: "word" | "link"; match: string };

/** Matndagi havolalar: http(s)://…, www.…, yoki yalang'och domen (t.me/kanal, misol.uz) */
const LINK_RE = /(?:https?:\/\/|www\.)[^\s<>"']+|\b(?:[a-z0-9-]+\.)+(?:com|uz|ru|me|net|org|io|link|site|online|shop|xyz|club|info|biz|tv|app|pro|cc|to|ly|gg)\b(?:\/[^\s<>"']*)?/gi;

function hostOf(raw: string): string {
  const s = raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  return s.split(/[/?#]/)[0]?.toLowerCase() ?? "";
}

function domainAllowed(host: string, allow: string[]): boolean {
  return allow.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Sof tekshiruv: taqiqlangan so'z (so'z chegarasi) yoki ruxsatsiz havola */
export function checkSpamText(text: string, s: SpamFilterSettings): SpamCheck {
  if (!text) return { ok: true };
  const hay = ` ${norm(text)} `;
  for (const w of s.words) {
    if (!w) continue;
    // 4+ harfli so'z uchun prefiks ham tutiladi ("reklama" → "reklamachi"); qisqa so'zlar faqat to'liq mos kelsa
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${w.length >= 4 ? "" : "(?=$|[^\\p{L}\\p{N}])"}`, "iu");
    if (re.test(hay)) return { ok: false, reason: "word", match: w };
  }
  if (s.blockLinks) {
    for (const m of text.match(LINK_RE) ?? []) {
      const host = hostOf(m);
      if (host && !domainAllowed(host, s.allowDomains)) return { ok: false, reason: "link", match: host };
    }
  }
  return { ok: true };
}

/** Sozlamani yuklab tekshiradi (throw qilmaydi) */
export async function checkSpam(text: string): Promise<SpamCheck> {
  return checkSpamText(text, await getSpamFilter());
}

/** Validatorlar uchun: mos kelsa 422 — sabab foydalanuvchiga tushunarli, ichki ro'yxat oshkor qilinmaydi */
export async function assertNotSpam(text: string, field = "body"): Promise<void> {
  const r = await checkSpam(text);
  if (r.ok) return;
  const msg = r.reason === "link" ? `Bu havolaga ruxsat berilmagan (${r.match}). Faqat sayt ichidagi yoki ruxsat etilgan manbalar.` : "Matnda taqiqlangan so'z bor — iltimos, tahrirlang.";
  throw new ApiError(422, msg, { [field]: msg });
}

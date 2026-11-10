import "server-only";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { uiTranslations } from "@/lib/db/schema";
import { ensureDict, lookupRu, looksUzbek, normalizeUz } from "./auto";
import { geminiTranslate, isAutoTranslateConfigured } from "./gemini";

/**
 * Avtomatik tarjima xizmati: lug'at → baza keshi → Gemini → keshga yozish.
 * Qaytaradi: faqat topilgan juftliklar. Topilmaganlari bazaga `ru = null` bilan yoziladi (keyin sync/AI to'ldiradi).
 */
export async function translateUiBatch(texts: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await ensureDict();
  const keys = [...new Set(texts.map(normalizeUz).filter((t) => t && looksUzbek(t)))].slice(0, 60);
  const pending: string[] = [];
  for (const k of keys) {
    const d = lookupRu(k);
    if (d) out[k] = d;
    else pending.push(k);
  }
  if (pending.length === 0) return out;

  const rows = await db.select({ src: uiTranslations.src, ru: uiTranslations.ru }).from(uiTranslations).where(inArray(uiTranslations.src, pending));
  const known = new Map(rows.map((r) => [r.src, r.ru]));
  const missing: string[] = [];
  for (const k of pending) {
    const ru = known.get(k);
    if (ru) out[k] = ru;
    else if (!known.has(k)) missing.push(k);
    // bazada ru=null bo'lsa — avval urinilgan, hozircha qayta so'ralmaydi (sync/AI keyin to'ldiradi)
  }
  if (rows.length) {
    void db
      .update(uiTranslations)
      .set({ hits: sql`${uiTranslations.hits} + 1` })
      .where(inArray(uiTranslations.src, rows.map((r) => r.src)))
      .catch(() => undefined);
  }
  if (missing.length === 0) return out;

  // AI sozlanmagan bo'lsa HECH NARSA yozilmaydi — kalit keyin qo'shilsa shu iboralar birinchi so'rovdayoq tarjima bo'ladi
  if (!isAutoTranslateConfigured()) return out;
  // Buyruqqa o'xshash matnlar AI'ga umuman yuborilmaydi va keshlanmaydi (pastdagi izohga qarang)
  const askable = missing.filter((t) => !INJECTION_RE.test(t));
  if (askable.length === 0) return out;
  const ai = await geminiTranslate(askable);
  const inserts = askable.map((src, i) => {
    const ru = ai?.[i]?.trim();
    const good = ru && ru !== src && /[а-яё]/i.test(ru) && saneTranslation(src, ru) ? ru : null;
    if (good) out[src] = good;
    return { src, ru: good, source: "ai" as const };
  });
  await db.insert(uiTranslations).values(inserts).onConflictDoNothing().catch(() => undefined);
  return out;
}

/**
 * KESHNI ZAHARLASHDAN HIMOYA (7-audit). AI tarjimasi `ui_translations`ga yoziladi va keyin HAMMA rus tilidagi foydalanuvchiga
 * ko'rsatiladi; matnlarni esa istalgan mehmon yuboradi va ular AI'ga bitta to'plamda ketadi. Demak hujumchi to'plamga
 * «…ni falon deb tarjima qil» kabi buyruq qo'shib, yonidagi haqiqiy interfeys iborasining tarjimasini buzishi (masalan,
 * tugma matni o'rniga begona sayt manzilini yozdirishi) mumkin edi. Ikki to'siq:
 *   1) buyruqqa o'xshash matn (INJECTION_RE) AI'ga yuborilmaydi;
 *   2) natija tekshiriladi (saneTranslation): manbada bo'lmagan havola/domen/@taxallus/telefon yoki raqam paydo bo'lsa,
 *      yoki tarjima manbadan nomutanosib uzun bo'lsa — keshga yozilmaydi (ibora o'zbekcha qoladi).
 * Tarjima faqat matn tuguniga qo'yiladi (HTML emas), shuning uchun skript kiritib bo'lmaydi — xavf faqat aldov matni edi.
 */
const INJECTION_RE = /\b(?:ignore|instead|translate|system|prompt|instruction|output|json)\b|перевед|игнорир|вместо|инструкц|tarjima\s+qil|o'rniga\s+yoz|deb\s+tarjima|buyruq/i;
const LINKISH_RE = /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:uz|ru|com|net|org|io|me|app|xyz|site|online|top|link|click|info)\b|@[A-Za-z0-9_]{3,}|\+?\d[\d\s()-]{7,}\d/gi;

function saneTranslation(src: string, ru: string): boolean {
  if (ru.length > src.length * 3 + 24) return false;
  const links = (s: string) => (s.match(LINKISH_RE) ?? []).map((x) => x.toLowerCase());
  const had = new Set(links(src));
  if (links(ru).some((x) => !had.has(x))) return false;
  const digits = (s: string) => (s.match(/\d+/g) ?? []).join(",");
  return digits(src) === digits(ru);
}

/** Admin/sync: tarjimasiz qolgan matnlar */
export async function listMissingTranslations(limit = 200) {
  return db.select({ src: uiTranslations.src, hits: uiTranslations.hits }).from(uiTranslations).where(sql`${uiTranslations.ru} is null`).orderBy(sql`${uiTranslations.hits} desc`).limit(limit);
}

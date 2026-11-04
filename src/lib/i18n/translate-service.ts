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
  const ai = await geminiTranslate(missing);
  const inserts = missing.map((src, i) => {
    const ru = ai?.[i]?.trim();
    const good = ru && ru !== src && /[а-яё]/i.test(ru) ? ru : null;
    if (good) out[src] = good;
    return { src, ru: good, source: "ai" as const };
  });
  await db.insert(uiTranslations).values(inserts).onConflictDoNothing().catch(() => undefined);
  return out;
}

/** Admin/sync: tarjimasiz qolgan matnlar */
export async function listMissingTranslations(limit = 200) {
  return db.select({ src: uiTranslations.src, hits: uiTranslations.hits }).from(uiTranslations).where(sql`${uiTranslations.ru} is null`).orderBy(sql`${uiTranslations.hits} desc`).limit(limit);
}

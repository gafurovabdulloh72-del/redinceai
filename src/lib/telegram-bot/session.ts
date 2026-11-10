import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { botSessions } from "@/lib/db/schema";

/** Suhbat oqimi 45 daqiqa javobsiz qolsa unutiladi */
const TTL_MS = 45 * 60 * 1000;

/**
 * Oqim turlari: register (ro'yxatdan o'tish) · broadcast (/elon) · post (rasm/video → post/story) · adminprice (maxsus narx) ·
 * gate (majburiy obuna to'xtatgan `/start <payload>` — obunadan keyin qayta ijro etiladi) · support (qo'llab-quvvatlashga xabar) ·
 * dm (shaxsiy xabarga javob).
 */
export type BotFlow = "register" | "broadcast" | "post" | "adminprice" | "gate" | "support" | "dm";
export interface BotSession<T extends Record<string, unknown> = Record<string, unknown>> {
  flow: BotFlow;
  step: string;
  data: T;
}

/** Chatning faol oqimi (eskirgan bo'lsa o'chirib, null) */
export async function getBotSession<T extends Record<string, unknown> = Record<string, unknown>>(chatId: string): Promise<BotSession<T> | null> {
  const row = await db.query.botSessions.findFirst({ where: eq(botSessions.chatId, chatId) });
  if (!row) return null;
  if (row.updatedAt.getTime() < Date.now() - TTL_MS) {
    await db.delete(botSessions).where(eq(botSessions.chatId, chatId));
    return null;
  }
  return { flow: row.flow as BotFlow, step: row.step, data: (row.data ?? {}) as T };
}

/** Oqim holatini yozish (upsert) */
export async function setBotSession(chatId: string, flow: BotFlow, step: string, data: Record<string, unknown>): Promise<void> {
  await db
    .insert(botSessions)
    .values({ chatId, flow, step, data, updatedAt: new Date() })
    .onConflictDoUpdate({ target: botSessions.chatId, set: { flow, step, data, updatedAt: new Date() } });
}

export async function clearBotSession(chatId: string): Promise<void> {
  await db.delete(botSessions).where(eq(botSessions.chatId, chatId));
}

/**
 * Oqimni ATOMAR olib, o'chirish (compare-and-swap): qator faqat BITTA chaqiruvchiga qaytadi — tugma ikki marta bosilsa
 * yoki Telegram update'ni qayta yuborsa, ikkinchi chaqiruv `null` oladi va ishni takrorlamaydi (post ikki marta joylanmaydi,
 * e'lon ikki marta ketmaydi). `nonce` berilsa — faqat sessiyadagi `data.nonce` shunga teng bo'lsa (tugma aynan shu
 * qoralama/faylga tegishli ekanini kafolatlaydi).
 */
export async function takeBotSession<T extends Record<string, unknown> = Record<string, unknown>>(chatId: string, flow: BotFlow, nonce?: string): Promise<BotSession<T> | null> {
  const conds = [eq(botSessions.chatId, chatId), eq(botSessions.flow, flow)];
  if (nonce !== undefined) conds.push(sql`json_extract(${botSessions.data}, '$.nonce') = ${nonce}`);
  const [row] = await db
    .delete(botSessions)
    .where(and(...conds))
    .returning();
  if (!row || row.updatedAt.getTime() < Date.now() - TTL_MS) return null;
  return { flow, step: row.step, data: (row.data ?? {}) as T };
}

/** Tugmani qoralama/faylga bog'laydigan qisqa belgi (callback_data ichida; 6 ta hex belgi) */
export const newNonce = (): string => randomBytes(3).toString("hex");

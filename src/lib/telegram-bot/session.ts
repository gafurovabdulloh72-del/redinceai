import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { botSessions } from "@/lib/db/schema";

/** Suhbat oqimi 45 daqiqa javobsiz qolsa unutiladi */
const TTL_MS = 45 * 60 * 1000;

export type BotFlow = "register" | "broadcast" | "post";
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

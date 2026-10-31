import "server-only";
import { and, eq, gt, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, dmMessages, groupMembers, groupMessages } from "@/lib/db/schema";

/**
 * Real-time chat (SSE) uchun o'zgarish kuzatuvchisi. Tashqi pub/sub (Redis) yo'q — serverless'da har
 * ulanish o'z oqimida bazani ~1 s da bir tekshiradi va faqat O'ZGARISH bo'lsa hodisa yuboradi.
 * Mijoz uchun natija: xabar/tahrir/o'chirish/o'qildi/«yozmoqda» 1 s ichida keladi, 4 s polling o'rniga.
 *
 * Hodisalar:
 *   dm    {conv}  — shu suhbatda yangi/tahrirlangan/o'chirilgan xabar, o'qildi belgisi yoki «yozmoqda» holati o'zgardi
 *   group {}      — kuzatilayotgan jamoa chatida xabar/tahrir/o'chirish yoki «yozmoqda» o'zgardi
 */
export const TYPING_WINDOW_MS = 6000;

export interface StreamEvent {
  type: "dm" | "group";
  conv?: string;
}

export interface Watcher {
  /** `since` dan keyingi o'zgarishlar; `now` — shu tekshiruv vaqti (keyingi cursor) */
  check(since: number, now: number): Promise<StreamEvent[]>;
}

/** Vaqt tamg'asi tranzaksiya tugashidan OLDIN hisoblanadi — shu oynada yozilgan o'zgarish tick'dan keyin ko'rinishi mumkin, shuning uchun orqaga qarab tekshiramiz; takrorni `seen` versiyalari yutadi */
const OVERLAP_MS = 10_000;

export function createWatcher(meId: string, opts: { conv?: string | null; groupId?: string | null }): Watcher {
  let peerTyping = false;
  let groupTyping = 0;
  let groupVersion = 0;
  /** Suhbat → oxirgi ko'rilgan versiya (max vaqt tamg'asi) — faqat o'sganda hodisa */
  const seen = new Map<string, number>();
  const myConvs = or(eq(conversations.aId, meId), eq(conversations.bId, meId))!;
  const ts = (d: Date | null | undefined) => d?.getTime() ?? 0;

  return {
    async check(since, now) {
      const events: StreamEvent[] = [];
      const sinceD = new Date(since - OVERLAP_MS);
      const changed = new Map<string, number>();
      const bump = (conv: string, v: number) => changed.set(conv, Math.max(changed.get(conv) ?? 0, v));

      // 1) Suhbat darajasi: oxirgi xabar / o'qildi belgilari
      const convRows = await db
        .select({ id: conversations.id, m: conversations.lastMessageAt, a: conversations.aReadAt, b: conversations.bReadAt })
        .from(conversations)
        .where(and(myConvs, or(gt(conversations.lastMessageAt, sinceD), gt(conversations.aReadAt, sinceD), gt(conversations.bReadAt, sinceD))!))
        .limit(50);
      for (const r of convRows) bump(r.id, Math.max(ts(r.m), ts(r.a), ts(r.b)));

      // 2) Xabar darajasi: yangi / tahrir / o'chirish
      const mine = db.select({ id: conversations.id }).from(conversations).where(myConvs);
      const msgRows = await db
        .select({ conv: dmMessages.conversationId, c: dmMessages.createdAt, e: dmMessages.editedAt, d: dmMessages.deletedAt })
        .from(dmMessages)
        .where(and(inArray(dmMessages.conversationId, mine), or(gt(dmMessages.createdAt, sinceD), gt(dmMessages.editedAt, sinceD), gt(dmMessages.deletedAt, sinceD))!))
        .limit(100);
      for (const r of msgRows) bump(r.conv, Math.max(ts(r.c), ts(r.e), ts(r.d)));

      // 3) Faol suhbatda qarshi tomon «yozmoqda»: holat almashsa hodisa
      if (opts.conv) {
        const c = await db.query.conversations.findFirst({ where: and(eq(conversations.id, opts.conv), myConvs), columns: { aId: true, aTypingAt: true, bTypingAt: true } });
        if (c) {
          const typing = now - ts(c.aId === meId ? c.bTypingAt : c.aTypingAt) < TYPING_WINDOW_MS;
          if (typing !== peerTyping) {
            peerTyping = typing;
            bump(opts.conv, now);
          }
        }
      }
      for (const [conv, v] of changed) {
        if (v > (seen.get(conv) ?? 0)) {
          seen.set(conv, v);
          events.push({ type: "dm", conv });
        }
      }

      // 4) Jamoa chati: xabar/tahrir/o'chirish (versiya) + «yozmoqda» soni
      if (opts.groupId) {
        const [gm] = await db
          .select({ v: sql<number>`max(max(coalesce(${groupMessages.createdAt}, 0), coalesce(${groupMessages.editedAt}, 0), coalesce(${groupMessages.deletedAt}, 0)))` })
          .from(groupMessages)
          .where(and(eq(groupMessages.groupId, opts.groupId), or(gt(groupMessages.createdAt, sinceD), gt(groupMessages.editedAt, sinceD), gt(groupMessages.deletedAt, sinceD))!));
        const [gt_] = await db
          .select({ n: sql<number>`count(*)` })
          .from(groupMembers)
          .where(and(eq(groupMembers.groupId, opts.groupId), gt(groupMembers.typingAt, new Date(now - TYPING_WINDOW_MS)), sql`${groupMembers.userId} != ${meId}`));
        const v = Number(gm?.v ?? 0);
        const typingNow = Number(gt_?.n ?? 0);
        if (v > groupVersion || typingNow !== groupTyping) {
          groupVersion = Math.max(groupVersion, v);
          groupTyping = typingNow;
          events.push({ type: "group" });
        }
      }
      return events;
    },
  };
}

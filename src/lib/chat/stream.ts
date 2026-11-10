import "server-only";
import { and, eq, gt, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, dmMessages, groupMessages } from "@/lib/db/schema";

/**
 * Real-time chat (SSE) uchun o'zgarish kuzatuvchisi. Tashqi pub/sub (Redis) yo'q — serverless'da har
 * ulanish o'z oqimida bazani ~1 s da bir tekshiradi va faqat O'ZGARISH bo'lsa hodisa yuboradi.
 * Mijoz uchun natija: xabar/tahrir/o'chirish/o'qildi/«yozmoqda»/reaksiya/qadoq 1 s ichida keladi.
 *
 * Hodisalar (oqimda hech qanday matn yo'q — mijoz odatdagi API'dan qayta so'raydi):
 *   dm    {conv}  — shu suhbatda yangi/tahrirlangan/o'chirilgan xabar, QARSHI TOMON o'qidi; faol suhbatda yana:
 *                   «yozmoqda», reaksiya, qadoq, yo'qolish muddati, blok holati o'zgardi
 *   inbox {}      — chat RO'YXATI eskirdi: men a'zo guruh/kanalda faollik, a'zoligim o'zgardi, buyurtma chatida yangi
 *                   xabar yoki suhbatni boshqa qurilmamda o'qidim
 *   group {}      — kuzatilayotgan jamoa chatida xabar/tahrir/o'chirish, «yozmoqda», reaksiya, qadoq, o'qilganlik yoki mavzular o'zgardi
 *   posts {}      — kuzatilayotgan kanalda post qo'shildi/o'chdi/tahrirlandi/qadaldi
 *
 * MUHIM (QA A1): suhbatni O'ZIM o'qiganim (`a/bReadAt` mening tomonim) faol suhbat uchun `dm` hodisasi EMAS —
 * ilgari shu belgi har GET'da yangilanib, kuzatuvchi uni «o'zgarish» deb qaytarar va ochiq suhbat o'zini soniyasiga
 * bir marta qayta yuklardi. Endi faqat qarshi tomonning o'qishi `dm`; o'zimniki — bitta `inbox` (boshqa oynam uchun).
 */
export const TYPING_WINDOW_MS = 6000;

export interface StreamEvent {
  type: "dm" | "group" | "posts" | "inbox";
  conv?: string;
}

export interface Watcher {
  /** `since` dan keyingi o'zgarishlar; `now` — shu tekshiruv vaqti (keyingi cursor) */
  check(since: number, now: number): Promise<StreamEvent[]>;
}

/** Vaqt tamg'asi tranzaksiya tugashidan OLDIN hisoblanadi — shu oynada yozilgan o'zgarish tick'dan keyin ko'rinishi mumkin, shuning uchun orqaga qarab tekshiramiz; takrorni `seen` versiyalari yutadi */
const OVERLAP_MS = 10_000;
/** Ro'yxat (inbox) imzosi har nechanchi tick'da tekshiriladi — guruh faolligi 2 s ichida ko'rinsa yetarli */
const INBOX_EVERY = 2;

export function createWatcher(meId: string, opts: { conv?: string | null; groupId?: string | null; /** false — faqat jamoa hodisalari (GroupChat/ChannelPosts o'z ulanishi; DM so'rovlari bajarilmaydi) */ dm?: boolean }): Watcher {
  const watchDm = opts.dm !== false;
  let tick = 0;
  /** Faol suhbat holati imzosi (yozmoqda · qadoq · muddat · blok · reaksiyalar) — almashsa `dm` */
  let convSig: string | null = null;
  let inboxSig: string | null = null;
  let groupVersion = 0;
  let groupSig: string | null = null;
  let postsSig: string | null = null;
  /** Suhbat → oxirgi ko'rilgan versiya (max vaqt tamg'asi) — faqat o'sganda hodisa */
  const seen = new Map<string, number>();
  /** Suhbat → mening o'qish belgimning oxirgi ko'rilgan qiymati (boshqa oynada o'qilganini ro'yxatga bildirish uchun) */
  const myRead = new Map<string, number>();
  const myConvs = or(eq(conversations.aId, meId), eq(conversations.bId, meId))!;
  const ts = (d: Date | null | undefined) => d?.getTime() ?? 0;

  return {
    async check(since, now) {
      const events: StreamEvent[] = [];
      const sinceD = new Date(since - OVERLAP_MS);
      tick++;

      if (watchDm) {
        const changed = new Map<string, number>();
        const bump = (conv: string, v: number) => changed.set(conv, Math.max(changed.get(conv) ?? 0, v));
        let inbox = false;

        // 1) Suhbat darajasi: oxirgi xabar / QARSHI TOMON o'qidi (mening o'qishim — faqat ro'yxat uchun)
        const convRows = await db
          .select({ id: conversations.id, aId: conversations.aId, m: conversations.lastMessageAt, a: conversations.aReadAt, b: conversations.bReadAt })
          .from(conversations)
          .where(and(myConvs, or(gt(conversations.lastMessageAt, sinceD), gt(conversations.aReadAt, sinceD), gt(conversations.bReadAt, sinceD))!))
          .limit(50);
        for (const r of convRows) {
          const mine = ts(r.aId === meId ? r.a : r.b);
          const peer = ts(r.aId === meId ? r.b : r.a);
          const v = Math.max(ts(r.m), peer);
          if (v > since - OVERLAP_MS) bump(r.id, v);
          if (mine > (myRead.get(r.id) ?? 0)) {
            // Birinchi ko'rish — faqat eslab qolamiz (ulanishdan oldingi o'qishlar hodisa emas)
            if (myRead.has(r.id) || mine > since) inbox = true;
            myRead.set(r.id, mine);
          }
        }

        // 2) Xabar darajasi: yangi / tahrir / o'chirish
        const mineConvs = db.select({ id: conversations.id }).from(conversations).where(myConvs);
        const msgRows = await db
          .select({ conv: dmMessages.conversationId, c: dmMessages.createdAt, e: dmMessages.editedAt, d: dmMessages.deletedAt })
          .from(dmMessages)
          .where(and(inArray(dmMessages.conversationId, mineConvs), or(gt(dmMessages.createdAt, sinceD), gt(dmMessages.editedAt, sinceD), gt(dmMessages.deletedAt, sinceD))!))
          .limit(100);
        for (const r of msgRows) bump(r.conv, Math.max(ts(r.c), ts(r.e), ts(r.d)));

        // 3) Faol suhbat holati — bitta so'rov: qarshi tomon «yozmoqda», qadoq, yo'qolish muddati, blok, reaksiyalar imzosi.
        //    Bular vaqt tamg'asi bilan kuzatilmaydi (reaksiya olib tashlash, qadoqni yechish) — imzo almashsa hodisa.
        if (opts.conv) {
          const r = await db.get<{ a_id: string; b_id: string; a_t: number | null; b_t: number | null; pin: string | null; ttl: number; blocks: number; rx: string | null }>(sql`
            select c.a_id, c.b_id, c.a_typing_at as a_t, c.b_typing_at as b_t, c.pinned_message_id as pin, c.ttl_seconds as ttl,
              (select count(*) from user_blocks ub where (ub.blocker_id = c.a_id and ub.blocked_id = c.b_id) or (ub.blocker_id = c.b_id and ub.blocked_id = c.a_id)) as blocks,
              (select count(*) || ':' || coalesce(max(r.created_at), 0) || ':' || coalesce(sum(length(r.emoji)), 0) from dm_message_reactions r
                where r.message_id in (select m.id from dm_messages m where m.conversation_id = c.id order by m.created_at desc limit 200)) as rx
            from conversations c where c.id = ${opts.conv} and (c.a_id = ${meId} or c.b_id = ${meId})`);
          if (r) {
            const typing = now - Number((r.a_id === meId ? r.b_t : r.a_t) ?? 0) < TYPING_WINDOW_MS;
            const sig = `${typing ? 1 : 0}|${r.pin ?? ""}|${r.ttl}|${r.blocks}|${r.rx ?? ""}`;
            if (convSig !== null && sig !== convSig) events.push({ type: "dm", conv: opts.conv });
            convSig = sig;
          }
        }
        for (const [conv, v] of changed) {
          if (v > (seen.get(conv) ?? 0)) {
            seen.set(conv, v);
            // Faol suhbat holat imzosi bilan allaqachon qo'shilgan bo'lsa takrorlanmaydi
            if (!events.some((e) => e.type === "dm" && e.conv === conv)) events.push({ type: "dm", conv });
          }
        }

        // 4) Ro'yxat imzosi (har 2-tick): guruh/kanal faolligi + a'zoliklarim + buyurtma chatlaridagi o'qilmaganlar
        if (tick === 1 || tick % INBOX_EVERY === 0) {
          const r = await db.get<{ grp: string | null; ord: string | null }>(sql`
            select
              (select coalesce(max(coalesce(g.last_activity_at, g.created_at)), 0) || ':' || count(*) || ':' || coalesce(max(gm.created_at), 0)
                from group_members gm join groups g on g.id = gm.group_id where gm.user_id = ${meId} and gm.status = 'active') as grp,
              (select coalesce(max(m.created_at), 0) || ':' || count(*)
                from messages m join orders o on o.id = m.order_id left join specialists s on s.id = o.specialist_id
                where m.read_at is null and m.sender_id is not null and m.sender_id != ${meId} and (o.client_id = ${meId} or s.user_id = ${meId})) as ord`);
          const sig = `${r?.grp ?? ""}|${r?.ord ?? ""}`;
          if (inboxSig !== null && sig !== inboxSig) inbox = true;
          inboxSig = sig;
        }
        // Suhbat hodisasi bo'lsa mijoz ro'yxatni baribir yangilaydi — alohida `inbox` shart emas
        if (inbox && !events.some((e) => e.type === "dm")) events.push({ type: "inbox" });
      }

      // 5) Jamoa chati: xabar/tahrir/o'chirish (versiya) + holat imzosi («yozmoqda», qadoq, o'qilganlik, reaksiyalar, mavzular) + kanal postlari
      if (opts.groupId) {
        const [gm] = await db
          .select({ v: sql<number>`max(max(coalesce(${groupMessages.createdAt}, 0), coalesce(${groupMessages.editedAt}, 0), coalesce(${groupMessages.deletedAt}, 0)))` })
          .from(groupMessages)
          .where(and(eq(groupMessages.groupId, opts.groupId), or(gt(groupMessages.createdAt, sinceD), gt(groupMessages.editedAt, sinceD), gt(groupMessages.deletedAt, sinceD))!));
        const st = await db.get<{ pin: string | null; typing: number; seen: number; rx: string | null; topics: string | null; posts: string | null }>(sql`
          select g.pinned_message_id as pin,
            (select count(*) from group_members gm where gm.group_id = g.id and gm.typing_at > ${now - TYPING_WINDOW_MS} and gm.user_id != ${meId}) as typing,
            (select coalesce(max(gm.last_read_at), 0) from group_members gm where gm.group_id = g.id and gm.status = 'active' and gm.user_id != ${meId}) as seen,
            (select count(*) || ':' || coalesce(max(r.created_at), 0) || ':' || coalesce(sum(length(r.emoji)), 0) from group_message_reactions r
              where r.message_id in (select m.id from group_messages m where m.group_id = g.id order by m.created_at desc limit 60)) as rx,
            (select count(*) || ':' || coalesce(sum(t.is_closed), 0) || ':' || coalesce(sum(length(t.name)), 0) from group_topics t where t.group_id = g.id) as topics,
            (select count(*) || ':' || coalesce(max(p.created_at), 0) || ':' || coalesce(max(p.edited_at), 0) || ':' || coalesce(sum(p.is_pinned), 0) from posts p where p.group_id = g.id) as posts
          from groups g where g.id = ${opts.groupId}`);
        const v = Number(gm?.v ?? 0);
        const sig = st ? `${st.pin ?? ""}|${st.typing}|${st.seen}|${st.rx ?? ""}|${st.topics ?? ""}` : "";
        if (v > groupVersion || (groupSig !== null && sig !== groupSig)) events.push({ type: "group" });
        groupVersion = Math.max(groupVersion, v);
        groupSig = sig;
        const pSig = st?.posts ?? "";
        if (postsSig !== null && pSig !== postsSig) events.push({ type: "posts" });
        postsSig = pSig;
      }
      return events;
    },
  };
}

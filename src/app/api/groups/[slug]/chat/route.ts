import { z } from "zod";
import { ApiError, handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { assertOwnUploads } from "@/app/api/orders/_lib/attachments";
import { cleanBody } from "@/lib/chat/text";
import { assertActiveMember, changedGroupMessages, groupSeenState, markGroupStreamRead, pageGroupMessages, pinnedMessage, recentGroupReactions, searchGroupMessages, sendGroupMessage, typingMembers } from "@/lib/groups/service";
import { groupMessageSchema } from "@/lib/groups/validators";
import { enforceLimit } from "@/lib/security/rate-limit";
import { assertTopicWritable, listTopics, streamUnread } from "@/lib/groups/topics";
import { groupOr404 } from "../../_lib";

type Ctx = { params: Promise<{ slug: string }> };

const querySchema = z.object({
  /** Polling kursori — shu xabardan keyingilar */
  after: z.string().trim().max(64).optional(),
  /** Tarix: shu xabardan OLDINGI bir sahifa (yuqoriga aylantirish) */
  before: z.string().trim().max(64).optional(),
  /** Sakrash: shu xabardan eng yangisigacha (nishon o'z mavzusi oqimida ochiladi) */
  from: z.string().trim().max(64).optional(),
  /** Qidiruv — 2–80 belgi */
  q: z.string().trim().min(2).max(80).optional(),
  /** Polling: shu vaqtdan (ms) keyin tahrirlangan/o'chirilganlar */
  changedSince: z.coerce.number().int().positive().optional(),
  /** Mavzu oqimi (group_topics.id) — berilmasa «Umumiy» (mavzusiz) xabarlar */
  topic: z.string().trim().max(64).optional(),
  /** read=0 — «o'qildi» belgilanmaydi (oyna fokussiz yoki o'quvchi yuqoriga aylantirgan) */
  read: z.enum(["0", "1"]).optional(),
  /** Klient shu sessiyada ko'rgan oqimlar: "<mavzuId yoki bo'sh>:<ms>" vergul bilan — boshqa mavzudagi o'qilmaganlar saqlanishi uchun */
  seen: z.string().trim().max(1200).optional(),
});

/** "t1:170…,:170…" → { t1: ms, "": ms } (noto'g'ri bo'laklar tashlanadi) */
function parseSeen(raw: string | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of (raw ?? "").split(",")) {
    const i = part.lastIndexOf(":");
    if (i < 0) continue;
    const ms = Number(part.slice(i + 1));
    if (Number.isFinite(ms) && ms > 0) out[part.slice(0, i)] = Math.min(ms, Date.now());
  }
  return out;
}

/**
 * GET: guruh chati — faqat faol a'zolar.
 *  - to'liq yuklash: items (oxirgi sahifa) + hasMore + pinned + seen/readUpTo + typing + topics;
 *  - ?after=<msgId> — polling (yangi xabarlar); ?changedSince=<ms> — shu vaqtdan keyin tahrirlangan/o'chirilganlar;
 *  - ?before=<msgId> — eskiroq sahifa (faqat items/hasMore); ?from=<msgId> — nishondan eng yangisigacha;
 *  - ?q=<matn> — qidiruv (faqat items; har natijada `topicId`).
 * O'qish oqimni "o'qilgan" deb belgilaydi (read=0 va ?before bundan mustasno) — boshqa mavzulardagi o'qilmaganlar saqlanadi.
 */
export const GET = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  const group = await groupOr404(slug);
  const viewer = { id: session.sub, role: session.role };
  await assertActiveMember(group, viewer);
  const q = parseQuery(req.url, querySchema);
  if (q.q) return ok({ items: await searchGroupMessages(group, viewer, q.q) });

  if (q.before) {
    const page = await pageGroupMessages(group, viewer, { beforeId: q.before, topicId: q.topic ?? null });
    return ok({ items: page.items, hasMore: page.hasMore });
  }

  const incremental = Boolean(q.after) && !q.from;
  const page = await pageGroupMessages(group, viewer, q.from ? { fromId: q.from } : { afterId: q.after ?? null, topicId: q.topic ?? null });
  const stream = page.topicId;
  const seenMap = parseSeen(q.seen);
  if (q.read !== "0") {
    seenMap[stream ?? ""] = Date.now();
    await markGroupStreamRead(group, session.sub, stream, seenMap);
  }
  const [seenState, typing, changed, pinned, reactions, topicRows] = await Promise.all([
    // "N kishi ko'rdi" va ✓✓: har so'rovda to'liq hisoblanadi (ilgari faqat qaytgan sahifadan — polling'da yo'qolardi, A8)
    groupSeenState(group, session.sub, stream),
    typingMembers(group.id, session.sub),
    incremental && q.changedSince ? changedGroupMessages(group, viewer, new Date(q.changedSince)) : Promise.resolve([]),
    pinnedMessage(group, viewer),
    // Oxirgi xabarlar reaksiyalari — boshqalar qo'ygan reaksiyalar polling bilan yangilanib turadi
    recentGroupReactions(group, session.sub),
    // Mavzular har so'rovda qaytadi (arzon): egasi yangi mavzu ochsa yoki yopsa ochiq chatda darhol ko'rinadi (A20)
    listTopics(group, viewer),
  ]);
  // Oqimlar bo'yicha o'qilmaganlar faqat mavzuli guruhda kerak (mavzusiz guruhda ortiqcha so'rov yo'q)
  const unread = topicRows.length ? await streamUnread(group.id, session.sub, seenMap) : new Map<string, number>();
  const topics = topicRows.map((t) => ({ ...t, unread: unread.get(t.id) ?? 0 }));
  return ok({
    items: page.items,
    hasMore: incremental ? undefined : page.hasMore,
    seen: seenState.seen,
    /** Boshqa a'zolardan kimdir o'qigan eng so'nggi vaqt (ms) — shungacha bo'lgan mening xabarlarim ✓✓ */
    readUpTo: seenState.readUpTo,
    typing,
    changed,
    pinned,
    reactions,
    topics,
    /** «Umumiy» oqimdagi o'qilmaganlar (mavzular bo'lganda yorliqdagi nishon uchun) */
    generalUnread: unread.get("") ?? 0,
    topicId: stream ?? null,
    now: Date.now(),
  });
});

/** POST: xabar (matn yoki fayl — kamida bittasi), 60 / 10 daqiqa */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  const input = await parseBody(req, groupMessageSchema);
  // Faqat ko'rinmas belgilardan iborat matn — bo'sh xabar
  const body = cleanBody(input.body);
  if (!body && input.attachments.length === 0) throw new ApiError(422, "Xabar matni yoki fayl kerak", { body: "Bo'sh xabar" });
  const group = await groupOr404(slug);
  const membership = await assertActiveMember(group, { id: session.sub, role: session.role });
  // Muhokama o'chirilgan (Telegram kabi): faqat egasi/admin yozadi
  if (group.chatDisabled && !(session.role === "admin" || membership?.role === "owner" || membership?.role === "admin")) {
    throw new ApiError(403, "Muhokama o'chirilgan — faqat boshqaruvchilar yoza oladi");
  }
  await assertOwnUploads(session.sub, input.attachments.map((a) => a.url));
  await enforceLimit("messages", session.sub);
  const topicId = await assertTopicWritable(group, { id: session.sub, role: session.role }, input.topicId);
  const m = await sendGroupMessage(group, session.sub, body, input.attachments, input.replyToId ?? null, topicId);
  return ok({ id: m.id, at: m.createdAt.getTime() }, { status: 201 });
});

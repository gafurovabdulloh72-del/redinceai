import { z } from "zod";
import { ApiError, handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { assertOwnUploads, attachmentListSchema } from "@/app/api/orders/_lib/attachments";
import { DM_BODY_MAX, changedMessages, deleteConversationForMe, dmQuotes, getPrefs, listMessages, loadConversationFor, markRead, peerIsTyping, pinnedQuote, reactionWindowStart, reactionsFor, sendDm, toDmView, toPeerView, touchLastSeen } from "@/lib/chat/dm";
import { cleanBody } from "@/lib/chat/text";
import { enforceLimit } from "@/lib/security/rate-limit";
import { assertCanDm, blockState } from "@/lib/privacy/blocks";

const listQuery = z.object({
  /** Polling kursori — shu xabardan keyingilar */
  after: z.string().trim().max(64).optional(),
  /** Tarix: shu xabardan OLDINGI bir sahifa (yuqoriga aylantirish) */
  before: z.string().trim().max(64).optional(),
  /** Sakrash: shu xabardan (biroz kontekst bilan) eng yangisigacha — qidiruv/qadalgan/iqtibos nishoni yuklanmagan bo'lsa */
  from: z.string().trim().max(64).optional(),
  /** Polling: shu vaqtdan (ms) keyin tahrirlangan/o'chirilgan eski xabarlar ham qaytadi */
  sync: z.coerce.number().int().min(0).optional(),
  /** read=0 — suhbat «o'qildi» deb belgilanmaydi (oyna fokussiz yoki o'quvchi yuqoriga aylantirgan — yolg'on ✓✓ bo'lmasin) */
  read: z.enum(["0", "1"]).optional(),
});

/**
 * GET: suhbat sarlavhasi (qarshi tomon) + xabarlar (iqtibos/reaksiya/tahrir holati bilan).
 *  - parametrsiz — oxirgi sahifa (`hasMore` — eskiroqlari bormi);
 *  - ?after=<msgId> — faqat yangilari (polling), ?sync=<ms> — shu vaqtdan keyin o'zgargan eski xabarlar (`updates`);
 *  - ?before=<msgId> — eskiroq sahifa (faqat `items`, `reactions`, `hasMore`);
 *  - ?from=<msgId> — nishon xabardan eng yangisigacha (ro'yxat almashtiriladi).
 * O'qish suhbatni "o'qilgan" deb belgilaydi (read=0 va ?before bundan mustasno) — faqat o'qilmagan xabar bo'lsa yozadi.
 * `readAt` — MENING avvalgi o'qigan vaqtim (faqat to'liq yuklashda; «Yangi xabarlar» chizig'i uchun).
 */
export const GET = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const q = parseQuery(req.url, listQuery);
  const found = await loadConversationFor(session.sub, id);
  if (!found) throw new ApiError(404, "Suhbat topilmadi");

  // Eskiroq sahifa: faqat xabarlar (sarlavha/holat o'zgarmaydi, o'qildi belgisi ham qo'yilmaydi)
  if (q.before) {
    const page = await listMessages(id, session.sub, { beforeId: q.before });
    const [quotes, reactions] = await Promise.all([dmQuotes(id, page.rows, session.sub), reactionsFor(id, session.sub, page.rows.map((m) => m.id))]);
    return ok({ items: page.rows.map((m) => toDmView(m, session.sub, quotes, reactions)), hasMore: page.hasMore });
  }

  const incremental = Boolean(q.after) && !q.from;
  const page = await listMessages(id, session.sub, q.from ? { fromId: q.from } : { afterId: q.after ?? null });
  const items = page.rows;
  const updates = incremental && q.sync ? await changedMessages(id, session.sub, q.sync) : [];
  const [quotes, blocked, reactions, rxFrom, pinned, prefs] = await Promise.all([
    dmQuotes(id, [...items, ...updates], session.sub),
    blockState(session.sub, found.peer.id),
    // Sakrashda oyna 200 tadan uzun bo'lishi mumkin — aynan qaytayotgan xabarlar reaksiyalari
    q.from ? reactionsFor(id, session.sub, items.map((m) => m.id)) : reactionsFor(id, session.sub),
    q.from ? Promise.resolve(0) : reactionWindowStart(id),
    pinnedQuote(found.conv, session.sub),
    incremental ? null : getPrefs(id, session.sub),
  ]);
  await Promise.all([q.read === "0" ? Promise.resolve(false) : markRead(found.conv, session.sub), touchLastSeen(session.sub)]);
  const isBlocked = blocked.byMe || blocked.me;
  return ok({
    // Blok juftligida onlayn holati ham, «yozmoqda» ham ko'rinmaydi (A15)
    peer: toPeerView(found.peer, isBlocked),
    /** Blok holati: men bloklaganman / u meni bloklagan — ikkalasida ham yozib bo'lmaydi */
    blocked,
    /** Qarshi tomon o'qigan vaqt (ms) — bundan oldingi mening xabarlarim "✓✓ o'qildi" */
    peerReadAt: found.peerReadAt ? found.peerReadAt.getTime() : 0,
    /** Mening avvalgi o'qigan vaqtim (ms) — «Yangi xabarlar» ajratuvchisi shundan */
    readAt: incremental ? null : found.myReadAt,
    peerTyping: !isBlocked && peerIsTyping(found.conv, session.sub),
    pinned,
    prefs,
    /** O'z-o'zidan yo'qoladigan xabarlar muddati (soniya; 0 — o'chiq) — ikki tomon uchun umumiy */
    ttlSeconds: found.conv.ttlSeconds,
    /** Reaksiyalar: xabar id → yig'indi; `rxFrom` (ms) dan yangi xabarlar oynasini to'liq qamraydi */
    reactions: Object.fromEntries(reactions),
    rxFrom,
    items: items.map((m) => toDmView(m, session.sub, quotes, reactions)),
    updates: updates.map((m) => toDmView(m, session.sub, quotes, reactions)),
    /** Bu oynadan eskiroq xabarlar bormi (faqat to'liq yuklash / sakrashda ma'noli) */
    hasMore: incremental ? undefined : page.hasMore,
    now: Date.now(),
  });
});

const sendSchema = z.object({
  body: z.string().trim().max(DM_BODY_MAX).optional().default(""),
  attachments: attachmentListSchema().optional().default([]),
  /** Javob (iqtibos) — shu suhbatdagi xabar id'si */
  replyToId: z.string().trim().max(64).nullable().optional(),
});

/** POST: xabar yuborish (matn, fayl yoki ovozli xabar — kamida bittasi; ixtiyoriy iqtibos) */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, sendSchema);
  // Faqat ko'rinmas belgilardan (zero-width va h.k.) iborat matn — bo'sh xabar (bo'sh pufakcha chiqmasin)
  const body = cleanBody(input.body);
  if (!body && input.attachments.length === 0) throw new ApiError(422, "Xabar matni yoki fayl kerak", { body: "Bo'sh xabar" });

  const found = await loadConversationFor(session.sub, id);
  if (!found) throw new ApiError(404, "Suhbat topilmadi");
  if (found.peer.isBanned) throw new ApiError(403, "Bu foydalanuvchiga yozib bo'lmaydi");
  await assertCanDm(session.sub, found.peer, Boolean(found.conv.lastMessageAt));

  // Faqat o'zi yuklagan fayllarni biriktira oladi (boshqa birovning faylini ulab bo'lmaydi)
  await assertOwnUploads(session.sub, input.attachments.map((a) => a.url));
  await enforceLimit("messages", session.sub);
  const m = await sendDm(found.conv, session.sub, body, input.attachments, input.replyToId ?? null);
  const quotes = await dmQuotes(id, [m], session.sub);
  return ok(toDmView(m, session.sub, quotes), { status: 201 });
});

/**
 * DELETE: suhbatni MEN UCHUN o'chirish — barcha xabarlar faqat menda yashiriladi va suhbat ro'yxatimdan yo'qoladi
 * (suhbatdoshda hammasi qoladi; yangi xabar kelsa suhbat qaytadi). Faqat ishtirokchi.
 */
export const DELETE = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const found = await loadConversationFor(session.sub, id);
  if (!found) throw new ApiError(404, "Suhbat topilmadi");
  await enforceLimit("dmEdit", session.sub);
  const hidden = await deleteConversationForMe(found.conv, session.sub);
  return ok({ id, hidden });
});

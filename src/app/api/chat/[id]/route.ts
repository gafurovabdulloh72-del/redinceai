import { z } from "zod";
import { ApiError, handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { assertOwnUploads, attachmentListSchema } from "@/app/api/orders/_lib/attachments";
import { DM_BODY_MAX, changedMessages, dmQuotes, getPrefs, listMessages, loadConversationFor, markRead, peerIsTyping, pinnedQuote, reactionsFor, sendDm, toDmView, touchLastSeen } from "@/lib/chat/dm";
import { enforceLimit } from "@/lib/security/rate-limit";
import { assertCanDm, blockState } from "@/lib/privacy/blocks";

const listQuery = z.object({
  /** Polling kursori — shu xabardan keyingilar */
  after: z.string().trim().max(64).optional(),
  /** Polling: shu vaqtdan (ms) keyin tahrirlangan/o'chirilgan eski xabarlar ham qaytadi */
  sync: z.coerce.number().int().min(0).optional(),
  /** read=0 — suhbat «o'qildi» deb belgilanmaydi (oyna fokussiz bo'lganda polling yolg'on ✓✓ qilmasin) */
  read: z.enum(["0", "1"]).optional(),
});

/**
 * GET: suhbat sarlavhasi (qarshi tomon) + xabarlar (iqtibos/reaksiya/tahrir holati bilan); ?after=<msgId> — faqat yangilari (polling),
 * ?sync=<ms> — shu vaqtdan keyin o'zgargan eski xabarlar (`updates`). O'qish suhbatni "o'qilgan" deb belgilaydi (read=0 bundan mustasno).
 * `readAt` — MENING avvalgi o'qigan vaqtim (faqat to'liq yuklashda; «Yangi xabarlar» chizig'i uchun).
 */
export const GET = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const q = parseQuery(req.url, listQuery);
  const found = await loadConversationFor(session.sub, id);
  if (!found) throw new ApiError(404, "Suhbat topilmadi");
  const items = await listMessages(id, session.sub, q.after ?? null);
  const updates = q.after && q.sync ? await changedMessages(id, session.sub, q.sync) : [];
  const [quotes, blocked, reactions, pinned, prefs] = await Promise.all([
    dmQuotes(id, [...items, ...updates]),
    blockState(session.sub, found.peer.id),
    reactionsFor(id, session.sub),
    pinnedQuote(found.conv),
    q.after ? null : getPrefs(id, session.sub),
  ]);
  await Promise.all([q.read === "0" ? Promise.resolve() : markRead(found.conv, session.sub), touchLastSeen(session.sub)]);
  const showOnline = found.peer.showOnline !== false;
  return ok({
    peer: {
      id: found.peer.id,
      username: found.peer.username,
      name: found.peer.name,
      avatarUrl: found.peer.avatarUrl,
      isBanned: found.peer.isBanned,
      slug: found.peer.slug ?? null,
      /** Chatdagi real faollik — "Onlayn" (yashil) belgisi faqat shundan hisoblanadi; showOnline=false bo'lsa yashirin */
      lastSeenAt: showOnline && found.peer.lastSeenAt ? found.peer.lastSeenAt.getTime() : null,
      /** Oxirgi faollik — chat faolligi yo'q bo'lsa tizimga kirishdan olinadi; maxfiylikda yashirin */
      lastActiveAt: showOnline ? ((found.peer.lastSeenAt ?? found.peer.lastLoginAt)?.getTime() ?? null) : null,
    },
    /** Blok holati: men bloklaganman / u meni bloklagan — ikkalasida ham yozib bo'lmaydi */
    blocked,
    /** Qarshi tomon o'qigan vaqt (ms) — bundan oldingi mening xabarlarim "✓✓ o'qildi" */
    peerReadAt: found.peerReadAt ? found.peerReadAt.getTime() : 0,
    /** Mening avvalgi o'qigan vaqtim (ms) — «Yangi xabarlar» ajratuvchisi shundan */
    readAt: q.after ? null : found.myReadAt,
    peerTyping: peerIsTyping(found.conv, session.sub),
    pinned,
    prefs,
    /** Reaksiyalar: xabar id → yig'indi (so'nggi 200 ta xabar oynasi) */
    reactions: Object.fromEntries(reactions),
    items: items.map((m) => toDmView(m, session.sub, quotes, reactions)),
    updates: updates.map((m) => toDmView(m, session.sub, quotes, reactions)),
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
  if (!input.body && input.attachments.length === 0) throw new ApiError(422, "Xabar matni yoki fayl kerak", { body: "Bo'sh xabar" });

  const found = await loadConversationFor(session.sub, id);
  if (!found) throw new ApiError(404, "Suhbat topilmadi");
  if (found.peer.isBanned) throw new ApiError(403, "Bu foydalanuvchiga yozib bo'lmaydi");
  await assertCanDm(session.sub, found.peer, Boolean(found.conv.lastMessageAt));

  // Faqat o'zi yuklagan fayllarni biriktira oladi (boshqa birovning faylini ulab bo'lmaydi)
  await assertOwnUploads(session.sub, input.attachments.map((a) => a.url));
  await enforceLimit("messages", session.sub);
  const m = await sendDm(found.conv, session.sub, input.body, input.attachments, input.replyToId ?? null);
  const quotes = await dmQuotes(id, [m]);
  return ok(toDmView(m, session.sub, quotes), { status: 201 });
});

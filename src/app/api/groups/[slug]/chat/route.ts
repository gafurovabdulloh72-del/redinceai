import { ApiError, handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { assertOwnUploads } from "@/app/api/orders/_lib/attachments";
import { assertActiveMember, changedGroupMessages, listGroupMessages, markGroupRead, pinnedMessage, searchGroupMessages, seenCountFor, sendGroupMessage, typingMembers } from "@/lib/groups/service";
import { chatQuerySchema, groupMessageSchema } from "@/lib/groups/validators";
import { enforceLimit } from "@/lib/security/rate-limit";
import { groupOr404 } from "../../_lib";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * GET: guruh chati — faqat faol a'zolar. O'qish "o'qildi" deb belgilaydi.
 *  - to'liq yuklash: items + pinned (qadalgan xabar) + seen + typing
 *  - ?after=<msgId> — polling (yangi xabarlar); ?changedSince=<ms> — shu vaqtdan keyin tahrirlangan/o'chirilganlar
 *  - ?q=<matn> — qidiruv (faqat items)
 */
export const GET = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  const group = await groupOr404(slug);
  const viewer = { id: session.sub, role: session.role };
  await assertActiveMember(group, viewer);
  const q = parseQuery(req.url, chatQuerySchema);
  if (q.q) return ok({ items: await searchGroupMessages(group, viewer, q.q) });
  const items = await listGroupMessages(group, viewer, q.after ?? null);
  await markGroupRead(group.id, session.sub);
  // "N kishi ko'rdi": ko'ruvchining oxirgi xabarini nechta a'zo o'qigan (to'liq yuklashda ham, polling'da ham qaytadi)
  const lastMine = [...items].reverse().find((m) => m.mine);
  const [seen, typing, changed, pinned] = await Promise.all([
    lastMine ? seenCountFor(group, session.sub, new Date(lastMine.at)).then((count) => ({ messageId: lastMine.id, count })) : Promise.resolve(null),
    typingMembers(group.id, session.sub),
    q.changedSince ? changedGroupMessages(group, viewer, new Date(q.changedSince)) : Promise.resolve([]),
    pinnedMessage(group, viewer),
  ]);
  return ok({ items, seen, typing, changed, pinned, now: Date.now() });
});

/** POST: xabar (matn yoki fayl — kamida bittasi), 60 / 10 daqiqa */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  const input = await parseBody(req, groupMessageSchema);
  if (!input.body && input.attachments.length === 0) throw new ApiError(422, "Xabar matni yoki fayl kerak", { body: "Bo'sh xabar" });
  const group = await groupOr404(slug);
  await assertActiveMember(group, { id: session.sub, role: session.role });
  await assertOwnUploads(session.sub, input.attachments.map((a) => a.url));
  await enforceLimit("messages", session.sub);
  const m = await sendGroupMessage(group, session.sub, input.body, input.attachments, input.replyToId ?? null);
  return ok({ id: m.id, at: m.createdAt.getTime() }, { status: 201 });
});

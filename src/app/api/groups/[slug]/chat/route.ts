import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { assertOwnUploads } from "@/app/api/orders/_lib/attachments";
import { assertActiveMember, listGroupMessages, markGroupRead, sendGroupMessage } from "@/lib/groups/service";
import { groupMessageSchema } from "@/lib/groups/validators";
import { enforceLimit } from "@/lib/security/rate-limit";
import { groupOr404 } from "../../_lib";

type Ctx = { params: Promise<{ slug: string }> };

/** GET: guruh chati (?after=<msgId> — polling); faqat faol a'zolar. O'qish "o'qildi" deb belgilaydi */
export const GET = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  const group = await groupOr404(slug);
  const viewer = { id: session.sub, role: session.role };
  await assertActiveMember(group, viewer);
  const after = new URL(req.url).searchParams.get("after");
  const items = await listGroupMessages(group, viewer, after);
  await markGroupRead(group.id, session.sub);
  return ok({ items });
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
  const m = await sendGroupMessage(group, session.sub, input.body, input.attachments);
  return ok({ id: m.id, at: m.createdAt.getTime() }, { status: 201 });
});

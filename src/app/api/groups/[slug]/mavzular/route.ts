import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { createTopic, listTopics, TOPIC_NAME_MAX } from "@/lib/groups/topics";
import { enforceLimit } from "@/lib/security/rate-limit";
import { groupOr404 } from "../../_lib";

type Ctx = { params: Promise<{ slug: string }> };

/** GET — guruh mavzulari (xabar soni va oxirgi faollik bilan) */
export const GET = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  const group = await groupOr404(slug);
  return ok({ items: await listTopics(group, { id: session.sub, role: session.role }) });
});

const schema = z.object({ name: z.string().trim().min(1).max(TOPIC_NAME_MAX) });

/** POST — yangi mavzu (faqat boshqaruvchilar) */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  const input = await parseBody(req, schema);
  const group = await groupOr404(slug);
  await enforceLimit("social", session.sub);
  return ok(await createTopic(group, { id: session.sub, role: session.role }, input.name));
});

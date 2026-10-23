import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { deleteTopic, TOPIC_NAME_MAX, updateTopic } from "@/lib/groups/topics";
import { groupOr404 } from "../../../_lib";

type Ctx = { params: Promise<{ slug: string; id: string }> };

const schema = z.object({ name: z.string().trim().min(1).max(TOPIC_NAME_MAX).optional(), isClosed: z.boolean().optional() });

/** PATCH — mavzu nomi / yopish-ochish (faqat boshqaruvchilar) */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug, id } = await ctx.params;
  const input = await parseBody(req, schema);
  const group = await groupOr404(slug);
  await updateTopic(group, { id: session.sub, role: session.role }, id, input);
  return ok({ updated: true });
});

/** DELETE — mavzuni o'chirish; xabarlar «Umumiy» oqimga qaytadi */
export const DELETE = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug, id } = await ctx.params;
  const group = await groupOr404(slug);
  return ok(await deleteTopic(group, { id: session.sub, role: session.role }, id));
});

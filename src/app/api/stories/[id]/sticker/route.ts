import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { answerSticker, stickerAnswers } from "@/lib/social/instagram";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** GET: javoblar (faqat muallifga). POST {choice|text}: so'rovnoma varianti yoki savolga javob */
export const GET = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok({ items: await stickerAnswers(id, session.sub) });
});

export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, z.object({ choice: z.number().int().min(0).max(1).optional(), text: z.string().trim().max(300).optional() }));
  await enforceLimit("social", session.sub);
  return ok(await answerSticker(id, session.sub, input));
});

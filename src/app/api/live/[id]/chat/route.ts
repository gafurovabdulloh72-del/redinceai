import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { chatHistory, saveChat } from "@/lib/live/service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET — chat tarixi (kech kirganlar uchun) */
export const GET = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok({ items: await chatHistory(id, { id: session.sub, role: session.role }) });
});

/** POST {body} — xabarni tarixga yozish (taqiqlanganlar yoza olmaydi) */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, z.object({ body: z.string().min(1).max(300) }));
  await enforceLimit("messages", session.sub);
  await saveChat(id, { id: session.sub, role: session.role }, input.body);
  return ok({ saved: true }, { status: 201 });
});

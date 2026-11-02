import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { deleteFolder, moveFolder, renameFolder } from "@/lib/chat/dm";

// name — nomini o'zgartirish; move — tartibda surish (kamchilik #7); kamida bittasi kerak
const schema = z.object({ name: z.string().trim().min(1).max(24).optional(), move: z.enum(["up", "down"]).optional() }).refine((v) => v.name || v.move, { error: "name yoki move kerak" });

/** PATCH — papka nomini o'zgartirish yoki tartibda surish */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  if (input.move) await moveFolder(session.sub, id, input.move);
  if (input.name) await renameFolder(session.sub, id, input.name);
  return ok({ updated: true });
});

/** DELETE — papkani o'chirish (suhbatlar «Hammasi»ga qaytadi) */
export const DELETE = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await deleteFolder(session.sub, id);
  return ok({ removed: true });
});

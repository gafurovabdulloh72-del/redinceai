import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { deleteFolder, renameFolder } from "@/lib/chat/dm";

const schema = z.object({ name: z.string().trim().min(1).max(24) });

/** PATCH — papka nomini o'zgartirish */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  await renameFolder(session.sub, id, input.name);
  return ok({ updated: true });
});

/** DELETE — papkani o'chirish (suhbatlar «Hammasi»ga qaytadi) */
export const DELETE = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await deleteFolder(session.sub, id);
  return ok({ removed: true });
});

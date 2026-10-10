import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { specialists } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";

const schema = z.object({
  isVerified: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

/** Admin: tasdiqlash / tavsiya etilganlarga qo'shish */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  await requireSession(["admin"]);
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  if (input.isVerified === undefined && input.isFeatured === undefined) throw new ApiError(400, "Hech narsa o'zgarmadi");

  const res = await db.update(specialists).set({ ...input, updatedAt: new Date() }).where(eq(specialists.id, id));
  if (res.rowsAffected === 0) throw new ApiError(404, "Mutaxassis topilmadi");
  return ok({ id, ...input });
});

export const DELETE = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  await requireSession(["admin"]);
  const { id } = await ctx.params;
  await db.delete(specialists).where(eq(specialists.id, id));
  return ok({ deleted: true });
});

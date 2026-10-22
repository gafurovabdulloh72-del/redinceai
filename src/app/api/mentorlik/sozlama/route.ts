import { z } from "zod";
import { eq } from "drizzle-orm";
import { handler, ok, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { mentors } from "@/lib/db/schema";
import { requireMentor } from "../_mentor";

/** PATCH — oylik obuna narxi (0 = o'chiq, 10 000–5 000 000) va tavsiya chegirmasi (0–50%) */
export const PATCH = handler(async (req) => {
  const { mentor } = await requireMentor();
  const input = await parseBody(req, z.object({ subPrice: z.number().int().refine((v) => v === 0 || (v >= 10_000 && v <= 5_000_000), "0 yoki 10 000 – 5 000 000").optional(), refPercent: z.number().int().min(0).max(50).optional() }));
  const set: Partial<typeof mentors.$inferInsert> = {};
  if (input.subPrice !== undefined) set.subPrice = input.subPrice;
  if (input.refPercent !== undefined) set.refPercent = input.refPercent;
  if (Object.keys(set).length) await db.update(mentors).set(set).where(eq(mentors.id, mentor.id));
  return ok({ updated: true });
});

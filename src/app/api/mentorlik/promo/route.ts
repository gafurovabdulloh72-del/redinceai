import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { createPromo, listPromos, setPromoActive } from "@/lib/mentorship/purchases";
import { requireMentor } from "../_mentor";

export const GET = handler(async () => {
  const { mentor } = await requireMentor();
  return ok({ items: await listPromos(mentor.id) });
});

export const POST = handler(async (req) => {
  const { mentor } = await requireMentor();
  const input = await parseBody(req, z.object({ code: z.string().min(3).max(24), percent: z.number().int().min(1).max(100), courseId: z.string().nullish(), maxUses: z.number().int().min(1).max(100000).nullish(), days: z.number().int().min(1).max(365).nullish() }));
  await createPromo(mentor.id, input);
  return ok({ created: true }, { status: 201 });
});

export const PATCH = handler(async (req) => {
  const { mentor } = await requireMentor();
  const input = await parseBody(req, z.object({ id: z.string(), active: z.boolean() }));
  await setPromoActive(mentor.id, input.id, input.active);
  return ok({ updated: true });
});

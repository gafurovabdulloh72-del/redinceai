import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { listEarnings, listPayouts, mentorBalance, requestPayout } from "@/lib/mentorship/purchases";
import { requireMentor } from "../_mentor";

/** GET — mening daromadim: balans, sotuvlar, yechish tarixi */
export const GET = handler(async () => {
  const { mentor } = await requireMentor();
  const [balance, earnings, payouts] = await Promise.all([mentorBalance(mentor.id), listEarnings(mentor.id), listPayouts(mentor.id)]);
  return ok({ balance, earnings, payouts });
});

/** POST {card} — mavjud (7 kundan o'tgan) daromadni kartaga yechish so'rovi */
export const POST = handler(async (req) => {
  const { session, mentor } = await requireMentor();
  await enforceLimit("purchase", session.sub);
  const input = await parseBody(req, z.object({ card: z.string().min(12).max(24) }));
  return ok(await requestPayout(mentor.id, mentor.userId, input.card), { status: 201 });
});

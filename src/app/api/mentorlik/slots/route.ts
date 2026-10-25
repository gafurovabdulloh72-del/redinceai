import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { cancelSlot, createSlot, listSlots } from "@/lib/mentorship/purchases";
import { getMentorForUser } from "@/lib/mentorship/service";
import { requireMentor } from "../_mentor";

/** GET ?mentor=<id> — mentorning bo'sh vaqtlari (mentorning o'zi — hammasi) */
export const GET = handler(async (req) => {
  const mentorId = new URL(req.url).searchParams.get("mentor") ?? "";
  const session = await requireSession().catch(() => null);
  const mine = session ? await getMentorForUser(session.sub) : null;
  const manage = Boolean(mine && mine.id === mentorId);
  const items = mentorId ? await listSlots(mentorId, manage) : [];
  return ok({ items: items.map((s) => ({ id: s.id, startsAt: s.startsAt.getTime(), durationMin: s.durationMin, priceSom: s.priceSom, note: s.note, status: s.status })) });
});

export const POST = handler(async (req) => {
  const { session, mentor } = await requireMentor();
  await enforceLimit("mentor", session.sub);
  const input = await parseBody(req, z.object({ startsAt: z.number(), durationMin: z.number().int(), priceSom: z.number().int(), note: z.string().max(200).optional() }));
  await createSlot(mentor.id, input);
  return ok({ created: true }, { status: 201 });
});

export const DELETE = handler(async (req) => {
  const { session, mentor } = await requireMentor();
  await enforceLimit("mentor", session.sub);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  await cancelSlot(mentor.id, id);
  return ok({ cancelled: true });
});

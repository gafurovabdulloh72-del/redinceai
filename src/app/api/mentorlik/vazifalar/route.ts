import { handler, ok, requireSession } from "@/lib/api";
import { listSubmissionsForMentor } from "@/lib/mentorship/learning";

/** GET ?all=1 — mentorning vazifalari (standart: baholanmaganlari) */
export const GET = handler(async (req) => {
  const session = await requireSession();
  const all = new URL(req.url).searchParams.get("all") === "1";
  return ok({ items: await listSubmissionsForMentor(session.sub, session.role === "admin", all ? "all" : "pending") });
});

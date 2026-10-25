import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { mentorApplySchema } from "@/lib/mentorship/validators";
import { applyAsMentor, getMentorForUser } from "@/lib/mentorship/service";

/** GET — joriy foydalanuvchining mentorlik holati */
export const GET = handler(async () => {
  const session = await requireSession();
  const m = await getMentorForUser(session.sub);
  return ok({ status: m ? (m.isApproved ? "approved" : "pending") : "none", headline: m?.headline ?? null, bio: m?.bio ?? null, expertise: m?.expertise ?? [] });
});

/** POST — mentor bo'lish arizasi (yoki tasdiqdan oldin yangilash) */
export const POST = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("mentor", session.sub);
  const input = await parseBody(req, mentorApplySchema);
  return ok(await applyAsMentor(session.sub, input), { status: 201 });
});

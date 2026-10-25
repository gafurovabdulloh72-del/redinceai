import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { mentorProfileSchema } from "@/lib/mentorship/validators";
import { updateMentorProfile } from "@/lib/mentorship/service";
import { assertOwnUploads } from "@/app/api/orders/_lib/attachments";

type Ctx = { params: Promise<{ id: string }> };

/** PUT — mentor sahifasini saqlash (egasi yoki admin): sarlavha, bio, rasm/muqova, ma'lumot kartalari */
export const PUT = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  await enforceLimit("mentor", session.sub);
  const { id } = await ctx.params;
  const input = await parseBody(req, mentorProfileSchema);
  const admin = session.role === "admin";
  // Rasmlar: o'zi yuklagan bo'lishi shart (admin boshqa mentor nomidan yuklagan rasmini ham qo'ya oladi)
  if (!admin) await assertOwnUploads(session.sub, [input.photoUrl, input.coverUrl].filter((u): u is string => Boolean(u)), [], "photoUrl");
  await updateMentorProfile(id, { id: session.sub, admin }, input);
  return ok({ ok: true });
});

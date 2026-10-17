import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { deleteResume, getResume, upsertResume } from "@/lib/vacancies/service";
import { resumeInputSchema } from "@/lib/vacancies/validators";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";

/** Mening rezyumem: GET — o'qish, PUT — yaratish/yangilash (bitta), DELETE — o'chirish */
export const GET = handler(async () => {
  const session = await requireSession();
  return ok({ resume: await getResume(session.sub) });
});

export const PUT = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, resumeInputSchema);
  await enforceLimit("social", session.sub);
  const r = await upsertResume(session.sub, input);
  await audit(session.sub, "resume_upsert", { targetType: "resume", targetId: r.id, meta: { profession: r.profession, isPublic: r.isPublic } }, req);
  return ok({ id: r.id });
});

export const DELETE = handler(async (req) => {
  const session = await requireSession();
  await deleteResume(session.sub);
  await audit(session.sub, "resume_delete", { targetType: "resume", targetId: session.sub }, req);
  return ok({ deleted: true });
});

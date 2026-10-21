import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";
import { adminCreateMentor, adminListMentors, listPendingMentors } from "@/lib/mentorship/service";

/** GET — tasdiq kutayotgan arizalar; ?all=1 — barcha mentorlar (admin) */
export const GET = handler(async (req) => {
  await requireSession(["admin"]);
  if (new URL(req.url).searchParams.get("all") === "1") return ok({ items: await adminListMentors() });
  return ok({ items: await listPendingMentors() });
});

/** POST { userId } — foydalanuvchini to'g'ridan-to'g'ri mentor qilish (ariza shart emas) */
export const POST = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const { userId } = await parseBody(req, z.object({ userId: z.string().min(1).max(64) }));
  const res = await adminCreateMentor(userId);
  await audit(session.sub, "admin_mentor_create", { targetType: "user", targetId: userId }, req);
  if (res.created) await notify(userId, "account", "Siz mentor bo'ldingiz 🎓", "Mentorlik sahifangiz va kanalingiz tayyor — Kabinet → Mentorlik.", "/kabinet/mentorlik").catch(() => undefined);
  return ok(res, { status: res.created ? 201 : 200 });
});

import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { setMentorApproved } from "@/lib/mentorship/service";

type Ctx = { params: Promise<{ id: string }> };

/** POST { approve } — mentor arizasini tasdiqlash yoki rad etish (admin) */
export const POST = handler(async (req, ctx: Ctx) => {
  await requireSession(["admin"]);
  const { id } = await ctx.params;
  const { approve } = await parseBody(req, z.object({ approve: z.boolean() }));
  const { userId } = await setMentorApproved(id, approve);
  await notify(
    userId,
    "account",
    approve ? "Siz mentor sifatida tasdiqlandingiz 🎓" : "Mentorlik arizangiz qabul qilinmadi",
    approve ? "Endi kurs ochib, dars berishingiz mumkin — Kabinet → Mentorlik." : "Batafsil ma'lumot uchun qo'llab-quvvatlashga yozing.",
    approve ? "/kabinet/mentorlik" : "/mentorlik",
  ).catch(() => undefined);
  return ok({ ok: true });
});

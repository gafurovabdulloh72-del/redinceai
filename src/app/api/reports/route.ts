import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reports, reviews, specialists } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { reportSchema } from "@/lib/validators";
import { REPORT_REASONS } from "@/lib/constants";
import { enforceLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { notifyAdmins } from "@/lib/notifications";
import { uid } from "@/lib/utils";

/**
 * Profil yoki sharh haqida shikoyat (F85). Bitta foydalanuvchi bitta nishonga bir marta shikoyat qiladi;
 * o'z profili/sharhiga shikoyat qilib bo'lmaydi. Admin /admin sahifasidagi navbatda ko'radi.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, reportSchema);
  await enforceLimit("reports", session.sub);

  // Nishon mavjudligi va egaligi (IDOR: id klientdan keladi)
  let label: string;
  if (input.targetType === "specialist") {
    const sp = await db.query.specialists.findFirst({
      where: eq(specialists.id, input.targetId),
      columns: { id: true, userId: true },
      with: { user: { columns: { name: true } } },
    });
    if (!sp) throw new ApiError(404, "Profil topilmadi");
    if (sp.userId === session.sub) throw new ApiError(400, "O'z profilingizga shikoyat qila olmaysiz");
    label = sp.user.name;
  } else {
    const rv = await db.query.reviews.findFirst({
      where: eq(reviews.id, input.targetId),
      columns: { id: true, authorId: true },
      with: { author: { columns: { name: true } } },
    });
    if (!rv) throw new ApiError(404, "Sharh topilmadi");
    if (rv.authorId === session.sub) throw new ApiError(400, "O'z sharhingizga shikoyat qila olmaysiz");
    label = `${rv.author.name} sharhi`;
  }

  const dup = await db.query.reports.findFirst({
    where: and(eq(reports.reporterId, session.sub), eq(reports.targetType, input.targetType), eq(reports.targetId, input.targetId)),
    columns: { id: true },
  });
  if (dup) throw new ApiError(409, "Siz bu haqda allaqachon shikoyat qilgansiz — admin ko'rib chiqadi");

  // Admin jadvali `reason`ni o'zicha ko'rsatadi — o'qiladigan o'zbekcha matn saqlanadi
  const reasonLabel = REPORT_REASONS.find((r) => r.value === input.reason)?.label ?? input.reason;
  const note = input.text?.trim();
  const reason = note ? `${reasonLabel} — ${note}` : reasonLabel;

  const id = uid();
  await db.insert(reports).values({ id, reporterId: session.sub, targetType: input.targetType, targetId: input.targetId, reason });
  await audit(session.sub, "report_created", { targetType: input.targetType, targetId: input.targetId, meta: { reason: input.reason } }, req);
  // Admin shikoyatlar navbatiga olib boradi (nishon havolasi navbatning o'zida bor)
  await notifyAdmins("report", `Yangi shikoyat: ${label}`, reason.slice(0, 200), "/admin#shikoyatlar");
  return ok({ id }, { status: 201 });
});

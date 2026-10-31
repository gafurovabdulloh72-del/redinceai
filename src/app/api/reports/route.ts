import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { dmMessages, groupMessages, postComments, posts, reports, reviews, specialists, users, conversations } from "@/lib/db/schema";
import { or } from "drizzle-orm";
import { canViewGroupId } from "@/lib/groups/service";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { reportSchema } from "@/lib/validators";
import { REPORT_REASONS } from "@/lib/constants";
import { enforceLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { notifyAdmins } from "@/lib/notifications";
import { uid } from "@/lib/utils";

/**
 * Profil, sharh yoki foydalanuvchi (chat suhbatdoshi) haqida shikoyat (F85).
 * Bitta foydalanuvchi bitta nishonga bir marta shikoyat qiladi; o'ziga shikoyat qilib bo'lmaydi.
 * Admin /admin sahifasidagi navbatda ko'radi.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, reportSchema);
  await enforceLimit("reports", session.sub);

  // Nishon mavjudligi va egaligi (IDOR: id klientdan keladi)
  let label: string;
  if (input.targetType === "user") {
    if (input.targetId === session.sub) throw new ApiError(400, "O'zingizga shikoyat qila olmaysiz");
    const u = await db.query.users.findFirst({ where: eq(users.id, input.targetId), columns: { id: true, name: true } });
    if (!u) throw new ApiError(404, "Foydalanuvchi topilmadi");
    label = u.name;
  } else if (input.targetType === "specialist") {
    const sp = await db.query.specialists.findFirst({
      where: eq(specialists.id, input.targetId),
      columns: { id: true, userId: true },
      with: { user: { columns: { name: true } } },
    });
    if (!sp) throw new ApiError(404, "Profil topilmadi");
    if (sp.userId === session.sub) throw new ApiError(400, "O'z profilingizga shikoyat qila olmaysiz");
    label = sp.user.name;
  } else if (input.targetType === "post") {
    const p = await db.query.posts.findFirst({ where: eq(posts.id, input.targetId), columns: { id: true, authorId: true, groupId: true }, with: { author: { columns: { name: true } } } });
    if (!p) throw new ApiError(404, "Post topilmadi");
    if (p.authorId === session.sub) throw new ApiError(400, "O'z postingizga shikoyat qila olmaysiz");
    // Yopiq jamoa posti — faqat ko'ra oladiganlar (id taxmin qilib shikoyat yozib bo'lmasin)
    if (p.groupId) await canViewGroupId(p.groupId, { id: session.sub, role: session.role });
    label = `${p.author.name} posti`;
  } else if (input.targetType === "comment") {
    const c = await db.query.postComments.findFirst({ where: eq(postComments.id, input.targetId), columns: { id: true, authorId: true, postId: true }, with: { author: { columns: { name: true } }, post: { columns: { groupId: true } } } });
    if (!c) throw new ApiError(404, "Izoh topilmadi");
    if (c.authorId === session.sub) throw new ApiError(400, "O'z izohingizga shikoyat qila olmaysiz");
    if (c.post.groupId) await canViewGroupId(c.post.groupId, { id: session.sub, role: session.role });
    label = `${c.author.name} izohi`;
  } else if (input.targetType === "message") {
    // DM xabari — faqat shu suhbat ishtirokchisi; guruh xabari — faqat a'zo
    const dm = await db.query.dmMessages.findFirst({ where: eq(dmMessages.id, input.targetId), columns: { id: true, senderId: true, conversationId: true } });
    if (dm) {
      const conv = await db.query.conversations.findFirst({ where: and(eq(conversations.id, dm.conversationId), or(eq(conversations.aId, session.sub), eq(conversations.bId, session.sub))), columns: { id: true } });
      if (!conv) throw new ApiError(404, "Xabar topilmadi");
      if (dm.senderId === session.sub) throw new ApiError(400, "O'z xabaringizga shikoyat qila olmaysiz");
      const u = await db.query.users.findFirst({ where: eq(users.id, dm.senderId), columns: { name: true } });
      label = `${u?.name ?? "Foydalanuvchi"} xabari (chat)`;
    } else {
      const gm = await db.query.groupMessages.findFirst({ where: eq(groupMessages.id, input.targetId), columns: { id: true, senderId: true, groupId: true } });
      if (!gm) throw new ApiError(404, "Xabar topilmadi");
      if (gm.senderId === session.sub) throw new ApiError(400, "O'z xabaringizga shikoyat qila olmaysiz");
      await canViewGroupId(gm.groupId, { id: session.sub, role: session.role }, true);
      const u = await db.query.users.findFirst({ where: eq(users.id, gm.senderId), columns: { name: true } });
      label = `${u?.name ?? "Foydalanuvchi"} xabari (jamoa chati)`;
    }
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
  // Saytda — navbat havolasi; Telegramda — tugmalar bilan alohida xabar (admin boti), shuning uchun bu yerda tashqi kanal o'chiq
  await notifyAdmins("report", `Yangi shikoyat: ${label}`, reason.slice(0, 200), "/admin#shikoyatlar", { skipMail: true });
  const { notifyAdminsNewReport } = await import("@/lib/telegram-bot/admin");
  await notifyAdminsNewReport(id).catch(() => undefined);
  return ok({ id }, { status: 201 });
});

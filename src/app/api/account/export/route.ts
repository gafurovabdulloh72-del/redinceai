import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, favorites, notifications, orders, payments, payouts, portfolioItems, reviews, savedSearches, specialists, users } from "@/lib/db/schema";
import { ApiError, handler, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";

/**
 * Foydalanuvchining O'Z ma'lumotlari — JSON fayl (GDPR eksport). Faqat o'ziga tegishli yozuvlar:
 * hisob (parol hash'i, sessiya versiyasi yo'q), mutaxassis profili + portfolio, buyurtmalar (qarshi tomon —
 * faqat UI'da ko'rinadigan ism/slug), to'lovlar (provayder ichki ma'lumotlari yo'q), pul chiqarish (maskalangan
 * rekvizit), yozgan/olgan sharhlar, bildirishnomalar, sevimlilar, saqlangan qidiruvlar, oxirgi 200 ta o'z harakati.
 * Rate limit: 5 / soat.
 */
export const GET = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("accountExport", session.sub);

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.sub),
    columns: { passwordHash: false, sessionVersion: false },
    with: { specialist: { with: { portfolio: { orderBy: [portfolioItems.sortOrder] } } } },
  });
  if (!user) throw new ApiError(401, "Foydalanuvchi topilmadi");
  const sp = user.specialist;

  const [asClient, asSpecialist, pays, outs, written, received, notes, favs, searches, actions] = await Promise.all([
    db.query.orders.findMany({
      where: eq(orders.clientId, user.id),
      orderBy: [desc(orders.createdAt)],
      with: { specialist: { columns: { slug: true, title: true }, with: { user: { columns: { name: true } } } } },
    }),
    sp
      ? db.query.orders.findMany({ where: eq(orders.specialistId, sp.id), orderBy: [desc(orders.createdAt)], with: { client: { columns: { name: true } } } })
      : Promise.resolve([]),
    db.query.payments.findMany({
      where: sp ? or(eq(payments.clientId, user.id), eq(payments.specialistId, sp.id)) : eq(payments.clientId, user.id),
      orderBy: [desc(payments.createdAt)],
      columns: { id: true, orderId: true, amount: true, commissionPct: true, commissionAmount: true, netAmount: true, provider: true, state: true, paidAt: true, releasedAt: true, createdAt: true },
    }),
    sp
      ? db.query.payouts.findMany({
          where: eq(payouts.specialistId, sp.id),
          orderBy: [desc(payouts.createdAt)],
          columns: { id: true, amount: true, state: true, method: true, details: true, note: true, processedAt: true, createdAt: true },
        })
      : Promise.resolve([]),
    db.query.reviews.findMany({ where: eq(reviews.authorId, user.id), with: { specialist: { columns: { slug: true, title: true } } } }),
    sp ? db.query.reviews.findMany({ where: eq(reviews.specialistId, sp.id), with: { author: { columns: { name: true } } } }) : Promise.resolve([]),
    db.query.notifications.findMany({ where: eq(notifications.userId, user.id), orderBy: [desc(notifications.createdAt)] }),
    db
      .select({ specialistId: favorites.specialistId, slug: specialists.slug, title: specialists.title, createdAt: favorites.createdAt })
      .from(favorites)
      .innerJoin(specialists, eq(specialists.id, favorites.specialistId))
      .where(eq(favorites.userId, user.id)),
    db.query.savedSearches.findMany({ where: eq(savedSearches.userId, user.id) }),
    db.query.auditLogs.findMany({
      where: and(eq(auditLogs.actorId, user.id), inArray(auditLogs.action, ["login_success", "login_failed", "register", "logout", "logout_all", "password_changed", "password_reset", "email_verified", "account_export"])),
      orderBy: [desc(auditLogs.createdAt)],
      limit: 200,
      columns: { action: true, ip: true, createdAt: true },
    }),
  ]);

  const data = {
    exportedAt: new Date().toISOString(),
    user: { ...user, specialist: undefined },
    specialist: sp ? { ...sp, portfolio: sp.portfolio } : null,
    orders: {
      asClient: asClient.map((o) => ({ ...o, specialist: { slug: o.specialist.slug, title: o.specialist.title, name: o.specialist.user.name } })),
      asSpecialist: asSpecialist.map((o) => ({ ...o, client: { name: o.client.name } })),
    },
    payments: pays,
    payouts: outs,
    reviews: {
      written: written.map((r) => ({ id: r.id, rating: r.rating, text: r.text, reply: r.reply, createdAt: r.createdAt, specialist: r.specialist })),
      received: received.map((r) => ({ id: r.id, rating: r.rating, text: r.text, reply: r.reply, replyAt: r.replyAt, createdAt: r.createdAt, author: r.author.name })),
    },
    notifications: notes,
    favorites: favs,
    savedSearches: searches,
    activity: actions,
  };

  await audit(user.id, "account_export", { targetType: "user", targetId: user.id }, req);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="redince-export-${stamp}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
});

import { and, eq, inArray, like, ne, notLike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, orders, payments, specialists, users } from "@/lib/db/schema";
import { handler, ok, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";

/**
 * Admin: demo (seed) ma'lumotlarini bir tugmada tozalash — launch oldidan.
 * Seed yozuvlarining id'si "seed-" bilan boshlanadi. Seed'dan qolgan eski adminlar ham o'chadi —
 * joriy admin (siz) va ADMIN_EMAIL hisobi esa hech qachon o'chmaydi.
 * MUHIM: haqiqiy (seed bo'lmagan) foydalanuvchi bilan buyurtma/to'lov/suhbat bog'langan seed hisoblar
 * O'CHIRILMAYDI (kaskad haqiqiy ma'lumotni ham o'chirib yuborar edi) — ular `kept` sonida qaytadi.
 * Qolganlari o'chganda specialists, orders, payments, reviews, jobs va h.k. kaskad orqali o'chadi
 * (sxemadagi onDelete: cascade — xuddi admin profil o'chirishdagi kabi).
 */
function seedWhere(sessionSub: string, adminEmail: string) {
  return and(
    like(users.id, "seed-%"),
    ne(users.id, sessionSub),
    adminEmail ? ne(sql`lower(${users.email})`, adminEmail) : undefined,
    // Demo hisoblar (kirish sahifasidagi tugmalar) dev'da kerak — productionda ular ham seed, baribir o'chadi
    or(ne(users.role, "admin"), like(users.email, "%@redince.uz")),
  );
}

/** Haqiqiy foydalanuvchi bilan bog'langan seed hisoblar — o'chirilmaydiganlar to'plami */
async function dirtySeedUserIds(ids: string[]): Promise<Set<string>> {
  const dirty = new Set<string>();
  if (!ids.length) return dirty;
  // Buyurtmalar: seed mijoz ↔ haqiqiy mutaxassis yoki haqiqiy mijoz ↔ seed mutaxassis
  const orderClient = await db
    .select({ id: orders.clientId })
    .from(orders)
    .innerJoin(specialists, eq(orders.specialistId, specialists.id))
    .where(and(inArray(orders.clientId, ids), notLike(specialists.userId, "seed-%")));
  const orderSpecialist = await db
    .select({ id: specialists.userId })
    .from(orders)
    .innerJoin(specialists, eq(orders.specialistId, specialists.id))
    .where(and(inArray(specialists.userId, ids), notLike(orders.clientId, "seed-%")));
  // To'lovlar: pul izi hech qachon kaskadda yo'qolmasin
  const paymentClient = await db
    .select({ id: payments.clientId })
    .from(payments)
    .innerJoin(specialists, eq(payments.specialistId, specialists.id))
    .where(and(inArray(payments.clientId, ids), notLike(specialists.userId, "seed-%")));
  const paymentSpecialist = await db
    .select({ id: specialists.userId })
    .from(payments)
    .innerJoin(specialists, eq(payments.specialistId, specialists.id))
    .where(and(inArray(specialists.userId, ids), notLike(payments.clientId, "seed-%")));
  // Suhbatlar (DM): haqiqiy foydalanuvchi bilan yozishmalar saqlanadi
  const convA = await db
    .select({ id: conversations.aId })
    .from(conversations)
    .where(and(inArray(conversations.aId, ids), notLike(conversations.bId, "seed-%")));
  const convB = await db
    .select({ id: conversations.bId })
    .from(conversations)
    .where(and(inArray(conversations.bId, ids), notLike(conversations.aId, "seed-%")));
  for (const r of [...orderClient, ...orderSpecialist, ...paymentClient, ...paymentSpecialist, ...convA, ...convB]) dirty.add(r.id);
  return dirty;
}

export const POST = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
  const where = seedWhere(session.sub, adminEmail);
  const candidates = await db.select({ id: users.id }).from(users).where(where);
  const ids = candidates.map((c) => c.id);
  const dirty = await dirtySeedUserIds(ids);
  const clean = ids.filter((id) => !dirty.has(id));
  if (clean.length) await db.delete(users).where(inArray(users.id, clean));
  await audit(session.sub, "admin_demo_clean", { targetType: "platform", targetId: "demo", meta: { removedUsers: clean.length, keptUsers: dirty.size } }, req);
  // `removed` — eski UI uchun; `deleted`/`kept` — yangi maydonlar
  return ok({ removed: clean.length, deleted: clean.length, kept: dirty.size });
});

/** Nechta demo yozuv borligini ko'rsatish uchun */
export const GET = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
  void req;
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(users)
    .where(seedWhere(session.sub, adminEmail));
  return ok({ count: Number(n) });
});

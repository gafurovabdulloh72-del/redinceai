import { and, like, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { handler, ok, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";

/**
 * Admin: demo (seed) ma'lumotlarini bir tugmada tozalash — launch oldidan.
 * Seed yozuvlarining id'si "seed-" bilan boshlanadi; admin roli saqlanadi.
 * users o'chishi bilan specialists, orders, payments, reviews, jobs va h.k. kaskad orqali o'chadi
 * (sxemadagi onDelete: cascade — xuddi admin profil o'chirishdagi kabi).
 */
export const POST = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const where = and(like(users.id, "seed-%"), ne(users.role, "admin"));
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(users).where(where);
  await db.delete(users).where(where);
  await audit(session.sub, "admin_demo_clean", { targetType: "platform", targetId: "demo", meta: { removedUsers: Number(n) } }, req);
  return ok({ removed: Number(n) });
});

/** Nechta demo yozuv borligini ko'rsatish uchun */
export const GET = handler(async () => {
  await requireSession(["admin"]);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(users)
    .where(and(like(users.id, "seed-%"), ne(users.role, "admin")));
  return ok({ count: Number(n) });
});

import "server-only";
import { and, eq, gt, inArray, isNotNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, orders, users } from "@/lib/db/schema";

/**
 * SHARH ISHONCHLILIGI (7-audit, 2026-11-10).
 *
 * Muammo: buyurtmani mutaxassisning o'zi «bajarildi» qila oladi (to'lovsiz ham), sharh uchun esa bitta «done» buyurtma kifoya.
 * Demak ikki hisob ochgan odam (o'zi «mijoz», o'zi «ijodkor») bir necha soxta mijoz bilan 5 yulduzli sharhlar yig'ib,
 * reytingni va «Top mutaxassis» nishonini sotib olmasdan qo'lga kiritardi.
 *
 * Yechim — yumshoq: sharh RAD ETILMAYDI (haqiqiy mijoz ham yangi hisobdan yozishi mumkin), lekin quyidagi belgilardan biri
 * bo'lsa `suspect` deb saqlanadi: ko'rinadi, ammo reyting/nishon hisobiga kirmaydi va adminga xabar ketadi (admin tasdiqlaydi
 * yoki o'chiradi). Platforma orqali TO'LANGAN buyurtma — eng kuchli dalil: bunday sharh hech qachon shubhali emas.
 */
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

export async function reviewSuspicion(authorId: string, specialist: { id: string; userId: string }): Promise<string | null> {
  const list = await db.query.orders.findMany({
    where: and(eq(orders.clientId, authorId), eq(orders.specialistId, specialist.id), eq(orders.status, "done")),
    columns: { id: true, paymentState: true, createdAt: true },
  });
  // Platforma orqali to'langan (eskrou) buyurtma — haqiqiy mijoz
  if (list.some((o) => o.paymentState === "paid" || o.paymentState === "released")) return null;

  const author = await db.query.users.findFirst({ where: eq(users.id, authorId), columns: { createdAt: true } });
  if (!author) return "muallif topilmadi";
  const now = Date.now();
  if (now - author.createdAt.getTime() < DAY) return "hisob 24 soatdan yosh va to'lov platformadan o'tmagan";
  const oldest = Math.min(...list.map((o) => o.createdAt.getTime()));
  if (Number.isFinite(oldest) && now - oldest < HOUR) return "buyurtma ochilganiga 1 soat bo'lmagan (to'lovsiz)";

  // Bitta odam ikki hisobdan: so'nggi 30 kunda muallif va mutaxassis bir xil IP'dan kirgan/ro'yxatdan o'tgan
  try {
    const since = new Date(now - 30 * DAY);
    const mine = await db
      .selectDistinct({ ip: auditLogs.ip })
      .from(auditLogs)
      .where(and(eq(auditLogs.actorId, authorId), isNotNull(auditLogs.ip), gt(auditLogs.createdAt, since), or(eq(auditLogs.action, "login_success"), eq(auditLogs.action, "register"))))
      .limit(40);
    const ips = mine.map((r) => r.ip).filter((ip): ip is string => Boolean(ip) && !String(ip).startsWith("unknown"));
    if (ips.length) {
      const same = await db.query.auditLogs.findFirst({
        where: and(eq(auditLogs.actorId, specialist.userId), inArray(auditLogs.ip, ips), gt(auditLogs.createdAt, since)),
        columns: { id: true },
      });
      if (same) return "muallif va mutaxassis bir xil IP manzildan kirgan";
    }
  } catch {
    /* audit jurnali o'qilmasa — bu belgi tekshirilmaydi */
  }
  return null;
}

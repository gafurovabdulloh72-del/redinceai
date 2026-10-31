import { eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";
import { AUDIENCES, channelStat, sendBroadcast, type AudienceRow } from "@/lib/broadcast";

/**
 * Admin: ommaviy e'lon/eslatma — barcha (yoki rolga ko'ra) foydalanuvchilarga bir vaqtda.
 * Har bir qabul qiluvchiga saytdagi bildirishnoma + Telegram (ulangan bo'lsa); email ixtiyoriy
 * (forceMail) — notifyEmail=false qilganlarga baribir bormaydi. Adminlarga va bloklanganlarga yuborilmaydi.
 */

const schema = z.object({
  title: z.string().trim().min(4, "Sarlavha juda qisqa").max(120, "Ko'pi bilan 120 belgi"),
  body: z.string().trim().min(10, "Matn juda qisqa (kamida 10 belgi)").max(600, "Ko'pi bilan 600 belgi"),
  /** Ixtiyoriy havola: sayt ichida (/narxlar) yoki tashqi https:// manzil (masalan, Telegram kanal) */
  href: z
    .string()
    .trim()
    .max(200)
    .regex(/^(\/(?!\/)|https:\/\/\S+$)/, "Sayt ichidagi yo'l (\"/\" bilan) yoki https:// havola kiriting")
    .optional()
    .or(z.literal("")),
  audience: z.enum(AUDIENCES),
  /** true — email ham yuboriladi (Resend kvotasini hisobga oling) */
  email: z.boolean().optional().default(false),
  /** true — auditoriyaga emas, FAQAT yuborayotgan adminning o'ziga sinov nusxasi */
  test: z.boolean().optional().default(false),
});

/** Auditoriya hajmi + kanal kesimi — UI'da "nechta odamga qaysi kanal orqali boradi" uchun */
export const GET = handler(async () => {
  await requireSession(["admin"]);
  const rows: AudienceRow[] = await db
    .select({ id: users.id, role: users.role, banned: users.isBanned, tg: users.telegramChatId, mail: users.notifyEmail, email: users.email })
    .from(users)
    .where(ne(users.role, "admin"));
  const active = rows.filter((r) => !r.banned);
  // So'nggi e'lonlar: nechta qo'ng'iroqchaga yozilgani va nechtasi saytda o'qilgani — "yetib bordimi" savoliga javob
  const recent = await db
    .select({
      title: notifications.title,
      total: sql<number>`count(*)`,
      readCount: sql<number>`sum(case when ${notifications.readAt} is not null then 1 else 0 end)`,
      at: sql<number>`max(${notifications.createdAt})`,
    })
    .from(notifications)
    .where(eq(notifications.type, "broadcast"))
    .groupBy(notifications.title)
    .orderBy(sql`max(${notifications.createdAt}) desc`)
    .limit(3);
  return ok({
    recent,
    all: channelStat(active),
    specialists: channelStat(active.filter((r) => r.role === "specialist")),
    clients: channelStat(active.filter((r) => r.role === "client")),
    /** Email kanali sozlanganmi (Resend) — bo'lmasa UI katakchani o'chirib, sababini aytadi */
    emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM),
    telegramEnabled: Boolean(process.env.TELEGRAM_BOT_TOKEN),
  });
});

export const POST = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const input = await parseBody(req, schema);
  const href = input.href || null;

  // Sinov rejimi: xabar auditoriyaga emas, faqat adminning o'ziga (ommaviy yuborishda adminlar chetlab o'tiladi)
  if (input.test) {
    await notify(session.sub, "broadcast", input.title, input.body, href, { forceMail: input.email });
    await audit(session.sub, "admin_broadcast", { meta: { test: true, email: input.email, title: input.title } }, req);
    return ok({ sent: 1, test: true });
  }

  const r = await sendBroadcast({ title: input.title, body: input.body, href, audience: input.audience, email: input.email }, session.sub, "admin", req);
  if (r.sent === 0) throw new ApiError(400, "Auditoriya bo'sh — yuboriladigan foydalanuvchi yo'q");
  const { sent, channels } = r;
  return ok({ sent, audience: input.audience, email: input.email, channels });
});

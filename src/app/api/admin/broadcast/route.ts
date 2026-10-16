import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";

/**
 * Admin: ommaviy e'lon/eslatma — barcha (yoki rolga ko'ra) foydalanuvchilarga bir vaqtda.
 * Har bir qabul qiluvchiga saytdagi bildirishnoma + Telegram (ulangan bo'lsa); email ixtiyoriy
 * (forceMail) — notifyEmail=false qilganlarga baribir bormaydi. Adminlarga va bloklanganlarga yuborilmaydi.
 */

const AUDIENCES = ["all", "specialists", "clients"] as const;
type Audience = (typeof AUDIENCES)[number];

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

function audienceWhere(a: Audience) {
  const base = and(eq(users.isBanned, false), ne(users.role, "admin"))!;
  if (a === "specialists") return and(base, eq(users.role, "specialist"))!;
  if (a === "clients") return and(base, eq(users.role, "client"))!;
  return base;
}

/** O'chirilgan (anonimlashtirilgan) hisob — email kanalida sanalmaydi (notifications.ts bilan bir xil qoida) */
const DELETED_EMAIL_RE = /^deleted-.*@redince\.invalid$/i;

interface AudienceRow {
  role: string;
  banned: boolean;
  tg: string | null;
  mail: boolean;
  email: string | null;
}

/** Auditoriyaning kanal kesimi: sayt (hammaga), Telegram (botni ulaganlar), email (yoqilganlar) */
function channelStat(list: AudienceRow[]) {
  return {
    total: list.length,
    telegram: process.env.TELEGRAM_BOT_TOKEN ? list.filter((r) => r.tg).length : 0,
    email: list.filter((r) => r.mail && r.email && !DELETED_EMAIL_RE.test(r.email)).length,
  };
}

/** Auditoriya hajmi + kanal kesimi — UI'da "nechta odamga qaysi kanal orqali boradi" uchun */
export const GET = handler(async () => {
  await requireSession(["admin"]);
  const rows: AudienceRow[] = await db
    .select({ role: users.role, banned: users.isBanned, tg: users.telegramChatId, mail: users.notifyEmail, email: users.email })
    .from(users)
    .where(ne(users.role, "admin"));
  const active = rows.filter((r) => !r.banned);
  return ok({
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

  const targets = await db
    .select({ id: users.id, role: users.role, banned: users.isBanned, tg: users.telegramChatId, mail: users.notifyEmail, email: users.email })
    .from(users)
    .where(audienceWhere(input.audience));
  if (targets.length === 0) throw new ApiError(400, "Auditoriya bo'sh — yuboriladigan foydalanuvchi yo'q");

  // Hozirgi masshtabda (yuzlab foydalanuvchi) 20 talik guruhlar bilan ketma-ket yuborish yetarli.
  // Minglab bo'lganda navbat (queue)ga o'tkazish kerak bo'ladi — kunlik cron shunga tayyor joy.
  let sent = 0;
  for (let i = 0; i < targets.length; i += 20) {
    const chunk = targets.slice(i, i + 20);
    await Promise.all(chunk.map((u) => notify(u.id, "broadcast", input.title, input.body, href, { forceMail: input.email })));
    sent += chunk.length;
  }

  // Kanal kesimi — "hammasi yuborilganini" admin aniq ko'rsin: sayt hammaga, Telegram ulaganlarga, email yoqilganlarga
  const st = channelStat(targets);
  const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
  const channels = { site: sent, telegram: st.telegram, email: input.email && emailConfigured ? st.email : 0 };

  await audit(session.sub, "admin_broadcast", { meta: { audience: input.audience, sent, email: input.email, title: input.title, channels } }, req);
  return ok({ sent, audience: input.audience, email: input.email, channels });
});

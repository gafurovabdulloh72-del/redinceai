import { eq } from "drizzle-orm";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { adminSendPasswordReset } from "@/lib/admin/user-tools";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";
import { siteUrl } from "@/lib/security/site";

type Ctx = { params: Promise<{ id: string }> };

const REASON: Record<string, string> = {
  not_configured: "Email xizmati sozlanmagan (RESEND_API_KEY / MAIL_FROM) va foydalanuvchiga Telegram ulanmagan",
  no_real_email: "Hisob Telegram orqali ochilgan (haqiqiy email yo'q) va Telegram boti ishlamayapti yoki chat uzilgan",
  network: "Email xizmatiga ulanib bo'lmadi",
};

/**
 * Admin: parol tiklash havolasini foydalanuvchiga yuborish (kira olmayotgan foydalanuvchi murojaat qilganda).
 * Mavjud tiklash oqimi: 1 soatlik bir martalik token, havola FAQAT ishonchli sayt manzilidan (SITE_URL) tuziladi va
 * faqat foydalanuvchining o'z emaili (bo'lmasa ulangan Telegrami)ga ketadi — javobda token/havola YO'Q.
 * Limit: bitta foydalanuvchiga soatiga 5 ta (xat bombardimoniga qarshi).
 */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const user = await db.query.users.findFirst({ where: eq(users.id, id), columns: { id: true, name: true, isBanned: true } });
  if (!user) throw new ApiError(404, "Foydalanuvchi topilmadi");
  if (user.isBanned) throw new ApiError(400, "Bloklangan foydalanuvchiga havola yuborilmaydi — avval blokdan chiqaring");
  await enforceLimit("adminReset", id);
  const base = siteUrl(req);
  if (!base) throw new ApiError(503, "Sayt manzili (SITE_URL) sozlanmagan — havola tuzib bo'lmaydi");

  const res = await adminSendPasswordReset(id, base);
  await audit(session.sub, "admin_password_reset_sent", { targetType: "user", targetId: id, meta: { name: user.name, sent: res.sent, channel: res.channel ?? undefined, reason: res.reason } }, req);
  if (!res.sent) {
    const why = (res.reason && (REASON[res.reason] ?? REASON[res.reason.split("+")[0]])) || "Havolani yuborib bo'lmadi";
    throw new ApiError(502, `${why} — havola yuborilmadi`);
  }
  return ok({ sent: true, channel: res.channel });
});

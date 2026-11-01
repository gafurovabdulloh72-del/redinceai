import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";
import { siteUrl } from "@/lib/security/site";
import { createPasswordReset } from "@/lib/security/tokens";
import { isTelegramEnabled, sendTelegram } from "@/lib/telegram";

export const runtime = "nodejs";

/**
 * Parol o'rnatish havolasini foydalanuvchining O'Z Telegramiga yuborish (3-audit, 2026-11-01).
 * Telegram/bot orqali ochilgan hisobda parol tasodifiy va email `tg…@telegram.local` (xat bormaydi) —
 * egasi parolni bilmagani uchun email o'zgartirish va hisobni o'chirish (joriy parol talab qiladi) qulflangan edi.
 * Havola faqat hisobga ulangan Telegram chatiga ketadi — o'g'irlangan sessiya egasi uni KO'RA OLMAYDI
 * (javobda token yo'q). Token mavjud tiklash oqimi bilan bir xil: 1 soat, bir martalik, sha256 bazada;
 * parol o'rnatilganda boshqa sessiyalar yopiladi va egaga xabar ketadi (reset/confirm).
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  if (!isTelegramEnabled()) throw new ApiError(503, "Telegram bot sozlanmagan");
  await enforceLimit("reset", session.sub);
  const user = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { id: true, telegramChatId: true } });
  if (!user?.telegramChatId) throw new ApiError(400, "Hisobingizga Telegram ulanmagan. Avval Kabinet → Profil'da Telegramni ulang");
  const base = siteUrl(req);
  if (!base) throw new ApiError(503, "Sayt manzili sozlanmagan");
  const { token } = await createPasswordReset(user.id);
  const chatId = user.telegramChatId;
  after(async () => {
    try {
      const sent = await sendTelegram(
        chatId,
        "🔑 <b>Yangi parol o'rnatish</b>\nSaytdagi hisobingiz uchun parol o'rnatish so'raldi. Havola 1 soat amal qiladi va bir marta ishlaydi.\n\n⚠️ Buni siz so'ramagan bo'lsangiz — tugmani bosmang va saytda Kabinet → Xavfsizlik'da «Barcha qurilmalardan chiqish»ni bosing.",
        { button: { text: "🔑 Yangi parol o'rnatish", url: `${base}/auth/parol-tiklash/${token}` } },
      );
      await audit(user.id, "password_reset_requested", { targetType: "user", targetId: user.id, meta: { via: "telegram", sent } }, req);
    } catch (e) {
      console.error("[auth] telegram parol havolasi", e);
    }
  });
  return ok({ sent: true });
});

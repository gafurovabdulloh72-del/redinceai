import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { notify, type NotificationType } from "@/lib/notifications";
import { SITE_URL } from "@/lib/site-url";
import { escapeTelegramHtml, isTelegramEnabled, sendTelegram, type TelegramButton } from "@/lib/telegram";

/**
 * Qo'lda o'tkazma tasdiqlash oqimi: foydalanuvchi «To'ladim» bosganda adminlarga
 * saytdagi bildirishnoma + Telegramda "✅ Tasdiqlash / ❌ Rad etish" tugmalari ketadi.
 * Tugma bosilishi webhook'da (callback_query, `mp:<ok|no>:<p|s>:<id>`) qayta ishlanadi —
 * admin saytga kirmasdan bir bosishda hal qiladi.
 */

/** p — buyurtma to'lovi (payments), s — obuna hisobi (subscription_invoices) */
export type ApprovalKind = "pay" | "sub";

/**
 * Sayt manzili — umumiy `SITE_URL` orqali (NEXT_PUBLIC_SITE_URL → SITE_URL → VERCEL_URL).
 * DIQQAT: ilgari bu yerda FAQAT `process.env.NEXT_PUBLIC_SITE_URL` o'qilardi. Prod'da esa
 * `SITE_URL` qo'yilgan, `NEXT_PUBLIC_SITE_URL` yo'q — natijada `absoluteUrl()` doim null
 * qaytarib, adminning Telegramidagi «Admin panel» va «Chek» tugmalari chizilmay qolardi
 * (qo'lda o'tkazmani tasdiqlash uchun saytga alohida kirishga to'g'ri kelardi).
 */
function siteOrigin(): string {
  const base = SITE_URL.trim().replace(/\/$/, "");
  // Lokal dev manzili Telegram tugmasiga yaramaydi (faqat https qabul qilinadi)
  return base.startsWith("https://") ? base : "";
}

/** Mutlaq URL: https bo'lsa o'zi, /yo'l bo'lsa sayt manzili bilan (manzil noma'lum bo'lsa null) */
function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("https://")) return url;
  const origin = siteOrigin();
  return origin && url.startsWith("/") && !url.startsWith("//") ? `${origin}${url}` : null;
}

export async function notifyAdminsManualPending(opts: {
  kind: ApprovalKind;
  type: NotificationType;
  /** payments.id yoki subscription_invoices.id (UUID — callback_data 64 baytga sig'adi) */
  id: string;
  title: string;
  body: string;
  /** Admin paneldagi tegishli bo'lim (ichki /yo'l) */
  href: string;
  receiptUrl?: string | null;
}): Promise<void> {
  try {
    const admins = await db.query.users.findMany({ where: eq(users.role, "admin"), columns: { id: true, telegramChatId: true } });
    const k = opts.kind === "pay" ? "p" : "s";
    const receipt = absoluteUrl(opts.receiptUrl);
    const panel = absoluteUrl(opts.href);
    const body = opts.body + (opts.receiptUrl ? " Chek biriktirilgan." : "");
    await Promise.all(
      admins.map(async (a) => {
        // Sayt qo'ng'irog'i — skipMail: Telegram quyida tugmali maxsus xabar bilan ketadi (ikki marta bormasin)
        await notify(a.id, opts.type, opts.title, body, opts.href, { skipMail: true });
        if (!isTelegramEnabled() || !a.telegramChatId) return;
        const keyboard: TelegramButton[][] = [
          [
            { text: "✅ Tasdiqlash", data: `mp:ok:${k}:${opts.id}` },
            { text: "❌ Rad etish", data: `mp:no:${k}:${opts.id}` },
          ],
        ];
        if (receipt) keyboard.push([{ text: "🧾 Chekni ko'rish", url: receipt }]);
        if (panel) keyboard.push([{ text: "Saytda ochish", url: panel }]);
        await sendTelegram(a.telegramChatId, `<b>${escapeTelegramHtml(opts.title)}</b>\n${escapeTelegramHtml(body)}`, { keyboard });
      }),
    );
  } catch (e) {
    // Bildirishnoma xatosi to'lov oqimini buzmasin
    console.error("[manual-approval:notify]", e);
  }
}

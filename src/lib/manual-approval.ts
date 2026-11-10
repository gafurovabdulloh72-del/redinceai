import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { localizeNotification, notify, type NotificationType } from "@/lib/notifications";
import { SITE_URL } from "@/lib/site-url";
import { escapeTelegramHtml, isTelegramEnabled, sendTelegram, type TelegramButton } from "@/lib/telegram";
import { L, type BotLang } from "@/lib/telegram-bot/lang";
import { pageButton } from "@/lib/telegram-bot/ui";

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
    const admins = await db.query.users.findMany({ where: eq(users.role, "admin"), columns: { id: true, telegramChatId: true, lang: true, isBanned: true } });
    const k = opts.kind === "pay" ? "p" : "s";
    const receipt = absoluteUrl(opts.receiptUrl);
    const body = opts.body + (opts.receiptUrl ? " Chek biriktirilgan." : "");
    // Rus tilidagi adminga sarlavha/matn ruscha (bildirishnomalar bilan bir xil yo'l) — bir marta hisoblanadi
    let ru: { title: string; body: string | null | undefined } | null = null;
    await Promise.all(
      admins.map(async (a) => {
        // Sayt qo'ng'irog'i — siteOnly: Telegram quyida tugmali maxsus xabar bilan ketadi (ikki marta bormasin)
        await notify(a.id, opts.type, opts.title, body, opts.href, { siteOnly: true });
        if (!isTelegramEnabled() || !a.telegramChatId || a.isBanned) return;
        const lang: BotLang = a.lang === "ru" ? "ru" : "uz";
        const t = lang === "ru" ? (ru ??= await localizeNotification(opts.title, body)) : { title: opts.title, body };
        const keyboard: TelegramButton[][] = [
          [
            { text: L(lang, "✅ Tasdiqlash", "✅ Подтвердить"), data: `mp:ok:${k}:${opts.id}` },
            { text: L(lang, "❌ Rad etish", "❌ Отклонить"), data: `mp:no:${k}:${opts.id}` },
          ],
        ];
        if (receipt) keyboard.push([{ text: L(lang, "🧾 Chekni ko'rish", "🧾 Посмотреть чек"), url: receipt }]);
        // Admin panel — Mini App tugmasi (https bo'lsa): Telegram ichida ochiladi, qayta kirish shart emas
        if (opts.href.startsWith("/") && siteOrigin()) keyboard.push([pageButton(L(lang, "Admin panelda ochish", "Открыть в админ-панели"), opts.href)]);
        await sendTelegram(a.telegramChatId, `<b>${escapeTelegramHtml(t.title)}</b>\n${escapeTelegramHtml(t.body ?? "")}`, { keyboard, bulk: true });
      }),
    );
  } catch (e) {
    // Bildirishnoma xatosi to'lov oqimini buzmasin
    console.error("[manual-approval:notify]", e);
  }
}

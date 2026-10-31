import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { isProviderConfigured, siteOrigin } from "@/lib/payments/config";
import { buildInvoiceRedirectUrl, manualRequisites } from "@/lib/subscriptions/billing";
import { escapeTelegramHtml, sendTelegram, type TelegramButton } from "@/lib/telegram";
import { formatPrice } from "@/lib/utils";
import { contactHref, quoteContact, startContactUnlock } from "@/lib/contacts/unlock";
import { appUrl } from "@/lib/telegram-bot/app-url";

/**
 * KONTAKTNI TELEGRAMDA TO'LASH (2026-10-31): saytdagi «Telegramda to'lash» → `t.me/<bot>?start=b_x_<specialistId>` →
 * bot narx + usul tugmalari (`cx:<p|c|m|f>:<id>`) → `startContactUnlock` (mavjud hisob tizimi) → Payme/Click havolasi yoki
 * karta rekvizitlari + chek rasmi (handleReceiptPhoto kontakt hisoblarini ham qabul qiladi) → admin tasdiqlaydi → ochiladi.
 */
async function userByChat(chatId: string) {
  return db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, name: true, isBanned: true } });
}

/** `/start b_x_<specialistId>` — narx va to'lov usullari */
export async function handleContactBuyStart(chatId: string, payload: string): Promise<boolean> {
  const m = /^b_x_([\w-]{1,48})$/.exec(payload);
  if (!m) return false;
  const user = await userByChat(chatId);
  if (!user || user.isBanned) {
    await sendTelegram(chatId, "Kontaktni ochish uchun avval hisobga kiring: /start → «Ha, akkauntim bor» yoki ro'yxatdan o'ting, so'ng saytdagi tugmani qayta bosing.");
    return true;
  }
  try {
    const q = await quoteContact(m[1], user.id);
    if (q.unlocked) {
      await sendTelegram(chatId, `🔓 <b>${escapeTelegramHtml(q.title)}</b> allaqachon ochilgan — /kontaktlarim`);
      return true;
    }
    const keyboard: TelegramButton[][] = [];
    if (q.amount <= 0) keyboard.push([{ text: "🎁 Bepul ochish", data: `cx:f:${m[1]}` }]);
    else {
      const row: TelegramButton[] = [];
      if (await isProviderConfigured("payme")) row.push({ text: "Payme", data: `cx:p:${m[1]}` });
      if (await isProviderConfigured("click")) row.push({ text: "Click", data: `cx:c:${m[1]}` });
      if (row.length) keyboard.push(row);
      if (await isProviderConfigured("manual")) keyboard.push([{ text: "💳 Karta o'tkazmasi", data: `cx:m:${m[1]}` }]);
      if (!keyboard.length) {
        await sendTelegram(chatId, "To'lov usullari hozircha ulanmagan — administrator bilan bog'laning.");
        return true;
      }
    }
    await sendTelegram(chatId, `🔓 <b>${escapeTelegramHtml(q.title)}</b>\nTelefon, Telegram, Instagram va email — to'lovdan so'ng ochiladi.\nNarx: <b>${q.amount <= 0 ? "Bepul" : formatPrice(q.amount)}</b>\n\nTo'lov usulini tanlang:`, { keyboard });
  } catch (e) {
    await sendTelegram(chatId, e instanceof ApiError ? `⚠️ ${escapeTelegramHtml(e.message)}` : "Xatolik. Keyinroq qayta urinib ko'ring.");
  }
  return true;
}

/** `cx:<p|c|m|f>:<specialistId>` */
export async function handleContactPayCallback(chatId: string, data: string, answer: (t: string) => Promise<unknown>): Promise<boolean> {
  const m = /^cx:([pcmf]):([\w-]{1,48})$/.exec(data);
  if (!m) return false;
  const user = await userByChat(chatId);
  if (!user || user.isBanned) {
    await answer("Avval hisobga kiring");
    return true;
  }
  const provider = m[1] === "p" ? "payme" : m[1] === "c" ? "click" : "manual";
  try {
    const r = await startContactUnlock({ id: user.id }, m[2], provider);
    if (r.free) {
      await answer("Ochildi ✓");
      await sendTelegram(chatId, "🎉 Kontakt ochildi — /kontaktlarim");
      return true;
    }
    const inv = r.invoice;
    await answer("Hisob tayyor");
    const origin = siteOrigin();
    const back = appUrl(contactHref(inv.id));
    const backBtn: TelegramButton = back ? { text: "Holatni ko'rish", webApp: back } : { text: "Holatni ko'rish", url: `${origin}${contactHref(inv.id)}` };
    if (provider === "manual") {
      const req = await manualRequisites();
      await sendTelegram(
        chatId,
        `💳 <b>Karta o'tkazmasi</b>\nSumma: <b>${formatPrice(inv.amount)}</b>\nKarta: <code>${escapeTelegramHtml(req?.card ?? "—")}</code>\nQabul qiluvchi: ${escapeTelegramHtml(req?.name ?? "—")}\n\nO'tkazgach <b>chek rasmini (skrinshot) shu yerga yuboring</b> — administrator tasdiqlagach kontakt avtomatik ochiladi va shu yerga keladi.`,
        { keyboard: [[{ text: "Chek yubora olmayman — «To'ladim»", data: `bd:${inv.id}` }], [backBtn]] },
      );
      return true;
    }
    const url = buildInvoiceRedirectUrl(inv, origin);
    if (!url) throw new ApiError(400, "To'lov havolasini tuzib bo'lmadi");
    await sendTelegram(chatId, `${provider === "payme" ? "Payme" : "Click"} orqali <b>${formatPrice(inv.amount)}</b> to'lang. To'langach kontakt avtomatik ochiladi va shu yerga xabar keladi.`, { keyboard: [[{ text: "To'lash", url }], [backBtn]] });
  } catch (e) {
    await answer(e instanceof ApiError ? e.message.slice(0, 180) : "Xatolik");
  }
  return true;
}

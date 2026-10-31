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
import { L, type BotLang } from "@/lib/telegram-bot/lang";

/**
 * KONTAKTNI TELEGRAMDA TO'LASH (2026-10-31): saytdagi «Telegramda to'lash» → `t.me/<bot>?start=b_x_<specialistId>` →
 * bot narx + usul tugmalari (`cx:<p|c|m|f>:<id>`) → `startContactUnlock` (mavjud hisob tizimi) → Payme/Click havolasi yoki
 * karta rekvizitlari + chek rasmi (handleReceiptPhoto kontakt hisoblarini ham qabul qiladi) → admin tasdiqlaydi → ochiladi.
 */
async function userByChat(chatId: string) {
  return db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, name: true, isBanned: true } });
}

/** `/start b_x_<specialistId>` — narx va to'lov usullari */
export async function handleContactBuyStart(chatId: string, payload: string, lang?: BotLang): Promise<boolean> {
  const m = /^b_x_([\w-]{1,48})$/.exec(payload);
  if (!m) return false;
  const user = await userByChat(chatId);
  if (!user || user.isBanned) {
    await sendTelegram(chatId, L(lang, "Kontaktni ochish uchun avval hisobga kiring: /start → «Ha, akkauntim bor» yoki ro'yxatdan o'ting, so'ng saytdagi tugmani qayta bosing.", "Чтобы открыть контакт, сначала войдите: /start → «Да, есть аккаунт» или зарегистрируйтесь, затем снова нажмите кнопку на сайте."));
    return true;
  }
  try {
    const q = await quoteContact(m[1], user.id);
    if (q.unlocked) {
      await sendTelegram(chatId, `🔓 <b>${escapeTelegramHtml(q.title)}</b> ${L(lang, "allaqachon ochilgan", "уже открыт")} — /kontaktlarim`);
      return true;
    }
    const keyboard: TelegramButton[][] = [];
    if (q.amount <= 0) keyboard.push([{ text: L(lang, "🎁 Bepul ochish", "🎁 Открыть бесплатно"), data: `cx:f:${m[1]}` }]);
    else {
      const row: TelegramButton[] = [];
      if (await isProviderConfigured("payme")) row.push({ text: "Payme", data: `cx:p:${m[1]}` });
      if (await isProviderConfigured("click")) row.push({ text: "Click", data: `cx:c:${m[1]}` });
      if (row.length) keyboard.push(row);
      if (await isProviderConfigured("manual")) keyboard.push([{ text: L(lang, "💳 Karta o'tkazmasi", "💳 Перевод на карту"), data: `cx:m:${m[1]}` }]);
      if (!keyboard.length) {
        await sendTelegram(chatId, L(lang, "To'lov usullari hozircha ulanmagan — administrator bilan bog'laning.", "Способы оплаты пока не подключены — обратитесь к администратору."));
        return true;
      }
    }
    await sendTelegram(
      chatId,
      `🔓 <b>${escapeTelegramHtml(q.title)}</b>\n${L(lang, "Telefon, Telegram, Instagram va email — to'lovdan so'ng ochiladi.", "Телефон, Telegram, Instagram и email откроются после оплаты.")}\n${L(lang, "Narx", "Цена")}: <b>${q.amount <= 0 ? L(lang, "Bepul", "Бесплатно") : formatPrice(q.amount)}</b>\n\n${L(lang, "To'lov usulini tanlang:", "Выберите способ оплаты:")}`,
      { keyboard },
    );
  } catch (e) {
    await sendTelegram(chatId, e instanceof ApiError ? `⚠️ ${escapeTelegramHtml(e.message)}` : L(lang, "Xatolik. Keyinroq qayta urinib ko'ring.", "Ошибка. Попробуйте позже."));
  }
  return true;
}

/** `cx:<p|c|m|f>:<specialistId>` */
export async function handleContactPayCallback(chatId: string, data: string, answer: (t: string) => Promise<unknown>, lang?: BotLang): Promise<boolean> {
  const m = /^cx:([pcmf]):([\w-]{1,48})$/.exec(data);
  if (!m) return false;
  const user = await userByChat(chatId);
  if (!user || user.isBanned) {
    await answer(L(lang, "Avval hisobga kiring", "Сначала войдите в аккаунт"));
    return true;
  }
  const provider = m[1] === "p" ? "payme" : m[1] === "c" ? "click" : "manual";
  try {
    const r = await startContactUnlock({ id: user.id }, m[2], provider);
    if (r.free) {
      await answer(L(lang, "Ochildi ✓", "Открыто ✓"));
      await sendTelegram(chatId, L(lang, "🎉 Kontakt ochildi — /kontaktlarim", "🎉 Контакт открыт — /kontaktlarim"));
      return true;
    }
    const inv = r.invoice;
    await answer(L(lang, "Hisob tayyor", "Счёт готов"));
    const origin = siteOrigin();
    const back = appUrl(contactHref(inv.id));
    const statusT = L(lang, "Holatni ko'rish", "Статус оплаты");
    const backBtn: TelegramButton = back ? { text: statusT, webApp: back } : { text: statusT, url: `${origin}${contactHref(inv.id)}` };
    if (provider === "manual") {
      const req = await manualRequisites();
      await sendTelegram(
        chatId,
        L(
          lang,
          `💳 <b>Karta o'tkazmasi</b>\nSumma: <b>${formatPrice(inv.amount)}</b>\nKarta: <code>${escapeTelegramHtml(req?.card ?? "—")}</code>\nQabul qiluvchi: ${escapeTelegramHtml(req?.name ?? "—")}\n\nO'tkazgach <b>chek rasmini (skrinshot) shu yerga yuboring</b> — administrator tasdiqlagach kontakt avtomatik ochiladi va shu yerga keladi.`,
          `💳 <b>Перевод на карту</b>\nСумма: <b>${formatPrice(inv.amount)}</b>\nКарта: <code>${escapeTelegramHtml(req?.card ?? "—")}</code>\nПолучатель: ${escapeTelegramHtml(req?.name ?? "—")}\n\nПосле перевода <b>отправьте сюда фото чека (скриншот)</b> — администратор подтвердит, и контакт откроется автоматически прямо здесь.`,
        ),
        { keyboard: [[{ text: L(lang, "Chek yubora olmayman — «To'ladim»", "Не могу отправить чек — «Я оплатил»"), data: `bd:${inv.id}` }], [backBtn]] },
      );
      return true;
    }
    const url = buildInvoiceRedirectUrl(inv, origin);
    if (!url) throw new ApiError(400, L(lang, "To'lov havolasini tuzib bo'lmadi", "Не удалось создать ссылку на оплату"));
    await sendTelegram(chatId, L(lang, `${provider === "payme" ? "Payme" : "Click"} orqali <b>${formatPrice(inv.amount)}</b> to'lang. To'langach kontakt avtomatik ochiladi va shu yerga xabar keladi.`, `Оплатите <b>${formatPrice(inv.amount)}</b> через ${provider === "payme" ? "Payme" : "Click"}. После оплаты контакт откроется автоматически, сюда придёт сообщение.`), { keyboard: [[{ text: L(lang, "To'lash", "Оплатить"), url }], [backBtn]] });
  } catch (e) {
    await answer(e instanceof ApiError ? e.message.slice(0, 180) : L(lang, "Xatolik", "Ошибка"));
  }
  return true;
}

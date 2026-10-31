import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { enrollments, subscriptionInvoices, users } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { isProviderConfigured, siteOrigin } from "@/lib/payments/config";
import { buildInvoiceRedirectUrl, loadInvoice, manualRequisites, markInvoicePaid, markInvoiceSent } from "@/lib/subscriptions/billing";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { escapeTelegramHtml, sendTelegram, telegramApi, telegramDownloadFile, type TelegramButton } from "@/lib/telegram";
import { isR2Enabled, r2Put } from "@/lib/storage/r2";
import { L, type BotLang } from "@/lib/telegram-bot/lang";
import { uploadDir } from "@/lib/uploads";
import { uid } from "@/lib/utils";
import { formatSom, PURCHASE_LABEL, type PurchaseType } from "@/lib/mentorship/format";
import { isPurchase, priceFor, purchaseHref, purchaseMeta, quoteItem, startPurchase } from "@/lib/mentorship/purchases";

/**
 * Mentorlik to'lovi Telegram bot orqali.
 *  - Saytdagi «Telegramda to'lash» → t.me/bot?start=b_<tur>_<id> (tur: c|t|s|k)
 *  - Bot narxni ko'rsatadi, usulni tanlatadi (callback `bp:<usul>:<tur>:<id>`), hisob ochadi (startPurchase),
 *    Payme/Click havolasi yoki karta rekvizitlarini yuboradi; o'tkazma uchun «To'ladim» (`bd:<hisob>`).
 *  - To'langach kirish/bildirishnoma mavjud oqim (markInvoicePaid → fulfillPurchase → notify) orqali keladi.
 * Hisob faqat chat ulangan foydalanuvchiga ochiladi.
 */

const TYPE_CODE: Record<PurchaseType, string> = { course: "c", ticket: "t", sub: "s", consult: "k" };
const CODE_TYPE: Record<string, PurchaseType> = { c: "course", t: "ticket", s: "sub", k: "consult" };
const PURCHASE_LABEL_RU: Record<PurchaseType, string> = { course: "Курс", ticket: "Билет на эфир", sub: "Месячная подписка", consult: "Консультация" };
const METHOD: Record<string, "payme" | "click" | "manual"> = { p: "payme", c: "click", m: "manual" };

/** Saytdagi tugma uchun deep-link payload (`b_c_<id>`) — 64 belgidan oshmaydi (UUID bilan ~47) */
export function buyStartPayload(type: PurchaseType, id: string, promo?: string): string {
  const base = `b_${TYPE_CODE[type]}_${id}`;
  const code = promo?.trim().toUpperCase();
  // Promokod ham sig'sa qo'shiladi (callback_data 64 baytdan oshmasligi uchun ≤12 belgi)
  return code && /^[A-Z0-9]{3,12}$/.test(code) && base.length + code.length + 1 <= 52 ? `${base}.${code}` : base;
}

const origin = () => siteOrigin();

async function userByChat(chatId: string) {
  return db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, name: true, isBanned: true } });
}

/** `/start b_c_<id>` — xarid xulosasi va to'lov usullari */
export async function handleBuyStart(chatId: string, payload: string, lang?: BotLang): Promise<boolean> {
  const m = /^b_([ctsk])_([\w-]{1,48})(?:\.([A-Z0-9]{3,12}))?$/.exec(payload);
  if (!m) return false;
  const user = await userByChat(chatId);
  if (!user || user.isBanned) {
    await sendTelegram(chatId, L(lang, "To'lovni davom ettirish uchun avval hisobni ulang: saytda Kabinet → Profil → «Telegramga ulash», so'ng tugmani qayta bosing.", "Чтобы продолжить оплату, сначала привяжите аккаунт: на сайте Кабинет → Профиль → «Подключить Telegram», затем нажмите кнопку снова."));
    return true;
  }
  const type = CODE_TYPE[m[1]];
  try {
    const q = await quoteItem(type, m[2], user.id);
    const promo = m[3];
    const price = await priceFor(q, user.id, { promo });
    const suffix = promo ? `.${promo}` : "";
    const keyboard: TelegramButton[][] = [];
    if (price.amount <= 0) {
      keyboard.push([{ text: L(lang, "🎁 Bepul boshlash", "🎁 Начать бесплатно"), data: `bp:f:${m[1]}:${m[2]}${suffix}` }]);
    } else {
      const row: TelegramButton[] = [];
      if (await isProviderConfigured("payme")) row.push({ text: "Payme", data: `bp:p:${m[1]}:${m[2]}${suffix}` });
      if (await isProviderConfigured("click")) row.push({ text: "Click", data: `bp:c:${m[1]}:${m[2]}${suffix}` });
      if (row.length) keyboard.push(row);
      if (nativeEnabled()) keyboard.push([{ text: L(lang, "💬 Telegram ichida to'lash", "💬 Оплатить в Telegram"), data: `bp:t:${m[1]}:${m[2]}${suffix}` }]);
      if (await isProviderConfigured("manual")) keyboard.push([{ text: L(lang, "💳 Karta o'tkazmasi", "💳 Перевод на карту"), data: `bp:m:${m[1]}:${m[2]}${suffix}` }]);
      if (!keyboard.length) {
        await sendTelegram(chatId, L(lang, "To'lov usullari hozircha ulanmagan — administrator bilan bog'laning.", "Способы оплаты пока не подключены — обратитесь к администратору."));
        return true;
      }
    }
    await sendTelegram(chatId, `🛒 <b>${escapeTelegramHtml(q.title)}</b>\n${L(lang, PURCHASE_LABEL[type], PURCHASE_LABEL_RU[type])} · <b>${price.amount <= 0 ? L(lang, "Bepul", "Бесплатно") : formatSom(price.amount)}</b>${price.promo ? ` (${L(lang, "promokod", "промокод")} −${price.promo.percent}%)` : ""}\n\n${L(lang, "To'lov usulini tanlang:", "Выберите способ оплаты:")}`, { keyboard });
  } catch (e) {
    await sendTelegram(chatId, e instanceof ApiError ? `⚠️ ${escapeTelegramHtml(e.message)}` : L(lang, "Xatolik. Keyinroq qayta urinib ko'ring.", "Ошибка. Попробуйте позже."));
  }
  return true;
}

/** `bp:<usul>:<tur>:<id>` va `bd:<hisob>` callback'lari. false — bu callback bizniki emas */
export async function handlePayCallback(chatId: string, data: string, answer: (t: string) => Promise<unknown>, lang?: BotLang): Promise<boolean> {
  const buy = /^bp:([pcmft]):([ctsk]):([\w-]{1,48})(?:\.([A-Z0-9]{3,12}))?$/.exec(data);
  const done = /^bd:([\w-]{1,64})$/.exec(data);
  if (!buy && !done) return false;
  const user = await userByChat(chatId);
  if (!user || user.isBanned) {
    await answer(L(lang, "Avval hisobni ulang", "Сначала привяжите аккаунт"));
    return true;
  }
  try {
    if (buy) {
      const type = CODE_TYPE[buy[2]];
      const method = buy[1] === "f" || buy[1] === "t" ? "manual" : METHOD[buy[1]];
      if (buy[1] === "t" && !nativeEnabled()) throw new ApiError(400, "Telegram to'lovi ulanmagan");
      const r = await startPurchase({ id: user.id }, { type, id: buy[3], provider: method, promo: buy[4] });
      if (r.free) {
        await answer(L(lang, "Tayyor ✓", "Готово ✓"));
        await sendTelegram(chatId, L(lang, "🎉 Kirish ochildi! Saytda Kabinet → Mentorlik bo'limiga qarang.", "🎉 Доступ открыт! На сайте: Кабинет → Наставничество."));
        return true;
      }
      const inv = r.invoice;
      await answer(L(lang, "Hisob tayyor", "Счёт готов"));
      if (buy[1] === "t") {
        await telegramApi("sendInvoice", {
          chat_id: chatId,
          title: purchaseMeta(inv).title.slice(0, 32),
          description: `${PURCHASE_LABEL[type]} — Kasb Egalari`.slice(0, 255),
          payload: inv.id,
          provider_token: process.env.TELEGRAM_PAYMENT_PROVIDER_TOKEN,
          currency: "UZS",
          prices: [{ label: L(lang, "Jami", "Итого"), amount: inv.amount * 100 }],
        });
        return true;
      }
      const back = { text: L(lang, "Holatni ko'rish", "Статус оплаты"), url: `${origin()}${purchaseHref(inv.id)}` };
      if (method === "manual") {
        const req = await manualRequisites();
        await sendTelegram(
          chatId,
          L(
            lang,
            `💳 <b>Karta o'tkazmasi</b>\nSumma: <b>${formatSom(inv.amount)}</b>\nKarta: <code>${escapeTelegramHtml(req?.card ?? "—")}</code>\nQabul qiluvchi: ${escapeTelegramHtml(req?.name ?? "—")}\n\nO'tkazgach <b>chek rasmini (skrinshot) shu yerga yuboring</b> — administrator ko'rib tasdiqlaydi va kirish avtomatik ochiladi.`,
            `💳 <b>Перевод на карту</b>\nСумма: <b>${formatSom(inv.amount)}</b>\nКарта: <code>${escapeTelegramHtml(req?.card ?? "—")}</code>\nПолучатель: ${escapeTelegramHtml(req?.name ?? "—")}\n\nПосле перевода <b>отправьте сюда фото чека (скриншот)</b> — администратор проверит и подтвердит, доступ откроется автоматически.`,
          ),
          { keyboard: [[{ text: L(lang, "Chek yubora olmayman — «To'ladim»", "Не могу отправить чек — «Я оплатил»"), data: `bd:${inv.id}` }], [back]] },
        );
        return true;
      }
      const url = buildInvoiceRedirectUrl(inv, origin());
      if (!url) throw new ApiError(400, L(lang, "To'lov havolasini tuzib bo'lmadi", "Не удалось создать ссылку на оплату"));
      await sendTelegram(chatId, L(lang, `${method === "payme" ? "Payme" : "Click"} orqali <b>${formatSom(inv.amount)}</b> to'lang. To'langach kirish avtomatik ochiladi va shu yerga xabar keladi.`, `Оплатите <b>${formatSom(inv.amount)}</b> через ${method === "payme" ? "Payme" : "Click"}. После оплаты доступ откроется автоматически, сюда придёт сообщение.`), { keyboard: [[{ text: L(lang, "To'lash", "Оплатить"), url }], [back]] });
      return true;
    }
    // «To'ladim» — faqat o'z hisobi, faqat xarid hisobi
    const inv = await loadInvoice(done![1]);
    const { isContactUnlock, contactMeta } = await import("@/lib/contacts/unlock");
    if (!inv || inv.userId !== user.id || !(isPurchase(inv) || isContactUnlock(inv))) {
      await answer(L(lang, "Hisob topilmadi", "Счёт не найден"));
      return true;
    }
    await markInvoiceSent(inv, user.id);
    await answer(L(lang, "Yuborildi ✓", "Отправлено ✓"));
    await sendTelegram(chatId, L(lang, `⏳ O'tkazma tasdiqlashni kutmoqda: <b>${escapeTelegramHtml(isContactUnlock(inv) ? contactMeta(inv).title : purchaseMeta(inv).title)}</b>. Tasdiqlangach xabar beramiz.`, `⏳ Перевод ожидает подтверждения: <b>${escapeTelegramHtml(isContactUnlock(inv) ? contactMeta(inv).title : purchaseMeta(inv).title)}</b>. Сообщим, как только подтвердят.`));
  } catch (e) {
    await answer(e instanceof ApiError ? e.message : L(lang, "Xatolik — saytdan urinib ko'ring", "Ошибка — попробуйте на сайте"));
  }
  return true;
}

/** `/kurslarim` — yozilgan kurslar va oxirgi xaridlar holati */
export async function handleMyPurchases(chatId: string, lang?: BotLang): Promise<void> {
  const user = await userByChat(chatId);
  if (!user) {
    await sendTelegram(chatId, L(lang, "Avval hisobni ulang: saytda Kabinet → Profil → «Telegramga ulash».", "Сначала привяжите аккаунт: на сайте Кабинет → Профиль → «Подключить Telegram»."));
    return;
  }
  const rows = await db.query.enrollments.findMany({ where: eq(enrollments.userId, user.id), with: { course: { columns: { title: true, slug: true } } }, orderBy: [desc(enrollments.createdAt)], limit: 8 });
  const inv = await db.query.subscriptionInvoices.findMany({ where: and(eq(subscriptionInvoices.userId, user.id)), orderBy: [desc(subscriptionInvoices.createdAt)], limit: 15 });
  const pending = inv.filter((i) => isPurchase(i) && (i.state === "created" || i.state === "pending")).slice(0, 4);
  const lines: string[] = [];
  if (rows.length) lines.push(L(lang, "<b>📚 Kurslarim</b>", "<b>📚 Мои курсы</b>"), ...rows.map((r) => `• ${escapeTelegramHtml(r.course.title)} — ${r.progressPct}%`));
  if (pending.length) lines.push("", L(lang, "<b>⏳ Kutilayotgan to'lovlar</b>", "<b>⏳ Ожидающие оплаты</b>"), ...pending.map((i) => `• ${escapeTelegramHtml(purchaseMeta(i).title)} — ${formatSom(i.amount)}`));
  await sendTelegram(chatId, lines.length ? lines.join("\n") : L(lang, "Hozircha kurs yoki xaridlar yo'q. /kurslar ro'yxatidan tanlang.", "Курсов и покупок пока нет. Выберите курс командой /kurslar."), { keyboard: [[{ text: L(lang, "Mentorlik katalogi", "Каталог курсов"), url: `${origin()}/mentorlik` }]] });
}

/* ------------------------------------------------------------------ */
/* Chek rasmi — karta o'tkazmasi; Telegram'ning o'z to'lovi            */
/* ------------------------------------------------------------------ */

const nativeEnabled = () => Boolean(process.env.TELEGRAM_PAYMENT_PROVIDER_TOKEN);

function sniffImage(b: Buffer): { ext: string; mime: string } | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b.length >= 8 && b.subarray(1, 4).toString("ascii") === "PNG") return { ext: "png", mime: "image/png" };
  if (b.length >= 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

/** Chek rasmini saytdagi yuklash bilan bir xil joyga saqlaydi (R2 → Blob → disk) */
async function storeReceipt(bytes: Buffer): Promise<string | null> {
  const kind = sniffImage(bytes);
  if (!kind) return null;
  const name = `${uid()}.${kind.ext}`;
  if (isR2Enabled()) return r2Put(`uploads/${name}`, bytes, kind.mime);
  if (process.env.BLOB_READ_WRITE_TOKEN) return (await put(`uploads/${name}`, bytes, { access: "public", contentType: kind.mime, addRandomSuffix: false })).url;
  if (process.env.VERCEL) return null;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), name), bytes);
  return `/uploads/${name}`;
}

/** Chatga rasm keldi: foydalanuvchining oxirgi ochiq KARTA xaridiga chek sifatida biriktiriladi → admin tasdiqlaydi */
export async function handleReceiptPhoto(chatId: string, fileId: string, lang?: BotLang): Promise<void> {
  const user = await userByChat(chatId);
  if (!user || user.isBanned) return;
  const open = await db.query.subscriptionInvoices.findMany({
    where: and(eq(subscriptionInvoices.userId, user.id), eq(subscriptionInvoices.state, "created"), eq(subscriptionInvoices.provider, "manual")),
    orderBy: [desc(subscriptionInvoices.createdAt)],
    limit: 5,
  });
  const { isContactUnlock, contactMeta } = await import("@/lib/contacts/unlock");
  const inv = open.find((i) => (isPurchase(i) || isContactUnlock(i)) && Date.now() - i.createdAt.getTime() < 2 * 60 * 60 * 1000);
  if (!inv) {
    await sendTelegram(chatId, L(lang, "Chek qabul qilish uchun avval to'lov boshlang: saytda xaridda «Telegramda to'lash» → «Karta o'tkazmasi».", "Чтобы отправить чек, сначала начните оплату: на сайте «Оплатить в Telegram» → «Перевод на карту»."));
    return;
  }
  try {
    const bytes = await telegramDownloadFile(fileId);
    const url = bytes ? await storeReceipt(bytes) : null;
    if (!url) {
      await sendTelegram(chatId, L(lang, "Rasmni o'qib bo'lmadi. JPG/PNG skrinshot yuboring (5 MB gacha).", "Не удалось прочитать изображение. Отправьте скриншот JPG/PNG (до 5 МБ)."));
      return;
    }
    await markInvoiceSent(inv, user.id, undefined, url);
    const title = escapeTelegramHtml(isContactUnlock(inv) ? contactMeta(inv).title : purchaseMeta(inv).title);
    await sendTelegram(chatId, L(lang, `📎 Chek qabul qilindi: <b>${title}</b>. Administrator tasdiqlagach ${isContactUnlock(inv) ? "kontakt" : "kirish"} avtomatik ochiladi va shu yerga xabar keladi.`, `📎 Чек получен: <b>${title}</b>. После подтверждения администратором ${isContactUnlock(inv) ? "контакт" : "доступ"} откроется автоматически, сюда придёт сообщение.`));
  } catch (e) {
    await sendTelegram(chatId, e instanceof ApiError ? `⚠️ ${escapeTelegramHtml(e.message)}` : L(lang, "Xatolik. Keyinroq qayta urinib ko'ring.", "Ошибка. Попробуйте позже."));
  }
}

/** pre_checkout_query: hisob shu foydalanuvchiniki, ochiq va summa mos bo'lsagina ruxsat */
export async function handlePreCheckout(q: { id: string; from?: { id?: unknown }; invoice_payload?: unknown; total_amount?: unknown; currency?: unknown }): Promise<void> {
  const inv = typeof q.invoice_payload === "string" ? await loadInvoice(q.invoice_payload) : null;
  const owner = inv?.userId ? await db.query.users.findFirst({ where: eq(users.id, inv.userId), columns: { telegramChatId: true } }) : null;
  const good = inv && isPurchase(inv) && inv.state === "created" && q.currency === "UZS" && q.total_amount === inv.amount * 100 && owner?.telegramChatId === String(q.from?.id);
  await telegramApi("answerPreCheckoutQuery", good ? { pre_checkout_query_id: q.id, ok: true } : { pre_checkout_query_id: q.id, ok: false, error_message: "Hisob yaroqsiz yoki muddati o'tgan. Qaytadan boshlang." });
}

/** successful_payment: pul Telegram provayderida o'tdi → hisob to'landi (idempotent) */
export async function handleSuccessfulPayment(
  chatId: string,
  p: { invoice_payload?: unknown; telegram_payment_charge_id?: unknown; provider_payment_charge_id?: unknown; total_amount?: unknown; currency?: unknown },
): Promise<void> {
  const id = typeof p.invoice_payload === "string" ? p.invoice_payload : "";
  const inv = id ? await loadInvoice(id) : null;
  if (!inv || !isPurchase(inv)) return;
  // Himoya qatlami (3-audit): pre_checkout tekshirgan bo'lsa ham summa/valyuta yana solishtiriladi — mos kelmasa
  // kirish OCHILMAYDI, admin qo'lda ko'rib chiqadi (pul yechilgan bo'lishi mumkin — qaytarish yoki tasdiqlash)
  if (p.currency !== "UZS" || p.total_amount !== inv.amount * 100) {
    console.error("[tg-pay] summa mos emas", { invoice: inv.id, total: p.total_amount, currency: p.currency, expected: inv.amount * 100 });
    const { notifyAdmins } = await import("@/lib/notifications");
    await notifyAdmins(
      "payment_pending",
      "Telegram to'lovi: summa hisobga mos emas",
      `${inv.id}: kutilgan ${formatSom(inv.amount)}, kelgan ${String(p.total_amount)} ${String(p.currency)} (tiyin). Kirish ochilmadi — tekshiring.`,
      "/admin/mentorlik",
    ).catch(() => undefined);
    await sendTelegram(chatId, "⚠️ To'lov summasi hisobga mos kelmadi — administrator tekshiradi. / Сумма оплаты не совпала со счётом — администратор проверит.");
    return;
  }
  await markInvoicePaid(inv.id, { providerTxnId: `tg-${String(p.telegram_payment_charge_id ?? p.provider_payment_charge_id ?? inv.id)}`, note: "Telegram to'lovi" });
  await sendTelegram(chatId, "✅ To'lov qabul qilindi — rahmat! / Оплата получена — спасибо!");
}

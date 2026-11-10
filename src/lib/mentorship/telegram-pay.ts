import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { enrollments, subscriptionInvoices, users, type SubscriptionInvoice } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { isProviderConfigured, siteOrigin } from "@/lib/payments/config";
import { buildInvoiceRedirectUrl, loadInvoice, manualRequisites, markInvoicePaid, markInvoiceSent } from "@/lib/subscriptions/billing";
import { invoiceNumber } from "@/lib/subscriptions/labels";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { escapeTelegramHtml, sendTelegram, telegramApi, telegramDownloadFile, type TelegramButton } from "@/lib/telegram";
import { isR2Enabled, r2Put } from "@/lib/storage/r2";
import { enforceLimit } from "@/lib/security/rate-limit";
import { L, type BotLang } from "@/lib/telegram-bot/lang";
import { defer } from "@/lib/telegram-bot/defer";
import { errorText } from "@/lib/telegram-bot/i18n";
import { pageButton } from "@/lib/telegram-bot/ui";
import { uploadDir } from "@/lib/uploads";
import { formatPrice, uid } from "@/lib/utils";
import { formatSom, PURCHASE_LABEL, type PurchaseType } from "@/lib/mentorship/format";
import { isPurchase, priceFor, purchaseHref, purchaseMeta, quoteItem, startPurchase } from "@/lib/mentorship/purchases";
import { contactMeta, isContactUnlock } from "@/lib/contacts/unlock";

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

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const UUID_RE = new RegExp(`^${UUID}$`);
/** Promokod belgilari (saytdagi qoida: 3–20 ta A-Z 0-9 _ -) */
const PROMO = "[A-Z0-9_-]{3,20}";
/**
 * `<id>[<ajratgich><PROMOKOD>]` ni ajratish. Yangi ajratgich «_» (UUID ichida uchramaydi, Telegram start parametri
 * belgilariga kiradi); eski havolalardagi «.» ham qabul qilinadi. UUID bo'lmagan (eski) id'da faqat «.».
 */
const REF_UUID = new RegExp(`^(${UUID})(?:[._](${PROMO}))?$`);
const REF_LEGACY = new RegExp(`^([\\w-]{1,48})(?:\\.(${PROMO}))?$`);
function parseItemRef(s: string): { id: string; promo?: string } | null {
  const m = REF_UUID.exec(s) ?? REF_LEGACY.exec(s);
  return m ? { id: m[1], promo: m[2] } : null;
}
const itemRef = (id: string, promo?: string) => (promo ? `${id}_${promo}` : id);

/**
 * Saytdagi tugma uchun deep-link payload (`b_c_<id>[_<PROMOKOD>]`) — Telegram chegarasi 64 belgi, faqat [A-Za-z0-9_-].
 * Promokod (3–20 belgi) UUID id bilan to'liq sig'adi; ilgari «.» ajratgich (ruxsat etilmagan belgi) va 12 belgilik chegara
 * sabab chegirma botda jimgina yo'qolardi. Tavsiya kodi / kredit havolaga sig'maydi — ular faqat saytdagi to'lovda.
 */
export function buyStartPayload(type: PurchaseType, id: string, promo?: string): string {
  const base = `b_${TYPE_CODE[type]}_${id}`;
  const code = promo?.trim().toUpperCase();
  return code && new RegExp(`^${PROMO}$`).test(code) && UUID_RE.test(id) && base.length + 1 + code.length <= 64 ? `${base}_${code}` : base;
}

const origin = () => siteOrigin();
const nativeEnabled = () => Boolean(process.env.TELEGRAM_PAYMENT_PROVIDER_TOKEN);
const isNative = (i: Pick<SubscriptionInvoice, "meta">): boolean => Boolean((i.meta as { tgNative?: boolean } | null)?.tgNative);

async function userByChat(chatId: string) {
  return db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, name: true, isBanned: true } });
}
const NEED_LINK = (lang?: BotLang) => L(lang, "To'lovni davom ettirish uchun avval hisobni ulang: saytda Kabinet → Profil → «Telegramga ulash», so'ng tugmani qayta bosing.", "Чтобы продолжить оплату, сначала привяжите аккаунт: на сайте Кабинет → Профиль → «Подключить Telegram», затем нажмите кнопку снова.");

/** Xarid xulosasi va to'lov usullari (deep-link va botdagi «Sotib olish» tugmasi umumiy) */
async function sendBuyOptions(chatId: string, userId: string, typeCode: string, id: string, promo: string | undefined, lang?: BotLang): Promise<void> {
  const type = CODE_TYPE[typeCode];
  const q = await quoteItem(type, id, userId);
  const price = await priceFor(q, userId, { promo });
  const ref = itemRef(id, promo);
  const keyboard: TelegramButton[][] = [];
  if (price.amount <= 0) {
    keyboard.push([{ text: L(lang, "🎁 Bepul boshlash", "🎁 Начать бесплатно"), data: `bp:f:${typeCode}:${ref}` }]);
  } else {
    const manualOk = await isProviderConfigured("manual");
    const row: TelegramButton[] = [];
    if (await isProviderConfigured("payme")) row.push({ text: "Payme", data: `bp:p:${typeCode}:${ref}` });
    if (await isProviderConfigured("click")) row.push({ text: "Click", data: `bp:c:${typeCode}:${ref}` });
    if (row.length) keyboard.push(row);
    // Telegram ichidagi to'lov hisobi «manual» provayderi ostida ochiladi — u sozlanmagan bo'lsa tugma ko'rsatilmaydi
    // (ilgari tugma chiqib, bosilganda «Bu to'lov usuli hozircha ulanmagan» deb javob berardi)
    if (nativeEnabled() && manualOk) keyboard.push([{ text: L(lang, "💬 Telegram ichida to'lash", "💬 Оплатить в Telegram"), data: `bp:t:${typeCode}:${ref}` }]);
    if (manualOk) keyboard.push([{ text: L(lang, "💳 Karta o'tkazmasi", "💳 Перевод на карту"), data: `bp:m:${typeCode}:${ref}` }]);
    if (!keyboard.length) {
      await sendTelegram(chatId, L(lang, "To'lov usullari hozircha ulanmagan — administrator bilan bog'laning.", "Способы оплаты пока не подключены — обратитесь к администратору."));
      return;
    }
  }
  await sendTelegram(chatId, `🛒 <b>${escapeTelegramHtml(q.title)}</b>\n${L(lang, PURCHASE_LABEL[type], PURCHASE_LABEL_RU[type])} · <b>${price.amount <= 0 ? L(lang, "Bepul", "Бесплатно") : formatSom(price.amount)}</b>${price.promo ? ` (${L(lang, "promokod", "промокод")} −${price.promo.percent}%)` : ""}\n\n${L(lang, "To'lov usulini tanlang:", "Выберите способ оплаты:")}`, { keyboard });
}

/** `/start b_c_<id>` — xarid xulosasi va to'lov usullari */
export async function handleBuyStart(chatId: string, payload: string, lang?: BotLang): Promise<boolean> {
  const m = /^b_([ctsk])_(.+)$/.exec(payload);
  const ref = m ? parseItemRef(m[2]) : null;
  if (!m || !ref) return false;
  const user = await userByChat(chatId);
  if (!user || user.isBanned) {
    await sendTelegram(chatId, NEED_LINK(lang));
    return true;
  }
  try {
    await sendBuyOptions(chatId, user.id, m[1], ref.id, ref.promo, lang);
  } catch (e) {
    await sendTelegram(chatId, `⚠️ ${escapeTelegramHtml(await errorText(e, lang, "Xatolik. Keyinroq qayta urinib ko'ring.", "Ошибка. Попробуйте позже."))}`);
  }
  return true;
}

/** Hisobni «Telegram ichidagi to'lov» deb belgilash/belgini olish (chek rasmi bunday hisobga biriktirilmaydi) */
async function setNative(inv: SubscriptionInvoice, on: boolean): Promise<void> {
  await db
    .update(subscriptionInvoices)
    .set({ meta: { ...(inv.meta as Record<string, unknown>), tgNative: on } })
    .where(and(eq(subscriptionInvoices.id, inv.id), eq(subscriptionInvoices.state, "created")));
}

/** `bp:<usul>:<tur>:<id>` va `bd:<hisob>` callback'lari. false — bu callback bizniki emas */
export async function handlePayCallback(chatId: string, data: string, answer: (t: string) => Promise<unknown>, lang?: BotLang): Promise<boolean> {
  const buyRaw = /^bp:([pcmft]):([ctsk]):(.+)$/.exec(data);
  const buyRef = buyRaw ? parseItemRef(buyRaw[3]) : null;
  const done = /^bd:([\w-]{1,64})$/.exec(data);
  if (!(buyRaw && buyRef) && !done) return false;
  const user = await userByChat(chatId);
  if (!user || user.isBanned) {
    await answer(L(lang, "Avval hisobni ulang", "Сначала привяжите аккаунт"));
    return true;
  }
  try {
    if (buyRaw && buyRef) {
      const type = CODE_TYPE[buyRaw[2]];
      const native = buyRaw[1] === "t";
      const method = buyRaw[1] === "f" || native ? "manual" : METHOD[buyRaw[1]];
      if (native && !nativeEnabled()) throw new ApiError(400, "Telegram to'lovi ulanmagan");
      // Har bosish yangi hisob ochadi (eskisini bekor qiladi) — saytdagi kabi chegaralanadi
      await enforceLimit("purchase", user.id);
      const r = await startPurchase({ id: user.id }, { type, id: buyRef.id, provider: method, promo: buyRef.promo });
      if (r.free) {
        await answer(L(lang, "Tayyor ✓", "Готово ✓"));
        await sendTelegram(chatId, L(lang, "🎉 Kirish ochildi! Saytda Kabinet → Mentorlik bo'limiga qarang.", "🎉 Доступ открыт! На сайте: Кабинет → Наставничество."), { keyboard: [[pageButton(L(lang, "Kurslarimni ochish", "Открыть мои курсы"), "/kabinet/mentorlik")]] });
        return true;
      }
      const inv = r.invoice;
      if (native) {
        await setNative(inv, true);
        const res = await telegramApi("sendInvoice", {
          chat_id: chatId,
          title: purchaseMeta(inv).title.slice(0, 32) || L(lang, "Xarid", "Покупка"),
          description: `${L(lang, PURCHASE_LABEL[type], PURCHASE_LABEL_RU[type])} — Kasb Egalari`.slice(0, 255),
          payload: inv.id,
          provider_token: process.env.TELEGRAM_PAYMENT_PROVIDER_TOKEN,
          currency: "UZS",
          prices: [{ label: L(lang, "Jami", "Итого"), amount: inv.amount * 100 }],
        });
        // Telegram hisobni rad etsa (provayder tokeni xato, summa valyuta chegarasidan past…) foydalanuvchi «Hisob tayyor»
        // degan javob bilan hech narsasiz qolardi — sababini aytamiz va adminni ogohlantiramiz
        if (!res?.ok) {
          console.error("[tg-pay] sendInvoice rad etildi", res?.description ?? "javob yo'q");
          await answer(L(lang, "Telegram to'lovi ochilmadi", "Не удалось открыть оплату в Telegram"));
          await sendTelegram(chatId, L(lang, "⚠️ Telegram ichidagi to'lovni ochib bo'lmadi. Iltimos, boshqa to'lov usulini tanlang.", "⚠️ Не удалось открыть оплату внутри Telegram. Пожалуйста, выберите другой способ оплаты."));
          await sendBuyOptions(chatId, user.id, buyRaw[2], buyRef.id, buyRef.promo, lang).catch(() => undefined);
          const { notifyAdmins } = await import("@/lib/notifications");
          await notifyAdmins("payment_pending", "Telegram to'lovi ochilmadi", `sendInvoice rad etildi: ${(res?.description ?? "javob yo'q").slice(0, 160)}. TELEGRAM_PAYMENT_PROVIDER_TOKEN va summani tekshiring (${invoiceNumber(inv.id)}).`, "/admin/mentorlik", { skipMail: true, dedupeMs: 60 * 60 * 1000 }).catch(() => undefined);
          return true;
        }
        await answer(L(lang, "Hisob tayyor", "Счёт готов"));
        return true;
      }
      await answer(L(lang, "Hisob tayyor", "Счёт готов"));
      const back = pageButton(L(lang, "Holatni ko'rish", "Статус оплаты"), purchaseHref(inv.id));
      if (method === "manual") {
        const req = await manualRequisites();
        await sendTelegram(
          chatId,
          L(
            lang,
            `💳 <b>Karta o'tkazmasi</b>\nSumma: <b>${formatSom(inv.amount)}</b>\nKarta: <code>${escapeTelegramHtml(req?.card ?? "—")}</code>\nQabul qiluvchi: ${escapeTelegramHtml(req?.name ?? "—")}\n\nO'tkazgach <b>chek rasmini yoki PDF faylini shu yerga yuboring</b> — administrator ko'rib tasdiqlaydi va kirish avtomatik ochiladi.`,
            `💳 <b>Перевод на карту</b>\nСумма: <b>${formatSom(inv.amount)}</b>\nКарта: <code>${escapeTelegramHtml(req?.card ?? "—")}</code>\nПолучатель: ${escapeTelegramHtml(req?.name ?? "—")}\n\nПосле перевода <b>отправьте сюда фото чека или PDF</b> — администратор проверит и подтвердит, доступ откроется автоматически.`,
          ),
          { keyboard: [[{ text: L(lang, "Chek yubora olmayman — «To'ladim»", "Не могу отправить чек — «Я оплатил»"), data: `bd:${inv.id}` }], [back]] },
        );
        return true;
      }
      const url = buildInvoiceRedirectUrl(inv, origin());
      if (!url) throw new ApiError(400, "To'lov havolasini tuzib bo'lmadi");
      await sendTelegram(chatId, L(lang, `${method === "payme" ? "Payme" : "Click"} orqali <b>${formatSom(inv.amount)}</b> to'lang. To'langach kirish avtomatik ochiladi va shu yerga xabar keladi.`, `Оплатите <b>${formatSom(inv.amount)}</b> через ${method === "payme" ? "Payme" : "Click"}. После оплаты доступ откроется автоматически, сюда придёт сообщение.`), { keyboard: [[{ text: L(lang, "To'lash", "Оплатить"), url }], [back]] });
      return true;
    }
    // «To'ladim» — faqat o'z hisobi, faqat xarid/kontakt hisobi
    const inv = await loadInvoice(done![1]);
    if (!inv || inv.userId !== user.id || !(isPurchase(inv) || isContactUnlock(inv))) {
      await answer(L(lang, "Hisob topilmadi", "Счёт не найден"));
      return true;
    }
    await markInvoiceSent(inv, user.id);
    await answer(L(lang, "Yuborildi ✓", "Отправлено ✓"));
    await sendTelegram(chatId, L(lang, `⏳ O'tkazma tasdiqlashni kutmoqda: <b>${escapeTelegramHtml(invoiceTitle(inv))}</b>. Tasdiqlangach xabar beramiz. Chek rasmi bo'lsa — shu yerga yuborsangiz, tekshirish tezlashadi.`, `⏳ Перевод ожидает подтверждения: <b>${escapeTelegramHtml(invoiceTitle(inv))}</b>. Сообщим, как только подтвердят. Если есть фото чека — отправьте его сюда, проверка пройдёт быстрее.`));
  } catch (e) {
    await answer((await errorText(e, lang, "Xatolik — saytdan urinib ko'ring", "Ошибка — попробуйте на сайте")).slice(0, 180));
  }
  return true;
}

/** `/kurslarim` — yozilgan kurslar va oxirgi xaridlar holati */
export async function handleMyPurchases(chatId: string, lang?: BotLang): Promise<void> {
  const user = await userByChat(chatId);
  if (!user || user.isBanned) {
    await sendTelegram(chatId, L(lang, "Avval hisobni ulang: saytda Kabinet → Profil → «Telegramga ulash».", "Сначала привяжите аккаунт: на сайте Кабинет → Профиль → «Подключить Telegram»."));
    return;
  }
  const rows = await db.query.enrollments.findMany({ where: eq(enrollments.userId, user.id), with: { course: { columns: { title: true, slug: true } } }, orderBy: [desc(enrollments.createdAt)], limit: 8 });
  const inv = await db.query.subscriptionInvoices.findMany({ where: and(eq(subscriptionInvoices.userId, user.id)), orderBy: [desc(subscriptionInvoices.createdAt)], limit: 15 });
  const pending = inv.filter((i) => isPurchase(i) && (i.state === "created" || i.state === "pending")).slice(0, 4);
  const lines: string[] = [];
  if (rows.length) lines.push(L(lang, "<b>📚 Kurslarim</b>", "<b>📚 Мои курсы</b>"), ...rows.map((r) => `• ${escapeTelegramHtml(r.course.title)} — ${r.progressPct}%`));
  if (pending.length) lines.push("", L(lang, "<b>⏳ Kutilayotgan to'lovlar</b>", "<b>⏳ Ожидающие оплаты</b>"), ...pending.map((i) => `• ${escapeTelegramHtml(purchaseMeta(i).title)} — ${formatSom(i.amount)}`));
  const keyboard: TelegramButton[][] = [];
  if (rows.length) keyboard.push([pageButton(L(lang, "📚 O'qishni davom ettirish", "📚 Продолжить обучение"), "/kabinet/mentorlik")]);
  keyboard.push([{ text: L(lang, "Mentorlik katalogi", "Каталог курсов"), url: `${origin()}/mentorlik` }]);
  await sendTelegram(chatId, lines.length ? lines.join("\n") : L(lang, "Hozircha kurs yoki xaridlar yo'q. /kurslar ro'yxatidan tanlang.", "Курсов и покупок пока нет. Выберите курс командой /kurslar."), { keyboard });
}

/* ------------------------------------------------------------------ */
/* Chek (rasm yoki PDF) — karta o'tkazmasi; Telegram'ning o'z to'lovi  */
/* ------------------------------------------------------------------ */

const invoiceTitle = (i: SubscriptionInvoice): string => (isContactUnlock(i) ? contactMeta(i).title : purchaseMeta(i).title);

/** Chek qabul qilinadigan muddat: hisob shu vaqt ichida ochilgan bo'lsa rasm so'roqsiz chek hisoblanadi */
export const RECEIPT_FRESH_MS = 2 * 60 * 60 * 1000;

/**
 * Foydalanuvchining ochiq karta-o'tkazma hisoblari (kurs/kontakt): `created` — chek kutilmoqda, `pending` — «To'ladim»
 * bosilgan (cheksiz bo'lsa keyin yuborilgan chek biriktiriladi). Telegram ichidagi to'lov hisoblari kirmaydi — ularga
 * chek biriktirilsa hisob «tasdiq kutmoqda»ga o'tib, Telegram to'lovi rad etilardi.
 */
export async function openReceiptInvoices(userId: string): Promise<SubscriptionInvoice[]> {
  const open = await db.query.subscriptionInvoices.findMany({
    where: and(eq(subscriptionInvoices.userId, userId), inArray(subscriptionInvoices.state, ["created", "pending"]), eq(subscriptionInvoices.provider, "manual")),
    orderBy: [desc(subscriptionInvoices.createdAt)],
    limit: 8,
  });
  return open.filter((i) => (isPurchase(i) || isContactUnlock(i)) && !isNative(i));
}

function sniffReceipt(b: Buffer): { ext: string; mime: string } | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b.length >= 8 && b.subarray(1, 4).toString("ascii") === "PNG") return { ext: "png", mime: "image/png" };
  if (b.length >= 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp", mime: "image/webp" };
  if (b.length >= 5 && b.subarray(0, 5).toString("ascii") === "%PDF-") return { ext: "pdf", mime: "application/pdf" };
  return null;
}

/** Chek faylini saytdagi yuklash bilan bir xil joyga saqlaydi (R2 → Blob → disk); tur baytlardan aniqlanadi (rasm yoki PDF) */
async function storeReceipt(bytes: Buffer): Promise<string | null> {
  const kind = sniffReceipt(bytes);
  if (!kind) return null;
  const name = `${uid()}.${kind.ext}`;
  if (isR2Enabled()) return r2Put(`uploads/${name}`, bytes, kind.mime);
  if (process.env.BLOB_READ_WRITE_TOKEN) return (await put(`uploads/${name}`, bytes, { access: "public", contentType: kind.mime, addRandomSuffix: false })).url;
  if (process.env.VERCEL) return null;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), name), bytes);
  return `/uploads/${name}`;
}

/**
 * Chatga chek keldi (rasm yoki PDF): foydalanuvchining ochiq KARTA hisobiga biriktiriladi → admin tasdiqlaydi.
 * `invoiceId` berilsa — aynan o'sha hisob («Bu to'lov cheki» tugmasi); aks holda eng yangi ochiq hisob.
 * Yuklab olish va saqlash javobdan keyin bajariladi (webhook kechikmasin).
 */
export async function handleReceiptPhoto(chatId: string, fileId: string, lang?: BotLang, opts: { invoiceId?: string } = {}): Promise<void> {
  const user = await userByChat(chatId);
  if (!user || user.isBanned) return;
  const open = await openReceiptInvoices(user.id);
  const inv = opts.invoiceId ? open.find((i) => i.id === opts.invoiceId) : open[0];
  if (!inv) {
    await sendTelegram(chatId, L(lang, "Chek qabul qilish uchun avval to'lov boshlang: saytda xaridda «Telegramda to'lash» → «Karta o'tkazmasi».", "Чтобы отправить чек, сначала начните оплату: на сайте «Оплатить в Telegram» → «Перевод на карту»."));
    return;
  }
  defer(async () => {
    try {
      const bytes = await telegramDownloadFile(fileId);
      const url = bytes ? await storeReceipt(bytes) : null;
      if (!url) {
        await sendTelegram(chatId, L(lang, "Faylni o'qib bo'lmadi. Chekni JPG/PNG rasm yoki PDF ko'rinishida yuboring (5 MB gacha).", "Не удалось прочитать файл. Отправьте чек как изображение JPG/PNG или PDF (до 5 МБ)."));
        return;
      }
      const title = escapeTelegramHtml(invoiceTitle(inv));
      const what = isContactUnlock(inv) ? L(lang, "kontakt", "контакт") : L(lang, "kirish", "доступ");
      if (inv.state === "pending") {
        // «To'ladim» allaqachon bosilgan — chek keyin keldi: hisobga biriktiramiz va adminlarga chek bilan qayta xabar beramiz
        const [row] = await db
          .update(subscriptionInvoices)
          .set({ meta: { ...(inv.meta as Record<string, unknown>), receiptUrl: url }, updatedAt: new Date() })
          .where(and(eq(subscriptionInvoices.id, inv.id), eq(subscriptionInvoices.state, "pending")))
          .returning({ id: subscriptionInvoices.id });
        if (row) {
          const { notifyAdminsManualPending } = await import("@/lib/manual-approval");
          await notifyAdminsManualPending({
            kind: "sub",
            type: "subscription_pending",
            id: inv.id,
            title: "O'tkazma cheki yuborildi",
            body: `${invoiceTitle(inv)} — ${formatPrice(inv.amount)} (${invoiceNumber(inv.id)}): foydalanuvchi chekni qo'shimcha yubordi.`,
            href: isContactUnlock(inv) ? "/admin/kontaktlar" : "/admin/mentorlik",
            receiptUrl: url,
          });
        }
        await sendTelegram(chatId, L(lang, `📎 Chek qo'shildi: <b>${title}</b>. Administrator tekshirmoqda.`, `📎 Чек добавлен: <b>${title}</b>. Администратор проверяет.`));
        return;
      }
      await markInvoiceSent(inv, user.id, undefined, url);
      await sendTelegram(chatId, L(lang, `📎 Chek qabul qilindi: <b>${title}</b>. Administrator tasdiqlagach ${what} avtomatik ochiladi va shu yerga xabar keladi.`, `📎 Чек получен: <b>${title}</b>. После подтверждения администратором ${what} откроется автоматически, сюда придёт сообщение.`));
    } catch (e) {
      await sendTelegram(chatId, `⚠️ ${escapeTelegramHtml(await errorText(e, lang, "Xatolik. Keyinroq qayta urinib ko'ring.", "Ошибка. Попробуйте позже."))}`);
    }
  }, "receipt");
}

/** pre_checkout_query: hisob shu foydalanuvchiniki, ochiq va summa mos bo'lsagina ruxsat */
export async function handlePreCheckout(q: { id: string; from?: { id?: unknown; language_code?: string }; invoice_payload?: unknown; total_amount?: unknown; currency?: unknown }): Promise<void> {
  const inv = typeof q.invoice_payload === "string" ? await loadInvoice(q.invoice_payload) : null;
  const owner = inv?.userId ? await db.query.users.findFirst({ where: eq(users.id, inv.userId), columns: { telegramChatId: true, lang: true } }) : null;
  const good = inv && isPurchase(inv) && inv.state === "created" && q.currency === "UZS" && q.total_amount === inv.amount * 100 && owner?.telegramChatId === String(q.from?.id);
  const lang: BotLang = owner?.lang === "ru" || (!owner?.lang && (q.from?.language_code ?? "").toLowerCase().startsWith("ru")) ? "ru" : "uz";
  await telegramApi("answerPreCheckoutQuery", good ? { pre_checkout_query_id: q.id, ok: true } : { pre_checkout_query_id: q.id, ok: false, error_message: L(lang, "Hisob yaroqsiz yoki muddati o'tgan. Qaytadan boshlang.", "Счёт недействителен или истёк. Начните заново.") });
}

/** successful_payment: pul Telegram provayderida o'tdi → hisob to'landi (idempotent) */
export async function handleSuccessfulPayment(
  chatId: string,
  p: { invoice_payload?: unknown; telegram_payment_charge_id?: unknown; provider_payment_charge_id?: unknown; total_amount?: unknown; currency?: unknown },
  lang?: BotLang,
): Promise<void> {
  const id = typeof p.invoice_payload === "string" ? p.invoice_payload : "";
  const inv = id ? await loadInvoice(id) : null;
  if (!inv || !isPurchase(inv)) return;
  const charge = String(p.telegram_payment_charge_id ?? p.provider_payment_charge_id ?? inv.id);
  const alert = async (title: string, body: string) => {
    const { notifyAdmins } = await import("@/lib/notifications");
    await notifyAdmins("payment_pending", title, body, "/admin/mentorlik").catch(() => undefined);
  };
  // Himoya qatlami (3-audit): pre_checkout tekshirgan bo'lsa ham summa/valyuta yana solishtiriladi — mos kelmasa
  // kirish OCHILMAYDI, admin qo'lda ko'rib chiqadi (pul yechilgan bo'lishi mumkin — qaytarish yoki tasdiqlash)
  if (p.currency !== "UZS" || p.total_amount !== inv.amount * 100) {
    console.error("[tg-pay] summa mos emas", { invoice: inv.id, total: p.total_amount, currency: p.currency, expected: inv.amount * 100 });
    await alert("Telegram to'lovi: summa hisobga mos emas", `${inv.id}: kutilgan ${formatSom(inv.amount)}, kelgan ${String(p.total_amount)} ${String(p.currency)} (tiyin). Kirish ochilmadi — tekshiring.`);
    await sendTelegram(chatId, L(lang, "⚠️ To'lov summasi hisobga mos kelmadi — administrator tekshiradi.", "⚠️ Сумма оплаты не совпала со счётом — администратор проверит."));
    return;
  }
  try {
    await markInvoicePaid(inv.id, { providerTxnId: `tg-${charge}`, note: "Telegram to'lovi" });
  } catch (e) {
    // PUL YECHILGAN, lekin kirish ochilmadi (hisob shu orada bekor qilingan, baza xatosi…) — jim qolmaymiz:
    // adminlarga darhol xabar (qo'lda tasdiqlash yoki qaytarish), foydalanuvchiga — nima bo'lgani
    console.error("[tg-pay] to'lov qabul qilindi, lekin hisob yopilmadi", { invoice: inv.id, charge, error: e instanceof Error ? e.message : e });
    await alert("Telegram to'lovi qabul qilindi, lekin kirish ochilmadi", `${invoiceNumber(inv.id)} (${purchaseMeta(inv).title}) — ${formatSom(inv.amount)} yechildi (to'lov raqami ${charge.slice(0, 60)}), hisob holati «${inv.state}». Qo'lda tasdiqlang yoki pulni qaytaring.`);
    await sendTelegram(chatId, L(lang, "✅ To'lov qabul qilindi. Kirishni ochishda kechikish yuz berdi — administrator tez orada ochadi, sizga shu yerga xabar keladi.", "✅ Оплата получена. Открытие доступа задерживается — администратор скоро откроет его, сообщение придёт сюда."));
    return;
  }
  await sendTelegram(chatId, L(lang, "✅ To'lov qabul qilindi — rahmat!", "✅ Оплата получена — спасибо!"), { keyboard: [[pageButton(L(lang, "Kurslarimni ochish", "Открыть мои курсы"), "/kabinet/mentorlik")]] });
}

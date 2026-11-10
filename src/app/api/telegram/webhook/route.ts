import { timingSafeEqual } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";
import { loadPaymentDetail } from "@/lib/payments/dto";
import { cancelPayment, markPaid, orderHref } from "@/lib/payments/service";
import { cancelInvoice, invoiceHref, loadInvoice, markInvoicePaid } from "@/lib/subscriptions/billing";
import { invoiceNumber } from "@/lib/subscriptions/labels";
import { escapeTelegramHtml, sendTelegram, telegramApi, telegramWebhookSecret, verifyTelegramLinkCode } from "@/lib/telegram";
import { formatPrice } from "@/lib/utils";
import { isPurchase, purchaseHref, purchaseMeta } from "@/lib/mentorship/purchases";
import { contactHref, contactMeta, isContactUnlock } from "@/lib/contacts/unlock";
import { handleBuyStart, handleMyPurchases, handlePayCallback, handlePreCheckout, handleSuccessfulPayment } from "@/lib/mentorship/telegram-pay";
import { handleIncomingMedia, handlePostCallback, handlePostText, sendPostHelp, type IncomingMedia } from "@/lib/telegram-bot/media";
import { BANNED_TEXT, accountOf, handleCourses, handleMyContacts, handleLives, handleLoginCallback, handleLoginStart, handleMenuCallback, handleMyOrders, handleOrderCallback, handleProfile, handleSearch, handleSettings, handleSettingsCallback, handleTop, handleVacancies } from "@/lib/telegram-bot/actions";
import { handleBroadcastCallback, handleBroadcastStart, handleBroadcastText } from "@/lib/telegram-bot/broadcast-flow";
import { MENU_COMMAND, clearChatCommands, menuRows, pageButton, sendApp, sendHelp, sendWelcome, setAdminCommands } from "@/lib/telegram-bot/ui";
import { handleRegisterCallback, handleRegisterContact, handleRegisterStray, handleRegisterText, startRegistration } from "@/lib/telegram-bot/register";
import { clearBotSession, getBotSession } from "@/lib/telegram-bot/session";
import { handleApplicationCallback, handleEmployerApplications, handleMyApplications } from "@/lib/telegram-bot/applications";
import { handleDmCallback, handleDmMedia, handleDmText, handleMessages } from "@/lib/telegram-bot/dm";
import { handleSupportCallback, handleSupportMedia, handleSupportText, startSupport, type SupportSender } from "@/lib/telegram-bot/support";
import { handleAdminBlock, handleAdminUnblock, sendAdminTrap } from "@/lib/telegram-bot/admin-security";
import { handleInlineQuery } from "@/lib/telegram-bot/inline";
import { handleContactBuyStart, handleContactPayCallback } from "@/lib/telegram-bot/contact-pay";
import { botLang, L, type BotLang } from "@/lib/telegram-bot/lang";
import { gateEnabled, gateExempt, handleGateCheck, isChannelMember, rememberGatedStart, sendJoinGate, takeGatedStart } from "@/lib/telegram-bot/gate";
import { markReachable, markUnreachable } from "@/lib/telegram-bot/reach";
import { defer } from "@/lib/telegram-bot/defer";
import { LIMITED_TEXT, botLimited, firstSeenUpdate, shouldWarnLimited } from "@/lib/telegram-bot/guard";
import { errorText } from "@/lib/telegram-bot/i18n";
import { adoptGuestLang, resolveLang } from "@/lib/telegram-bot/lang-store";
import { handleLanguageCallback, sendLanguageChoice } from "@/lib/telegram-bot/language";
import { adminByChat, handleAdminCallback, handleAdminChallenge, handleAdminPriceText, handleAdminPrices, handleAdminUserSearch, sendAdminMenu, sendAdminDisputes, sendAdminMentorApps, sendAdminPayments, sendAdminPayouts, sendAdminQueues, sendAdminReports, sendAdminStats } from "@/lib/telegram-bot/admin";

/**
 * Telegram Bot API webhook (setWebhook bilan o'rnatiladi — docs/DEPLOY.md §11).
 *
 * Xavfsizlik: `x-telegram-bot-api-secret-token` sarlavhasi TELEGRAM_WEBHOOK_SECRET ga teng bo'lishi SHART
 * (aks holda 401). Tekshiruvdan o'tgan so'rovga HAR DOIM 200 qaytadi — ichki xato Telegram'ning retry
 * bo'ronini keltirib chiqarmasin (xato faqat logga yoziladi).
 *
 * TARTIB (2026-11-10): sir → `update_id` takrori (qayta yuborilgan update ikkinchi marta bajarilmaydi) → tur bo'yicha
 * (my_chat_member / pre_checkout / inline / tugma / xabar) → chegara (tugma, inline va xabar — ALOHIDA chelaklar; chegarada
 * tugmaga baribir javob beriladi) → bloklangan hisob → majburiy obuna darvozasi → amal. Og'ir ishlar (fayl yuklash, ommaviy
 * yuborish) javobdan keyin (`defer`) bajariladi.
 *
 * Faqat shaxsiy chatdagi xabarlar (bot UI va matnlar: lib/telegram-bot/ui.ts):
 *   /start           — xush kelibsiz ekrani (banner + doimiy menyu yoki «Hisobni ulash»)
 *   /start <kod>     — hisobni ulash (kod: /api/telegram/link, 15 daqiqa amal qiladi)
 *   /start l_<kod>   — «Telegram bilan kirish» tasdig'i
 *   /start b_<tur>_<id> — mentorlik xaridi (to'lov usuli tugmalari: lib/mentorship/telegram-pay.ts); b_x_<id> — kontakt ochish (lib/telegram-bot/contact-pay.ts)
 *   /ilova · /buyurtmalarim · /qidiruv <so'z> · /kurslar · /kurslarim · /efirlar · /vakansiyalar · /top
 *   /xabarlar — suhbatlar: o'qish va javob yozish (lib/telegram-bot/dm.ts, tugmalar `dm:*`)
 *   /arizalar · /arizalarim — vakansiya arizalari (lib/telegram-bot/applications.ts, tugmalar `ap:*`)
 *   /profil · /sozlamalar · /til · /yordam (→ «Qo'llab-quvvatlashga yozish», lib/telegram-bot/support.ts `sup:*`) · /bekor · /stop
 *   /elon (faqat admin: ommaviy e'lon, auditoriya tugmalari)
 *   /admin · /stat · /navbat · /tolovlar · /user <q> — admin boti (lib/telegram-bot/admin.ts), tugmalar `adm:*`
 *   /tuzoq · /blok <ip> [sabab] · /blokdan <ip> — tuzoq holati va IP bloklash (lib/telegram-bot/admin-security.ts; faqat admin)
 *   doimiy menyu tugmalari (📦 Buyurtmalarim …) — MENU_COMMAND orqali shu buyruqlarga aylanadi
 *   boshqa matn      — faol oqim (ro'yxat / e'lon / post izohi / qo'llab-quvvatlash / suhbatga javob) yoki ijodkor qidiruvi
 *
 * callback_query (`mp:<ok|no>:<p|s>:<id>`) — qo'lda o'tkazmani ADMIN bir bosishda tasdiqlashi/rad etishi
 * (lib/manual-approval.ts yuborgan tugmalar). Chat admin hisobiga ulanganligi majburiy tekshiriladi (`adminByChat`).
 */

/** Fayl yuklab olish / ommaviy yuborish kabi og'ir ishlar javobdan keyin davom etadi — platforma ularni erta uzmasin */
export const maxDuration = 60;

function secretOk(req: Request): boolean {
  // Sir env'dan yoki AUTH_SECRET'dan avtomatik (telegramWebhookSecret) — admin paneldagi
  // "Webhookni o'rnatish" ham aynan shu qiymat bilan setWebhook qiladi
  const expected = Buffer.from(process.env.TELEGRAM_BOT_TOKEN ? telegramWebhookSecret() : "");
  const got = Buffer.from(req.headers.get("x-telegram-bot-api-secret-token") || "");
  // Uzunlik BAYTLARDA solishtiriladi: belgilar soni teng, baytlari farqli (ASCII bo'lmagan) qiymatda timingSafeEqual xato tashlardi (500)
  if (!expected.length || got.length !== expected.length) return false;
  return timingSafeEqual(got, expected);
}

interface TgFrom {
  id?: unknown;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}
/** Telegram update'ining bizga kerakli qismi (to'liq tip shart emas) */
interface TelegramUpdate {
  update_id?: unknown;
  /** Foydalanuvchi botni blokladi («kicked») yoki blokdan chiqardi / qayta ishga tushirdi («member») */
  my_chat_member?: { chat?: { id?: unknown; type?: unknown }; new_chat_member?: { status?: unknown } };
  message?: {
    message_id?: unknown;
    text?: unknown;
    from?: TgFrom;
    chat?: { id?: unknown; type?: unknown };
    caption?: unknown;
    /** Albom (bir nechta rasm/video bitta xabarda) — har fayl alohida update, shu id bilan */
    media_group_id?: unknown;
    photo?: { file_id?: string; file_size?: number; width?: number; height?: number }[];
    video?: { file_id?: string; mime_type?: string; file_size?: number; width?: number; height?: number; duration?: number };
    document?: { file_id?: string; mime_type?: string; file_size?: number; file_name?: string };
    /** Bot hali tushunmaydigan turlar — foydalanuvchiga yo'l-yo'riq beriladi (jim qolmaydi) */
    voice?: unknown;
    audio?: unknown;
    sticker?: unknown;
    animation?: unknown;
    video_note?: unknown;
    location?: unknown;
    poll?: unknown;
    /** ForceReply javobi: qaysi bot xabariga javob yozilgani */
    reply_to_message?: { message_id?: unknown; text?: unknown };
    successful_payment?: { invoice_payload?: unknown; telegram_payment_charge_id?: unknown; provider_payment_charge_id?: unknown; total_amount?: unknown; currency?: unknown };
    /** «Raqamni ulashish» (request_contact) — ro'yxatdan o'tishda telefon */
    contact?: { phone_number?: unknown; user_id?: unknown };
  };
  pre_checkout_query?: { id: string; from?: { id?: unknown }; invoice_payload?: unknown; total_amount?: unknown; currency?: unknown };
  inline_query?: { id?: unknown; from?: { id?: unknown; language_code?: string }; query?: unknown; offset?: unknown };
  callback_query?: {
    id?: unknown;
    data?: unknown;
    from?: TgFrom;
    message?: { message_id?: unknown; text?: unknown; chat?: { id?: unknown; type?: string } };
  };
}

type Who ={ name?: string; username?: string; lang: BotLang };

/** `who` — handlerlarga uzatiladigan foydalanuvchi ma'lumoti. Til: `resolveLang` (hisob tili → chat tanlovi → Telegram tili) */
const whoOf = (from: TgFrom | undefined, lang: BotLang): Who => ({ name: [from?.first_name, from?.last_name].filter(Boolean).join(" ") || undefined, username: typeof from?.username === "string" ? from.username : undefined, lang });

/* ------------------------------------------------------------------ */
/* Qo'lda o'tkazmani Telegramdan bir bosishda tasdiqlash / rad etish   */
/* ------------------------------------------------------------------ */

/** Buyurtma to'lovi bo'yicha amal — admin route'dagi confirm/cancel bilan bir xil qoidalar */
async function actOnPayment(admin: { id: string; name: string }, confirm: boolean, id: string, lang: BotLang): Promise<string> {
  const p = await loadPaymentDetail(id);
  if (!p) throw new ApiError(404, L(lang, "To'lov topilmadi", "Платёж не найден"));
  if (p.provider !== "manual") throw new ApiError(400, L(lang, "Bu to'lov provayder orqali tasdiqlanadi", "Этот платёж подтверждается провайдером"));
  if (p.state === "paid" || p.state === "released") return L(lang, "Allaqachon tasdiqlangan ✓", "Уже подтверждён ✓");
  if (p.state === "cancelled" || p.state === "refunded") return L(lang, "Allaqachon rad etilgan", "Уже отклонён");
  if (confirm) {
    await markPaid(p.id, { actorId: admin.id, providerTxnId: p.providerTxnId ?? `manual-${p.id.slice(0, 8)}` });
    await audit(admin.id, "admin_payment", { targetType: "payment", targetId: p.id, meta: { action: "confirm", via: "telegram" } });
    return L(lang, `✅ Tasdiqlandi — ${formatPrice(p.amount)} eskrouga qabul qilindi`, `✅ Подтверждено — ${formatPrice(p.amount)} принято в эскроу`);
  }
  await cancelPayment(p.id, 4, admin.id);
  await audit(admin.id, "admin_payment", { targetType: "payment", targetId: p.id, meta: { action: "cancel", via: "telegram" } });
  await notify(
    p.clientId,
    "payment_cancelled",
    "O'tkazma tasdiqlanmadi",
    `«${p.order.title}» — ${formatPrice(p.amount)} o'tkazmasi administrator tomonidan topilmadi yoki rad etildi. Pul yuborgan bo'lsangiz qo'llab-quvvatlashga yozing.`,
    orderHref(p.orderId),
  );
  return L(lang, "❌ Rad etildi — mijozga xabar yuborildi", "❌ Отклонено — клиенту отправлено уведомление");
}

/** Obuna / kurs xaridi / kontakt hisobi bo'yicha amal — admin route'lari bilan bir xil qoidalar */
async function actOnInvoice(admin: { id: string; name: string }, confirm: boolean, id: string, lang: BotLang): Promise<string> {
  const inv = await loadInvoice(id);
  if (!inv) throw new ApiError(404, L(lang, "Hisob topilmadi", "Счёт не найден"));
  if (inv.provider !== "manual") throw new ApiError(400, L(lang, "Bu hisob provayder orqali tasdiqlanadi", "Этот счёт подтверждается провайдером"));
  if (inv.state === "paid") return L(lang, "Allaqachon tasdiqlangan ✓", "Уже подтверждён ✓");
  if (inv.state === "cancelled" || inv.state === "refunded") return L(lang, "Allaqachon rad etilgan", "Уже отклонён");
  const contact = isContactUnlock(inv);
  const purchase = !contact && isPurchase(inv);
  if (confirm) {
    await markInvoicePaid(inv.id, { actorId: admin.id, providerTxnId: inv.providerTxnId ?? `manual-${inv.id}`, note: "Telegram orqali tasdiqlandi" });
    await audit(admin.id, "admin_subscription", { targetType: "subscription_invoice", targetId: inv.id, meta: { action: "confirm", via: "telegram", amount: inv.amount, months: inv.months } });
    if (contact) return L(lang, "✅ Tasdiqlandi — kontakt mijozga ochildi", "✅ Подтверждено — контакт открыт клиенту");
    if (purchase) return L(lang, "✅ Tasdiqlandi — xarid faollashtirildi", "✅ Подтверждено — покупка активирована");
    return L(lang, `✅ Tasdiqlandi — ${inv.months} oylik obuna faollashtirildi`, `✅ Подтверждено — подписка на ${inv.months} мес. активирована`);
  }
  await cancelInvoice(inv.id, { reason: 4 });
  await audit(admin.id, "admin_subscription", { targetType: "subscription_invoice", targetId: inv.id, meta: { action: "cancel", via: "telegram" } });
  if (inv.userId) {
    // Xabar va havola hisob TURIGA mos: kontakt / kurs xaridi / obuna (ilgari hammasiga «Obuna o'tkazmasi…» va obuna sahifasi ketardi)
    const tail = "administrator tomonidan topilmadi yoki rad etildi. Pul yuborgan bo'lsangiz qo'llab-quvvatlashga yozing.";
    if (contact) await notify(inv.userId, "payment_cancelled", "Kontakt o'tkazmasi tasdiqlanmadi", `${contactMeta(inv).title} — ${formatPrice(inv.amount)} o'tkazmasi ${tail}`, contactHref(inv.id));
    else if (purchase) await notify(inv.userId, "payment_cancelled", "Xarid o'tkazmasi tasdiqlanmadi", `${purchaseMeta(inv).title} — ${formatPrice(inv.amount)} o'tkazmasi ${tail}`, purchaseHref(inv.id));
    else await notify(inv.userId, "payment_cancelled", "Obuna o'tkazmasi tasdiqlanmadi", `${invoiceNumber(inv.id)} — ${formatPrice(inv.amount)} o'tkazmasi ${tail}`, invoiceHref(inv.id));
  }
  return L(lang, "❌ Rad etildi — foydalanuvchiga xabar yuborildi", "❌ Отклонено — пользователю отправлено уведомление");
}

/** `mp:<ok|no>:<p|s>:<id>` — natija xabar ostiga yozilib, tugmalar olib tashlanadi. false — bu tugma bizniki emas */
async function handleManualApproval(chatId: string, data: string, answer: (t: string) => Promise<unknown>, cb: NonNullable<TelegramUpdate["callback_query"]>, msgId: number | null, lang: BotLang): Promise<boolean> {
  const m = /^mp:(ok|no):([ps]):([\w-]{1,64})$/.exec(data);
  if (!m) return false;
  // `adminByChat`: rol + blok + (ADMIN_REQUIRE_2FA yoqilgan bo'lsa) 2FA — pul tasdig'i admin panel bilan bir xil shartda
  const admin = await adminByChat(chatId);
  if (!admin) {
    await answer(L(lang, "Bu tugma faqat administrator uchun", "Эта кнопка только для администратора"));
    return true;
  }
  let result: string;
  try {
    result = m[2] === "p" ? await actOnPayment(admin, m[1] === "ok", m[3], lang) : await actOnInvoice(admin, m[1] === "ok", m[3], lang);
  } catch (e) {
    // Servis xatosi (o'zbekcha `ApiError`) rus tilidagi adminga lug'at orqali o'giriladi
    await answer(await errorText(e, lang, "Xatolik — admin panelda ko'rib chiqing", "Ошибка — проверьте в админ-панели"));
    return true;
  }
  await answer(result);
  // Asl xabar ostiga natijani yozamiz — tugmalar yo'qoladi (ikkinchi marta bosib bo'lmaydi)
  if (msgId) {
    const orig = typeof cb.message?.text === "string" ? cb.message.text : "";
    await telegramApi("editMessageText", {
      chat_id: chatId,
      message_id: msgId,
      text: `${escapeTelegramHtml(orig)}\n\n<b>${escapeTelegramHtml(result)}</b> · ${escapeTelegramHtml(admin.name)}`,
      parse_mode: "HTML",
    });
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Majburiy obuna darvozasi                                            */
/* ------------------------------------------------------------------ */

/** Darvozadan tashqari tugmalar: tekshirishning o'zi, til, saytdan boshlangan to'lov/kirish oqimi, admin tugmalari (ular o'zi admin ekanini tekshiradi) */
const GATE_FREE_CALLBACK = /^(sub:|lng:|bp:|bd:|cx:|lg:|mp:|adm:|bc:)/;

/**
 * Majburiy obuna darvozasi (2026-11-06): rasmiy kanalga obuna bo'lmagan foydalanuvchi botdan foydalana olmaydi.
 * Istisno: `/stop`, saytdan kelgan login/to'lov deep-link'lari (`/start l_…`, `/start b_…`) va ularning KEYINGI qadamlari
 * (ro'yxat oqimi javoblari, chek rasmi — `gateExempt`), adminlar. Darvoza to'xtatgan `/start <payload>` eslab qolinadi va
 * «Tekshirish»dan keyin qayta ijro etiladi (ulash kodi yo'qolmaydi). Darvoza o'chiq bo'lsa (env yo'q) doim `true`.
 */
async function gateMessage(chatId: string, text: string, kind: "text" | "media", lang: BotLang): Promise<boolean> {
  if (!gateEnabled()) return true;
  if (/^\/stop(@\w+)?(\s|$)/i.test(text)) return true;
  const start = /^\/start(?:@\w+)?(?:\s+(\S+))?/i.exec(text);
  const payload = start?.[1] ?? "";
  if (payload.startsWith("l_") || payload.startsWith("b_")) return true; // login / to'lov deep-link (saytdan boshlanadi)
  if (await isChannelMember(chatId)) return true;
  if (await adminByChat(chatId)) return true; // adminlar darvozasiz
  if (kind === "media" ? await gateExempt(chatId, "receipt") : !text.startsWith("/") && (await gateExempt(chatId, "flow"))) return true;
  if (payload && payload !== GATE_START) await rememberGatedStart(chatId, payload);
  await sendJoinGate(chatId, lang);
  return false;
}

/** Inline rejimdagi «Avval kanalga obuna bo'ling» tugmasi botni shu payload bilan ochadi — ulash kodi emas, oddiy `/start` */
const GATE_START = "gate";

/** Tugma uchun darvoza: a'zo emas → qisqa javob + darvoza xabari. `true` — davom etish mumkin */
async function gateCallback(chatId: string, data: string, answer: (t: string) => Promise<unknown>, lang: BotLang): Promise<boolean> {
  if (!gateEnabled() || GATE_FREE_CALLBACK.test(data)) return true;
  if (await isChannelMember(chatId)) return true;
  if (await adminByChat(chatId)) return true;
  if (data.startsWith("rg:") && (await gateExempt(chatId, "flow"))) return true;
  if (data.startsWith("pst:") && (await gateExempt(chatId, "receipt"))) return true;
  await answer(L(lang, "Avval kanalga obuna bo'ling", "Сначала подпишитесь на канал"));
  await sendJoinGate(chatId, lang);
  return false;
}

/* ------------------------------------------------------------------ */
/* /start va /stop                                                     */
/* ------------------------------------------------------------------ */

/** `/start <ulash kodi>` — sayt hisobini shu chatga ulash; kodsiz — xush kelibsiz ekrani */
async function handleStart(chatId: string, code: string, firstName?: string, lang: BotLang = "uz"): Promise<void> {
  // Kodsiz /start — xush kelibsiz ekrani (ulangan bo'lsa menyu, bo'lmasa ulash tugmasi)
  if (!code) {
    const me = await accountOf(chatId);
    await sendWelcome(chatId, me && !me.isBanned ? me : null, firstName, lang);
    return;
  }
  const userId = verifyTelegramLinkCode(code);
  if (!userId) {
    await sendTelegram(chatId, L(lang, "Kod noto'g'ri yoki eskirgan. Saytda Kabinet → Profil → «Telegramga ulash» orqali yangi havola oling.", "Код неверный или устарел. Получите новую ссылку на сайте: Кабинет → Профиль → «Подключить Telegram»."), {
      keyboard: [[pageButton(L(lang, "🔗 Hisobni ulash", "🔗 Привязать аккаунт"), "/kabinet/profil?tab=telegram#telegram")]],
    });
    return;
  }
  const prevChat = (await db.query.users.findFirst({ where: eq(users.id, userId), columns: { telegramChatId: true } }))?.telegramChatId ?? null;
  // Bitta chat — bitta hisob: shu chatId boshqa foydalanuvchida bo'lsa, avval undan uzamiz
  await db
    .update(users)
    .set({ telegramChatId: null })
    .where(and(eq(users.telegramChatId, chatId), ne(users.id, userId)));
  const [row] = await db.update(users).set({ telegramChatId: chatId }).where(eq(users.id, userId)).returning({ id: users.id });
  if (!row) {
    await sendTelegram(chatId, L(lang, "Hisob topilmadi. Saytdan qayta urinib ko'ring: Kabinet → Profil → «Telegramga ulash».", "Аккаунт не найден. Попробуйте ещё раз на сайте: Кабинет → Профиль → «Подключить Telegram»."));
    return;
  }
  // Yangi Telegram ulandi (yoki boshqasi almashtirildi) — egaga sayt + email orqali ham xabar (3-audit): begona Telegram
  // ulangan bo'lsa, barcha bildirishnomalar (to'lov, xabarlar, kirish kodlari) unga oqib ketadi
  if (prevChat !== chatId) {
    await notify(
      userId,
      "account",
      "Telegram hisobingizga ulandi",
      `${firstName ? `«${firstName}» ` : ""}Telegram hisobi ulandi — endi bildirishnomalar shu Telegramga keladi.${prevChat ? " Oldingi Telegram uzildi." : ""} Bu siz bo'lmasangiz — Kabinet → Profil'da uzing va parolni almashtiring.`,
      "/kabinet/profil?tab=telegram#telegram",
    ).catch(() => undefined);
  }
  // Chat ulanishidan oldin `/til` bilan til tanlagan bo'lsa — tanlov hisobga ko'chadi (hisobning o'z tili bo'lsa u ustun)
  await adoptGuestLang(chatId, userId);
  // Ulandi — xush kelibsiz ekrani doimiy menyu bilan; admin bo'lsa buyruqlar menyusiga admin buyruqlari qo'shiladi
  const me = await accountOf(chatId);
  // Til: hisobda tanlangan bo'lsa o'sha (sayt/`/til`), aks holda chatning hozirgi tili
  const finalLang: BotLang = me?.lang === "ru" || me?.lang === "uz" ? me.lang : lang;
  if (me?.role === "admin") await setAdminCommands(chatId, finalLang).catch(() => false);
  await sendWelcome(chatId, me && !me.isBanned ? me : null, firstName, finalLang);
}

/**
 * `/start <payload>` taqsimoti — buyruqdan ham, majburiy obuna «Tekshirish»idan keyingi qayta ijrodan ham chaqiriladi:
 * `reg` — ro'yxat; `l_<kod>` — saytga kirish tasdig'i; `b_…` — xarid / kontakt; boshqa — ulash kodi (yoki bo'sh — menyu).
 */
async function dispatchStart(chatId: string, rawArg: string, who: Who, firstName: string | undefined): Promise<void> {
  const lang = who.lang;
  const arg = rawArg === GATE_START ? "" : rawArg;
  if (arg === "reg") {
    await startRegistration(chatId, who);
    return;
  }
  if (arg.startsWith("l_")) {
    // `l_<kod>` — kirish kodini TERIB topishga qarshi alohida (qattiqroq) chegara
    if (await botLimited(chatId, "tgStart")) {
      await sendTelegram(chatId, LIMITED_TEXT(lang));
      return;
    }
    if (await handleLoginStart(chatId, arg, who)) return;
  }
  if (arg.startsWith("b_") && ((await handleBuyStart(chatId, arg, lang)) || (await handleContactBuyStart(chatId, arg, lang)))) return;
  await handleStart(chatId, arg, firstName, lang);
}

async function handleStop(chatId: string, lang: BotLang): Promise<void> {
  const res = await db.update(users).set({ telegramChatId: null }).where(eq(users.telegramChatId, chatId));
  await clearChatCommands(chatId).catch(() => undefined);
  await clearBotSession(chatId).catch(() => undefined);
  if (res.rowsAffected > 0) {
    await sendTelegram(chatId, L(lang, "Telegram bildirishnomalari uzildi. Qayta ulash: saytda Kabinet → Profil → «Telegramga ulash».", "Уведомления в Telegram отключены. Подключить снова: на сайте Кабинет → Профиль → «Подключить Telegram»."), { removeKeyboard: true });
  } else {
    await sendTelegram(chatId, L(lang, "Bu chat hech qaysi hisobga ulanmagan edi. Ulash: saytda Kabinet → Profil → «Telegramga ulash».", "Этот чат не был привязан ни к одному аккаунту. Подключить: на сайте Кабинет → Профиль → «Подключить Telegram»."), { removeKeyboard: true });
  }
}

/* ------------------------------------------------------------------ */
/* Tugmalar (callback_query)                                           */
/* ------------------------------------------------------------------ */

/** Inline tugma bosildi. Tugma faqat o'z shaxsiy chatida ishlaydi; har holatda javob beriladi (tugma «aylanib» qolmaydi) */
async function handleCallback(cb: NonNullable<TelegramUpdate["callback_query"]>): Promise<void> {
  const cbId = cb.id != null ? String(cb.id) : "";
  const data = typeof cb.data === "string" ? cb.data : "";
  // Faqat shaxsiy chat va tugmani bosgan odam = chat egasi (shaxsiy chatda chat.id === from.id). Guruhga tushib qolgan
  // tugmali xabarni (masalan, admin xabari) boshqa a'zo bosa olmasin — himoya qatlami (3-audit, 2026-10-31)
  const rawChat = cb.message?.chat;
  const ownChat = rawChat?.id != null && rawChat.type === "private" && cb.from?.id != null && String(cb.from.id) === String(rawChat.id);
  const chatId = ownChat ? String(rawChat.id) : "";
  const msgId = typeof cb.message?.message_id === "number" ? cb.message.message_id : null;
  let answered = false;
  const answer = (text: string) => {
    answered = true;
    return telegramApi("answerCallbackQuery", { callback_query_id: cbId, text: text.slice(0, 190) });
  };
  const from = cb.from ?? {};
  let lang: BotLang = botLang(from.language_code);
  try {
    if (!chatId) {
      // Begona chat/guruhdagi tugma: hech narsa bajarilmaydi — faqat umumiy javob (tugma «aylanib» qolmasin)
      await answer(L(lang, "Noma'lum amal", "Неизвестное действие"));
      return;
    }
    const me = (await accountOf(chatId)) ?? null;
    lang = await resolveLang(chatId, me, from.language_code);
    const who = whoOf(from, lang);
    // Chegara: javob BILAN (ilgari chegarada tugma javobsiz qolib, «aylanib» turardi)
    if (await botLimited(chatId, "tgBot")) {
      await answer(LIMITED_TEXT(lang));
      return;
    }
    // Majburiy obuna: «✅ Tekshirish» — a'zolikni qayta tekshiradi; darvoza to'xtatgan `/start <payload>` shu yerda davom etadi
    if (data === "sub:check") {
      if (await handleGateCheck(chatId, answer, lang)) {
        const payload = await takeGatedStart(chatId);
        if (payload) await dispatchStart(chatId, payload, who, from.first_name);
        else await sendWelcome(chatId, me && !me.isBanned ? me : null, from.first_name, lang);
      }
      return;
    }
    // Bloklangan hisob: botdagi barcha amallar yopiq — qo'llab-quvvatlashga yozishdan tashqari (blok matni shu yo'lni ko'rsatadi)
    if (me?.isBanned && !data.startsWith("sup:")) {
      await answer(BANNED_TEXT(lang));
      return;
    }
    if (!(await gateCallback(chatId, data, answer, lang))) return;
    // Qo'llab-quvvatlashga yozish (`sup:start|no`) — hisobsiz va bloklangan foydalanuvchiga ham ochiq
    if (await handleSupportCallback(chatId, data, answer, lang)) return;
    // Til tanlash (`/til`): hisobda yoki (hisobsiz chatda) chatning o'zida saqlanadi
    if (await handleLanguageCallback(chatId, data, answer, msgId, me, lang)) return;
    // «Telegram bilan kirish» tasdig'i — kodni terib topishga qarshi qattiqroq chegara (`/start l_` bilan bir xil o'lcham, alohida hisob)
    if (data.startsWith("lg:") && (await botLimited(chatId, "tgStart", "cb"))) {
      await answer(LIMITED_TEXT(lang));
      return;
    }
    // Mentorlik xaridi, «Telegram bilan kirish» va buyurtma tugmalari — admin tekshiruvi kerak emas
    if (await handlePayCallback(chatId, data, answer, lang)) return;
    if (await handleContactPayCallback(chatId, data, answer, lang)) return;
    if (await handleAdminCallback(chatId, data, answer, msgId, lang)) return;
    if (await handlePostCallback(chatId, data, answer, msgId, lang)) return;
    if (await handleRegisterCallback(chatId, data, answer, msgId, who)) return;
    if (await handleLoginCallback(chatId, data, answer, who)) return;
    if (await handleOrderCallback(chatId, data, answer, lang, msgId)) return;
    // Vakansiya arizasi kartasi («Tanlovga olish / Rad etish») va shaxsiy xabarlar (o'qish / javob yozish)
    if (await handleApplicationCallback(chatId, data, answer, msgId, lang)) return;
    if (await handleDmCallback(chatId, data, answer, lang)) return;
    if (await handleSettingsCallback(chatId, data, answer, msgId, lang)) return;
    if (await handleMenuCallback(chatId, data, answer, lang)) return;
    if (await handleBroadcastCallback(chatId, data, answer, msgId, lang)) return;
    if (await handleManualApproval(chatId, data, answer, cb, msgId, lang)) return;
    await answer(L(lang, "Noma'lum amal", "Неизвестное действие"));
  } catch (e) {
    console.error("[telegram:webhook:callback]", e);
  } finally {
    // Handler javob bermasdan yiqilgan bo'lsa ham tugma «aylanib» qolmasin
    if (!answered && cbId) await answer(L(lang, "Xatolik yuz berdi — qaytadan urinib ko'ring", "Произошла ошибка — попробуйте ещё раз")).catch(() => undefined);
  }
}

/* ------------------------------------------------------------------ */
/* Xabarlar                                                            */
/* ------------------------------------------------------------------ */

type TgMessage = NonNullable<TelegramUpdate["message"]>;

/** Xabardagi rasm / video (bot post yoki chek sifatida qabul qiladigan turlar); bo'lmasa null */
function mediaOf(msg: TgMessage): IncomingMedia | null {
  const photo = msg.photo?.length ? msg.photo[msg.photo.length - 1] : null;
  const imgDoc = msg.document?.mime_type?.startsWith("image/") ? msg.document : null;
  const pdfDoc = msg.document?.mime_type === "application/pdf" ? msg.document : null;
  const vid = msg.video?.file_id ? msg.video : null;
  const vidDoc = !vid && msg.document?.mime_type?.startsWith("video/") ? msg.document : null;
  if (photo?.file_id) return { fileId: photo.file_id, kind: "photo", mime: "image/jpeg", size: photo.file_size ?? 0, width: photo.width, height: photo.height };
  if (imgDoc?.file_id) return { fileId: imgDoc.file_id, kind: "photo", mime: imgDoc.mime_type ?? "image/jpeg", size: imgDoc.file_size ?? 0 };
  if (pdfDoc?.file_id) return { fileId: pdfDoc.file_id, kind: "pdf", mime: "application/pdf", size: pdfDoc.file_size ?? 0 };
  if (vid?.file_id) return { fileId: vid.file_id, kind: "video", mime: vid.mime_type ?? "video/mp4", size: vid.file_size ?? 0, duration: vid.duration, width: vid.width, height: vid.height };
  if (vidDoc?.file_id) return { fileId: vidDoc.file_id, kind: "video", mime: vidDoc.mime_type ?? "video/mp4", size: vidDoc.file_size ?? 0 };
  return null;
}

const ADMIN_COMMANDS = new Set(["/admin", "/stat", "/navbat", "/tolovlar", "/user", "/narx", "/shikoyatlar", "/mentorlar", "/nizolar", "/payoutlar", "/konkurs", "/tuzoq", "/blok", "/blokdan"]);

async function handleMessage(msg: TgMessage): Promise<void> {
  const chatId = msg.chat?.id != null ? String(msg.chat.id) : "";
  // Faqat shaxsiy chat: guruhga qo'shilgan botdagi xabarlar e'tiborga olinmaydi
  if (!chatId || msg.chat?.type !== "private") return;
  const from = msg.from ?? {};
  const me = (await accountOf(chatId)) ?? null;
  const lang = await resolveLang(chatId, me, from.language_code);
  const who = whoOf(from, lang);
  const firstName = typeof from.first_name === "string" ? from.first_name : undefined;
  const text = typeof msg.text === "string" ? msg.text.trim() : "";

  // Telegram'ning o'z to'lovi — pul allaqachon yechilgan: chegara ham, darvoza ham to'xtatmaydi
  if (msg.successful_payment) {
    await handleSuccessfulPayment(chatId, msg.successful_payment, lang);
    return;
  }
  // Chegara (xabar, buyruq, fayl) — tugma va inline chegaralaridan ALOHIDA; ogohlantirish oynada bir marta
  if (await botLimited(chatId, "tgMsg")) {
    if (await shouldWarnLimited(chatId)) await sendTelegram(chatId, LIMITED_TEXT(lang));
    return;
  }
  const media = mediaOf(msg);
  // Majburiy obuna darvozasi — media/kontakt/matndan OLDIN (istisnolar: gateMessage izohi)
  if (!(await gateMessage(chatId, text, media ? "media" : "text", lang))) return;

  // Doimiy menyu tugmasi (📦 Buyurtmalarim …) — buyruqqa aylantiriladi
  const normalized = MENU_COMMAND[text] ?? text;
  const [rawCmd = "", arg = ""] = normalized.split(/\s+/);
  const cmd = rawCmd.startsWith("/") ? rawCmd.split("@")[0].toLowerCase() : ""; // "/start@BotNomi" ham qabul qilinadi

  const caption = typeof msg.caption === "string" ? msg.caption : "";
  /** Qo'llab-quvvatlashga yozuvchi: hisob (bo'lsa) + Telegram ismi/taxallusi (mehmon bilan yagona aloqa) */
  const sender: SupportSender = { userId: me?.id ?? null, name: who.name, username: who.username };

  // Bloklangan hisob: faqat uzish va qo'llab-quvvatlashga yozish mumkin — o'qish buyruqlari ham yopiq (ochilgan kontaktlar,
  // buyurtmalar, profil, kurslar). /yordam to'g'ridan-to'g'ri murojaat rejimini ochadi (blok matni shu yo'lni ko'rsatadi)
  if (me?.isBanned) {
    if (cmd === "/stop") await handleStop(chatId, lang);
    else if (cmd === "/yordam" || cmd === "/help" || cmd === "/support") await startSupport(chatId, lang);
    else if (media ? await handleSupportMedia(chatId, media, caption, lang, sender) : !cmd && Boolean(text) && (await handleSupportText(chatId, text, lang, sender))) return;
    else await sendTelegram(chatId, BANNED_TEXT(lang), { removeKeyboard: true });
    return;
  }

  // Rasm / rasm-hujjat / PDF / video — faol oqimga (qo'llab-quvvatlash skrinshoti, suhbatga javob) yoki chek (ochiq karta xaridi
  // bo'lsa) / lentaga post taklifi (lib/telegram-bot/media.ts)
  if (media) {
    const flow = (await getBotSession(chatId))?.flow ?? null;
    if (flow === "support" && (await handleSupportMedia(chatId, media, caption, lang, sender))) return;
    if (flow === "dm" && (await handleDmMedia(chatId, lang))) return;
    await handleIncomingMedia(chatId, media, caption, lang, typeof msg.media_group_id === "string" ? msg.media_group_id : null);
    return;
  }
  // Ro'yxatdan o'tishda «Raqamni ulashish» — faqat o'z raqami (user_id = from.id)
  if (msg.contact) {
    if (await handleRegisterContact(chatId, msg.contact, from.id != null ? String(from.id) : "")) return;
    await handleRegisterStray(chatId, null, lang, me);
    return;
  }
  if (!text) {
    // Matn ham, bot tushunadigan fayl ham emas (ovozli xabar, stiker, joylashuv, boshqa hujjat…) — jim qolmaymiz
    await sendTelegram(chatId, L(lang, "Bu turdagi xabarni hali tushunmayman. Matn yozing (ijodkor qidiraman), rasm yoki video yuboring (post / to'lov cheki) — yoki /yordam.", "Такой тип сообщений я пока не понимаю. Напишите текст (найду специалиста), отправьте фото или видео (пост / чек оплаты) — или /yordam."));
    return;
  }

  // Savol-javob oqimi (ro'yxatdan o'tish / elon / post izohi / qo'llab-quvvatlash / suhbatga javob): oddiy matn faol oqimga
  // ketadi; har qanday buyruq oqimni to'xtatadi. Sessiya BIR MARTA o'qiladi — faqat faol oqim ishlovchisi chaqiriladi.
  if (!cmd) {
    const flow = (await getBotSession(chatId))?.flow ?? null;
    if (flow === "register" && (await handleRegisterText(chatId, text))) return;
    if (flow === "broadcast" && (await handleBroadcastText(chatId, text, lang))) return;
    if (flow === "post" && (await handlePostText(chatId, text, lang))) return;
    if (flow === "adminprice" && (await handleAdminPriceText(chatId, text, lang))) return;
    if (flow === "support" && (await handleSupportText(chatId, text, lang, sender))) return;
    if (flow === "dm" && (await handleDmText(chatId, text, lang, typeof msg.reply_to_message?.message_id === "number" ? msg.reply_to_message.message_id : null))) return;
    // Yopilgan ro'yxat oqimidan qolgan klaviatura tugmasi — qidiruvga ketmasin
    if (await handleRegisterStray(chatId, text, lang, me)) return;
    await handleSearch(chatId, text, lang); // oddiy matn — ijodkor qidiruvi
    return;
  }
  await clearBotSession(chatId).catch(() => undefined);

  if (cmd === "/royxat" || cmd === "/register") await startRegistration(chatId, who);
  else if (cmd === "/start") await dispatchStart(chatId, arg, who, firstName);
  else if (cmd === "/kurslarim" || cmd === "/xaridlar") await handleMyPurchases(chatId, lang);
  else if (cmd === "/buyurtmalarim" || cmd === "/buyurtmalar") await handleMyOrders(chatId, lang);
  else if (cmd === "/xabarlar" || cmd === "/chat") await handleMessages(chatId, lang);
  else if (cmd === "/arizalar") await handleEmployerApplications(chatId, lang);
  else if (cmd === "/arizalarim") await handleMyApplications(chatId, lang);
  else if (cmd === "/support" || cmd === "/murojaat") await startSupport(chatId, lang);
  else if (cmd === "/bekor" || cmd === "/cancel") {
    // Faol oqim yuqorida (har buyruqda) yopildi — klaviatura holatga mos qaytariladi
    await sendTelegram(chatId, L(lang, "Bekor qilindi.", "Отменено."), me ? { replyKeyboard: menuRows(me.role === "admin", lang) } : { removeKeyboard: true });
  }
  else if (cmd === "/ilova" || cmd === "/app") await sendApp(chatId, lang);
  else if (cmd === "/qidiruv" || cmd === "/qidir") await handleSearch(chatId, normalized.slice(rawCmd.length), lang);
  else if (cmd === "/kurslar") await handleCourses(chatId, lang);
  else if (cmd === "/efirlar" || cmd === "/efir") await handleLives(chatId, lang);
  else if (cmd === "/top") await handleTop(chatId, lang);
  else if (cmd === "/vakansiyalar") await handleVacancies(chatId, lang);
  else if (cmd === "/profil") await handleProfile(chatId, lang);
  else if (cmd === "/sozlamalar") await handleSettings(chatId, lang);
  else if (cmd === "/til" || cmd === "/lang" || cmd === "/language") await sendLanguageChoice(chatId, lang);
  else if (cmd === "/menyu") await handleStart(chatId, "", firstName, lang);
  else if (cmd === "/elon") await handleBroadcastStart(chatId, text, lang);
  else if (cmd === "/post") await sendPostHelp(chatId, lang);
  else if (cmd === "/kontaktlarim" || cmd === "/kontaktlar") await handleMyContacts(chatId, lang);
  else if (ADMIN_COMMANDS.has(cmd)) {
    // Admin boti (lib/telegram-bot/admin.ts) — faqat admin hisobiga ulangan chat; matnlar `lang` bilan (uz/ru)
    const admin = await adminByChat(chatId);
    if (!admin) await sendTelegram(chatId, L(lang, "Bu buyruq faqat administrator uchun.", "Эта команда только для администратора."));
    else if (cmd === "/admin") await sendAdminMenu(chatId, lang);
    // Tuzoq holati va IP bloklash — tafsilotlar FAQAT shu yerda (admin chati); oddiy foydalanuvchiga hech qayerda aytilmaydi
    else if (cmd === "/tuzoq") await sendAdminTrap(chatId, lang);
    else if (cmd === "/blok") await handleAdminBlock(chatId, admin, normalized.slice(rawCmd.length), lang);
    else if (cmd === "/blokdan") await handleAdminUnblock(chatId, admin, normalized.slice(rawCmd.length), lang);
    else if (cmd === "/stat") await sendAdminStats(chatId, arg === "7" || arg === "7d" ? "7d" : arg === "30" || arg === "30d" ? "30d" : "today", null, lang);
    else if (cmd === "/navbat") await sendAdminQueues(chatId, lang);
    else if (cmd === "/tolovlar") await sendAdminPayments(chatId, lang);
    else if (cmd === "/shikoyatlar") await sendAdminReports(chatId, lang);
    else if (cmd === "/mentorlar") await sendAdminMentorApps(chatId, lang);
    else if (cmd === "/nizolar") await sendAdminDisputes(chatId, lang);
    else if (cmd === "/payoutlar") await sendAdminPayouts(chatId, lang);
    else if (cmd === "/konkurs") await handleAdminChallenge(chatId, normalized.slice(rawCmd.length), lang);
    else if (cmd === "/narx") await handleAdminPrices(chatId, normalized.slice(rawCmd.length), lang);
    else await handleAdminUserSearch(chatId, normalized.slice(rawCmd.length), lang);
  } else if (cmd === "/stop") await handleStop(chatId, lang);
  else await sendHelp(chatId, Boolean(me), me?.role === "admin", lang); // /yordam, /help va noma'lum buyruq
}

/* ------------------------------------------------------------------ */
/* Kirish nuqtasi                                                      */
/* ------------------------------------------------------------------ */

/**
 * `my_chat_member` (shaxsiy chat): foydalanuvchi botni blokladi → chat «yetib bo'lmaydigan» deb belgilanadi (ommaviy
 * yuborishlar unga urinmaydi); blokdan chiqardi yoki qayta ishga tushirdi → belgi olinadi (lib/telegram-bot/reach.ts).
 */
async function handleMyChatMember(m: NonNullable<TelegramUpdate["my_chat_member"]>): Promise<void> {
  if (m.chat?.type !== "private" || m.chat.id == null) return;
  const chatId = String(m.chat.id);
  const status = typeof m.new_chat_member?.status === "string" ? m.new_chat_member.status : "";
  if (status === "kicked" || status === "left") await markUnreachable(chatId, "foydalanuvchi botni blokladi");
  else if (status === "member") await markReachable(chatId);
}

/** Inline rejim (`@bot so'z`): alohida chegara (har harf — bitta so'rov), majburiy obuna, til */
async function handleInline(iq: NonNullable<TelegramUpdate["inline_query"]>): Promise<void> {
  const userId = iq.from?.id != null ? String(iq.from.id) : "";
  const id = iq.id != null ? String(iq.id) : "";
  if (!userId || !id) return;
  const empty = (extra: Record<string, unknown> = {}) => telegramApi("answerInlineQuery", { inline_query_id: id, results: [], cache_time: 5, is_personal: true, ...extra });
  if (await botLimited(userId, "tgInline")) {
    await empty({ cache_time: 30 });
    return;
  }
  const me = (await accountOf(userId)) ?? null;
  const lang = await resolveLang(userId, me, iq.from?.language_code);
  if (me?.isBanned) {
    await empty();
    return;
  }
  // Majburiy obuna: a'zo bo'lmagan foydalanuvchiga natija o'rniga botga o'tish tugmasi (u yerda darvoza chiqadi)
  if (gateEnabled() && !(await isChannelMember(userId)) && !(await adminByChat(userId))) {
    await empty({ button: { text: L(lang, "Avval kanalga obuna bo'ling", "Сначала подпишитесь на канал"), start_parameter: GATE_START } });
    return;
  }
  await handleInlineQuery(iq, lang);
}

export async function POST(req: Request) {
  if (!secretOk(req)) return Response.json({ ok: false }, { status: 401 });
  try {
    const update = (await req.json()) as TelegramUpdate;
    // Telegram javobni vaqtida olmasa update'ni qayta yuboradi — takrori ikkinchi marta bajarilmaydi
    if (typeof update?.update_id === "number" && !(await firstSeenUpdate(update.update_id))) return Response.json({ ok: true });
    if (update?.my_chat_member) await handleMyChatMember(update.my_chat_member);
    else if (update?.pre_checkout_query) await handlePreCheckout(update.pre_checkout_query);
    else if (update?.inline_query) await handleInline(update.inline_query);
    else {
      // Chatdan xabar/tugma keldi — foydalanuvchi botni bloklamagan: «yetib bo'lmaydigan» belgisi (bo'lsa) olinadi
      const activeChat = update?.message?.chat?.type === "private" ? update.message.chat.id : update?.callback_query?.message?.chat?.type === "private" ? update.callback_query.message.chat.id : null;
      if (activeChat != null) defer(() => markReachable(String(activeChat)), "reach");
      if (update?.callback_query) await handleCallback(update.callback_query);
      else if (update?.message) await handleMessage(update.message);
    }
  } catch (e) {
    // Har doim 200 — Telegram xatoli javobni qayta-qayta yuborib turadi
    console.error("[telegram:webhook]", e);
  }
  return Response.json({ ok: true });
}

export function GET() {
  return Response.json({ ok: false, error: "Faqat POST" }, { status: 405 });
}

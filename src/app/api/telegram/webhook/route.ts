import { timingSafeEqual } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { RATE_LIMITS, rateLimit } from "@/lib/security/rate-limit";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";
import { loadPaymentDetail } from "@/lib/payments/dto";
import { cancelPayment, markPaid, orderHref } from "@/lib/payments/service";
import { cancelInvoice, invoiceHref, loadInvoice, markInvoicePaid } from "@/lib/subscriptions/billing";
import { invoiceNumber } from "@/lib/subscriptions/labels";
import { escapeTelegramHtml, sendTelegram, telegramApi, telegramWebhookSecret, verifyTelegramLinkCode } from "@/lib/telegram";
import { siteUrl } from "@/lib/security/site";
import { formatPrice } from "@/lib/utils";
import { handleBuyStart, handleMyPurchases, handlePayCallback, handlePreCheckout, handleSuccessfulPayment } from "@/lib/mentorship/telegram-pay";
import { handleIncomingMedia, handlePostCallback, handlePostText, sendPostHelp, type IncomingMedia } from "@/lib/telegram-bot/media";
import { accountOf, handleBroadcastCallback, handleBroadcastStart, handleBroadcastText, handleCourses, handleMyContacts, handleLives, handleLoginCallback, handleLoginStart, handleMenuCallback, handleMessages, handleMyOrders, handleOrderCallback, handleProfile, handleSearch, handleSettings, handleSettingsCallback, handleTop, handleVacancies } from "@/lib/telegram-bot/actions";
import { MENU_COMMAND, clearChatCommands, sendApp, sendHelp, sendWelcome, setAdminCommands } from "@/lib/telegram-bot/ui";
import { handleRegisterCallback, handleRegisterContact, handleRegisterText, startRegistration } from "@/lib/telegram-bot/register";
import { clearBotSession } from "@/lib/telegram-bot/session";
import { handleInlineQuery } from "@/lib/telegram-bot/inline";
import { handleContactBuyStart, handleContactPayCallback } from "@/lib/telegram-bot/contact-pay";
import { botLang, type BotLang } from "@/lib/telegram-bot/lang";
import { adminByChat, handleAdminCallback, handleAdminPriceText, handleAdminPrices, handleAdminUserSearch, sendAdminMenu, sendAdminDisputes, sendAdminMentorApps, sendAdminPayments, sendAdminPayouts, sendAdminQueues, sendAdminReports, sendAdminStats } from "@/lib/telegram-bot/admin";

/**
 * Telegram Bot API webhook (setWebhook bilan o'rnatiladi — docs/DEPLOY.md §11).
 *
 * Xavfsizlik: `x-telegram-bot-api-secret-token` sarlavhasi TELEGRAM_WEBHOOK_SECRET ga teng bo'lishi SHART
 * (aks holda 401). Tekshiruvdan o'tgan so'rovga HAR DOIM 200 qaytadi — ichki xato Telegram'ning retry
 * bo'ronini keltirib chiqarmasin (xato faqat logga yoziladi).
 *
 * Faqat shaxsiy chatdagi matnli xabarlar (bot UI va matnlar: lib/telegram-bot/ui.ts):
 *   /start           — xush kelibsiz ekrani (banner + doimiy menyu yoki «Hisobni ulash»)
 *   /start <kod>     — hisobni ulash (kod: /api/telegram/link, 15 daqiqa amal qiladi)
 *   /start l_<kod>   — «Telegram bilan kirish» tasdig'i
 *   /start b_<tur>_<id> — mentorlik xaridi (to'lov usuli tugmalari: lib/mentorship/telegram-pay.ts); b_x_<id> — kontakt ochish (lib/telegram-bot/contact-pay.ts)
 *   /ilova · /buyurtmalarim · /xabarlar · /qidiruv <so'z> · /kurslar · /kurslarim · /efirlar · /vakansiyalar · /top
 *   /profil · /sozlamalar · /yordam · /stop · /elon (faqat admin: ommaviy e'lon, auditoriya tugmalari)
 *   /admin · /stat · /navbat · /tolovlar · /user <q> — admin boti (lib/telegram-bot/admin.ts), tugmalar `adm:*`
 *   doimiy menyu tugmalari (📦 Buyurtmalarim …) — MENU_COMMAND orqali shu buyruqlarga aylanadi
 *   boshqa matn      — ijodkor qidiruvi (exploreSearch)
 *
 * callback_query (`mp:<ok|no>:<p|s>:<id>`) — qo'lda o'tkazmani ADMIN bir bosishda tasdiqlashi/rad etishi
 * (lib/manual-approval.ts yuborgan tugmalar). Chat admin hisobiga ulanganligi majburiy tekshiriladi.
 */

function secretOk(req: Request): boolean {
  // Sir env'dan yoki AUTH_SECRET'dan avtomatik (telegramWebhookSecret) — admin paneldagi
  // "Webhookni o'rnatish" ham aynan shu qiymat bilan setWebhook qiladi
  const expected = process.env.TELEGRAM_BOT_TOKEN ? telegramWebhookSecret() : "";
  const got = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!expected || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/** Telegram update'ining bizga kerakli qismi (to'liq tip shart emas) */
interface TelegramUpdate {
  message?: {
    text?: unknown;
    from?: { id?: unknown; first_name?: string; last_name?: string; username?: string; language_code?: string };
    chat?: { id?: unknown; type?: unknown };
    caption?: unknown;
    photo?: { file_id?: string; file_size?: number; width?: number; height?: number }[];
    video?: { file_id?: string; mime_type?: string; file_size?: number; width?: number; height?: number; duration?: number };
    document?: { file_id?: string; mime_type?: string; file_size?: number };
    successful_payment?: { invoice_payload?: unknown; telegram_payment_charge_id?: unknown; provider_payment_charge_id?: unknown; total_amount?: unknown; currency?: unknown };
    /** «Raqamni ulashish» (request_contact) — ro'yxatdan o'tishda telefon */
    contact?: { phone_number?: unknown; user_id?: unknown };
  };
  pre_checkout_query?: { id: string; from?: { id?: unknown }; invoice_payload?: unknown; total_amount?: unknown; currency?: unknown };
  inline_query?: { id?: unknown; from?: { id?: unknown; language_code?: string }; query?: unknown; offset?: unknown };
  callback_query?: {
    id?: unknown;
    data?: unknown;
    from?: { id?: unknown; first_name?: string; last_name?: string; username?: string; language_code?: string };
    message?: { message_id?: unknown; text?: unknown; chat?: { id?: unknown; type?: string } };
  };
}

/* ------------------------------------------------------------------ */
/* Qo'lda o'tkazmani Telegramdan bir bosishda tasdiqlash / rad etish   */
/* ------------------------------------------------------------------ */

/** Buyurtma to'lovi bo'yicha amal — admin route'dagi confirm/cancel bilan bir xil qoidalar */
async function actOnPayment(admin: { id: string; name: string }, confirm: boolean, id: string): Promise<string> {
  const p = await loadPaymentDetail(id);
  if (!p) throw new ApiError(404, "To'lov topilmadi");
  if (p.provider !== "manual") throw new ApiError(400, "Bu to'lov provayder orqali tasdiqlanadi");
  if (p.state === "paid" || p.state === "released") return "Allaqachon tasdiqlangan ✓";
  if (p.state === "cancelled" || p.state === "refunded") return "Allaqachon rad etilgan";
  if (confirm) {
    await markPaid(p.id, { actorId: admin.id, providerTxnId: p.providerTxnId ?? `manual-${p.id.slice(0, 8)}` });
    await audit(admin.id, "admin_payment", { targetType: "payment", targetId: p.id, meta: { action: "confirm", via: "telegram" } });
    return `✅ Tasdiqlandi — ${formatPrice(p.amount)} eskrouga qabul qilindi`;
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
  return "❌ Rad etildi — mijozga xabar yuborildi";
}

/** Obuna hisobi bo'yicha amal — admin obuna route'i bilan bir xil qoidalar */
async function actOnInvoice(admin: { id: string; name: string }, confirm: boolean, id: string): Promise<string> {
  const inv = await loadInvoice(id);
  if (!inv) throw new ApiError(404, "Obuna hisobi topilmadi");
  if (inv.provider !== "manual") throw new ApiError(400, "Bu hisob provayder orqali tasdiqlanadi");
  if (inv.state === "paid") return "Allaqachon tasdiqlangan ✓";
  if (inv.state === "cancelled" || inv.state === "refunded") return "Allaqachon rad etilgan";
  if (confirm) {
    await markInvoicePaid(inv.id, { actorId: admin.id, providerTxnId: inv.providerTxnId ?? `manual-${inv.id}`, note: "Telegram orqali tasdiqlandi" });
    await audit(admin.id, "admin_subscription", { targetType: "subscription_invoice", targetId: inv.id, meta: { action: "confirm", via: "telegram", amount: inv.amount, months: inv.months } });
    const kind = (inv.meta as { kind?: string } | null)?.kind;
    return kind === "contact" ? "✅ Tasdiqlandi — kontakt mijozga ochildi" : kind === "purchase" ? "✅ Tasdiqlandi — xarid faollashtirildi" : `✅ Tasdiqlandi — ${inv.months} oylik obuna faollashtirildi`;
  }
  await cancelInvoice(inv.id, { reason: 4 });
  await audit(admin.id, "admin_subscription", { targetType: "subscription_invoice", targetId: inv.id, meta: { action: "cancel", via: "telegram" } });
  if (inv.userId) {
    await notify(
      inv.userId,
      "payment_cancelled",
      "Obuna o'tkazmasi tasdiqlanmadi",
      `${invoiceNumber(inv.id)} — ${formatPrice(inv.amount)} o'tkazmasi administrator tomonidan topilmadi yoki rad etildi. Pul yuborgan bo'lsangiz qo'llab-quvvatlashga yozing.`,
      invoiceHref(inv.id),
    );
  }
  return "❌ Rad etildi — foydalanuvchiga xabar yuborildi";
}

/** Inline tugma bosildi: faqat admin hisobiga ulangan chat; natija xabar ostiga yozilib, tugmalar olib tashlanadi */
async function handleCallback(cb: NonNullable<TelegramUpdate["callback_query"]>): Promise<void> {
  const cbId = cb.id != null ? String(cb.id) : "";
  const data = typeof cb.data === "string" ? cb.data : "";
  // Faqat shaxsiy chat va tugmani bosgan odam = chat egasi (shaxsiy chatda chat.id === from.id). Guruhga tushib qolgan
  // tugmali xabarni (masalan, admin xabari) boshqa a'zo bosa olmasin — himoya qatlami (3-audit, 2026-10-31)
  const rawChat = cb.message?.chat;
  const ownChat = rawChat?.id != null && rawChat.type === "private" && cb.from?.id != null && String(cb.from.id) === String(rawChat.id);
  const chatId = ownChat ? String(rawChat.id) : "";
  const msgId = typeof cb.message?.message_id === "number" ? cb.message.message_id : null;
  const answer = (text: string) => telegramApi("answerCallbackQuery", { callback_query_id: cbId, text: text.slice(0, 190) });

  const from = cb.from ?? {};
  const who = { name: [from.first_name, from.last_name].filter(Boolean).join(" ") || undefined, username: typeof from.username === "string" ? from.username : undefined, lang: botLang(from.language_code) };
  // Mentorlik xaridi, «Telegram bilan kirish» va buyurtma tugmalari — admin tekshiruvi kerak emas
  if (chatId && (await handlePayCallback(chatId, data, answer, who.lang))) return;
  if (chatId && (await handleContactPayCallback(chatId, data, answer, who.lang))) return;
  if (chatId && (await handleAdminCallback(chatId, data, answer, msgId))) return;
  if (chatId && (await handlePostCallback(chatId, data, answer, msgId, who.lang))) return;
  if (chatId && (await handleRegisterCallback(chatId, data, answer, msgId, who))) return;
  if (chatId && (await handleLoginCallback(chatId, data, answer, who))) return;
  if (chatId && (await handleOrderCallback(chatId, data, answer))) return;
  if (chatId && (await handleSettingsCallback(chatId, data, answer, msgId, who.lang))) return;
  if (chatId && (await handleMenuCallback(chatId, data, answer, who.lang))) return;
  if (chatId && (await handleBroadcastCallback(chatId, data, answer, msgId))) return;

  const m = /^mp:(ok|no):([ps]):([\w-]{1,64})$/.exec(data);
  if (!m || !chatId) {
    await answer("Noma'lum amal");
    return;
  }
  const admin = await db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, name: true, role: true, isBanned: true } });
  if (!admin || admin.role !== "admin" || admin.isBanned) {
    await answer("Bu tugma faqat administrator uchun");
    return;
  }

  let result: string;
  try {
    result = m[2] === "p" ? await actOnPayment(admin, m[1] === "ok", m[3]) : await actOnInvoice(admin, m[1] === "ok", m[3]);
  } catch (e) {
    await answer(e instanceof ApiError ? e.message : "Xatolik — admin panelda ko'rib chiqing");
    return;
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
}

async function handleStart(chatId: string, code: string, firstName?: string, lang: BotLang = "uz"): Promise<void> {
  // Kodsiz /start — xush kelibsiz ekrani (ulangan bo'lsa menyu, bo'lmasa ulash tugmasi)
  if (!code) {
    const me = await accountOf(chatId);
    await sendWelcome(chatId, me && !me.isBanned ? me : null, firstName, lang);
    return;
  }
  const userId = verifyTelegramLinkCode(code);
  if (!userId) {
    await sendTelegram(chatId, "Kod noto'g'ri yoki eskirgan (15 daqiqa amal qiladi). Saytda Kabinet → Profil → «Telegramga ulash» orqali yangi havola oling.", {
      button: { text: "🔗 Hisobni ulash", url: `${siteUrl() ?? ""}/kabinet/profil?tab=telegram#telegram` },
    });
    return;
  }
  // Bitta chat — bitta hisob: shu chatId boshqa foydalanuvchida bo'lsa, avval undan uzamiz
  await db
    .update(users)
    .set({ telegramChatId: null })
    .where(and(eq(users.telegramChatId, chatId), ne(users.id, userId)));
  const [row] = await db.update(users).set({ telegramChatId: chatId }).where(eq(users.id, userId)).returning({ id: users.id });
  if (!row) {
    await sendTelegram(chatId, "Hisob topilmadi. Saytdan qayta urinib ko'ring: Kabinet → Profil → «Telegramga ulash».");
    return;
  }
  // Ulandi — xush kelibsiz ekrani doimiy menyu bilan; admin bo'lsa buyruqlar menyusiga /elon qo'shiladi
  const me = await accountOf(chatId);
  if (me?.role === "admin") await setAdminCommands(chatId).catch(() => false);
  await sendWelcome(chatId, me && !me.isBanned ? me : null, firstName, lang);
}

async function handleStop(chatId: string): Promise<void> {
  const res = await db.update(users).set({ telegramChatId: null }).where(eq(users.telegramChatId, chatId));
  await clearChatCommands(chatId).catch(() => undefined);
  if (res.rowsAffected > 0) {
    await sendTelegram(chatId, "Telegram bildirishnomalari uzildi. Qayta ulash: saytda Kabinet → Profil → «Telegramga ulash».", { removeKeyboard: true });
  } else {
    await sendTelegram(chatId, "Bu chat hech qaysi hisobga ulanmagan edi. Ulash: saytda Kabinet → Profil → «Telegramga ulash».");
  }
}

/**
 * Bot tomonidagi chegara (2026-10-25 auditi, 5 va 6-bandlar): chatId bo'yicha.
 * `true` — chegaradan o'tildi, davom etmaymiz. Telegram update'ini baribir 200 bilan
 * tasdiqlaymiz (aks holda Telegram qayta-qayta yuboraveradi).
 */
async function botLimited(chatId: string, name: "tgBot" | "tgStart"): Promise<boolean> {
  try {
    await rateLimit(`${name}:${chatId}`, RATE_LIMITS[name].limit, RATE_LIMITS[name].windowMs);
    return false;
  } catch {
    return true;
  }
}

export async function POST(req: Request) {
  if (!secretOk(req)) return Response.json({ ok: false }, { status: 401 });
  try {
    const update = (await req.json()) as TelegramUpdate;
    if (update?.callback_query) {
      const cbChat = update.callback_query.message?.chat?.id;
      const cbId = cbChat != null ? String(cbChat) : "";
      if (cbId && (await botLimited(cbId, "tgBot"))) return Response.json({ ok: true });
      await handleCallback(update.callback_query);
      return Response.json({ ok: true });
    }
    if (update?.pre_checkout_query) {
      await handlePreCheckout(update.pre_checkout_query);
      return Response.json({ ok: true });
    }
    if (update?.inline_query) {
      // Inline rejim: `@bot so'z` — chegara foydalanuvchi id bo'yicha
      const iqFrom = update.inline_query.from?.id != null ? String(update.inline_query.from.id) : "";
      if (!iqFrom || !(await botLimited(iqFrom, "tgBot"))) await handleInlineQuery(update.inline_query);
      return Response.json({ ok: true });
    }
    const msg = update?.message;
    const chatId = msg?.chat?.id != null ? String(msg.chat.id) : "";
    if (chatId && msg?.chat?.type === "private") {
      if (msg.successful_payment) {
        await handleSuccessfulPayment(chatId, msg.successful_payment);
        return Response.json({ ok: true });
      }
      // Rasm (eng katta nusxa) / rasm-hujjat / video — chek (ochiq karta xaridi bo'lsa) yoki lentaga post taklifi (lib/telegram-bot/media.ts)
      const photo = msg.photo?.length ? msg.photo[msg.photo.length - 1] : null;
      const imgDoc = msg.document?.mime_type?.startsWith("image/") ? msg.document : null;
      const vid = msg.video?.file_id ? msg.video : null;
      const vidDoc = !vid && msg.document?.mime_type?.startsWith("video/") ? msg.document : null;
      const media: IncomingMedia | null = photo?.file_id
        ? { fileId: photo.file_id, kind: "photo", mime: "image/jpeg", size: photo.file_size ?? 0, width: photo.width, height: photo.height }
        : imgDoc?.file_id
          ? { fileId: imgDoc.file_id, kind: "photo", mime: imgDoc.mime_type ?? "image/jpeg", size: imgDoc.file_size ?? 0 }
          : vid?.file_id
            ? { fileId: vid.file_id, kind: "video", mime: vid.mime_type ?? "video/mp4", size: vid.file_size ?? 0, duration: vid.duration, width: vid.width, height: vid.height }
            : vidDoc?.file_id
              ? { fileId: vidDoc.file_id, kind: "video", mime: vidDoc.mime_type ?? "video/mp4", size: vidDoc.file_size ?? 0 }
              : null;
      if (media) {
        await handleIncomingMedia(chatId, media, typeof msg.caption === "string" ? msg.caption : "", botLang(msg.from?.language_code));
        return Response.json({ ok: true });
      }
      // Ro'yxatdan o'tishda «Raqamni ulashish» — faqat o'z raqami (user_id = from.id)
      if (msg.contact) {
        await handleRegisterContact(chatId, msg.contact, msg.from?.id != null ? String(msg.from.id) : "");
        return Response.json({ ok: true });
      }
    }
    const text = typeof msg?.text === "string" ? msg.text.trim() : "";
    // Faqat shaxsiy chat: guruhga qo'shilgan botdagi buyruqlar e'tiborga olinmaydi
    if (!chatId || !text || msg?.chat?.type !== "private") return Response.json({ ok: true });

    // Doimiy menyu tugmasi (📦 Buyurtmalarim …) — buyruqqa aylantiriladi
    const normalized = MENU_COMMAND[text] ?? text;
    const [rawCmd = "", arg = ""] = normalized.split(/\s+/);
    const cmd = rawCmd.split("@")[0].toLowerCase(); // "/start@BotNomi" ham qabul qilinadi
    const firstName = typeof msg?.from?.first_name === "string" ? msg.from.first_name : undefined;
    const mf = msg?.from ?? {};
    const lang = botLang(mf.language_code);
    const who = { name: [mf.first_name, mf.last_name].filter(Boolean).join(" ") || undefined, username: typeof mf.username === "string" ? mf.username : undefined, lang };
    // Savol-javob oqimi (ro'yxatdan o'tish / elon): oddiy matn oqimga ketadi; har qanday buyruq oqimni to'xtatadi
    if (!cmd.startsWith("/")) {
      if (await handleRegisterText(chatId, text)) return Response.json({ ok: true });
      if (await handleBroadcastText(chatId, text)) return Response.json({ ok: true });
      if (await handlePostText(chatId, text, lang)) return Response.json({ ok: true });
      if (await handleAdminPriceText(chatId, text)) return Response.json({ ok: true });
    } else {
      await clearBotSession(chatId).catch(() => undefined);
    }
    if (cmd === "/royxat" || cmd === "/register" || (cmd === "/start" && arg === "reg")) {
      await startRegistration(chatId, who);
      return Response.json({ ok: true });
    }
    if (cmd === "/start") {
      // `l_<kod>` — kirish kodini TERIB topishga qarshi alohida (qattiqroq) chegara
      if (arg.startsWith("l_") && (await botLimited(chatId, "tgStart"))) {
        await sendTelegram(chatId, "Juda ko'p urinish. Bir soatdan keyin qayta urinib ko'ring.");
        return Response.json({ ok: true });
      }
      // l_<kod> — «Telegram bilan kirish»; b_<tur>_<id> — mentorlik xaridi
      if (await handleLoginStart(chatId, arg, who)) {
        /* kirish so'rovi */
      } else if (!(arg.startsWith("b_") && ((await handleBuyStart(chatId, arg, lang)) || (await handleContactBuyStart(chatId, arg, lang))))) await handleStart(chatId, arg, firstName, lang);
    } else if (cmd === "/kurslarim" || cmd === "/xaridlar") await handleMyPurchases(chatId, lang);
    else if (cmd === "/buyurtmalarim" || cmd === "/buyurtmalar") await handleMyOrders(chatId, lang);
    else if (cmd === "/xabarlar") await handleMessages(chatId, lang);
    else if (cmd === "/ilova" || cmd === "/app") await sendApp(chatId);
    else if (cmd === "/qidiruv" || cmd === "/qidir") await handleSearch(chatId, normalized.slice(rawCmd.length), lang);
    else if (cmd === "/kurslar") await handleCourses(chatId, lang);
    else if (cmd === "/efirlar" || cmd === "/efir") await handleLives(chatId, lang);
    else if (cmd === "/top") await handleTop(chatId, lang);
    else if (cmd === "/vakansiyalar") await handleVacancies(chatId, lang);
    else if (cmd === "/profil") await handleProfile(chatId, lang);
    else if (cmd === "/sozlamalar") await handleSettings(chatId, lang);
    else if (cmd === "/menyu") await handleStart(chatId, "", firstName, lang);
    else if (cmd === "/elon") await handleBroadcastStart(chatId, text);
    else if (cmd === "/post") await sendPostHelp(chatId, lang);
    else if (cmd === "/kontaktlarim" || cmd === "/kontaktlar") await handleMyContacts(chatId, lang);
    else if (cmd === "/admin" || cmd === "/stat" || cmd === "/navbat" || cmd === "/tolovlar" || cmd === "/user" || cmd === "/narx" || cmd === "/shikoyatlar" || cmd === "/mentorlar" || cmd === "/nizolar" || cmd === "/payoutlar") {
      // Admin boti (lib/telegram-bot/admin.ts) — faqat admin hisobiga ulangan chat
      if (!(await adminByChat(chatId))) await sendTelegram(chatId, "Bu buyruq faqat administrator uchun.");
      else if (cmd === "/admin") await sendAdminMenu(chatId);
      else if (cmd === "/stat") await sendAdminStats(chatId, arg === "7" || arg === "7d" ? "7d" : arg === "30" || arg === "30d" ? "30d" : "today");
      else if (cmd === "/navbat") await sendAdminQueues(chatId);
      else if (cmd === "/tolovlar") await sendAdminPayments(chatId);
      else if (cmd === "/shikoyatlar") await sendAdminReports(chatId);
      else if (cmd === "/mentorlar") await sendAdminMentorApps(chatId);
      else if (cmd === "/nizolar") await sendAdminDisputes(chatId);
      else if (cmd === "/payoutlar") await sendAdminPayouts(chatId);
      else if (cmd === "/narx") await handleAdminPrices(chatId, normalized.slice(rawCmd.length));
      else await handleAdminUserSearch(chatId, normalized.slice(rawCmd.length));
    }
    else if (cmd === "/stop") await handleStop(chatId);
    else if (cmd === "/yordam" || cmd === "/help" || cmd.startsWith("/")) {
      const me = await accountOf(chatId);
      await sendHelp(chatId, Boolean(me), me?.role === "admin", lang);
    }
    else await handleSearch(chatId, text, lang); // oddiy matn — ijodkor qidiruvi
  } catch (e) {
    // Har doim 200 — Telegram xatoli javobni qayta-qayta yuborib turadi
    console.error("[telegram:webhook]", e);
  }
  return Response.json({ ok: true });
}

export function GET() {
  return Response.json({ ok: false, error: "Faqat POST" }, { status: 405 });
}

import "server-only";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, specialists, users } from "@/lib/db/schema";
import { cutPlain, escapeTelegramHtml, replyMarkup, sendTelegram, telegramApi, type TelegramButton } from "@/lib/telegram";
import { decideLoginRequest, findLoginRequest } from "@/lib/auth/telegram-login";
import { siteUrl } from "@/lib/security/site";
import { formatPrice } from "@/lib/utils";
import { regionLabel } from "@/lib/telegram-bot/labels-ru";
import { NOTIFY_GROUP_KEYS, type NotifyGroupKey } from "@/lib/notifications";
import { SETTINGS_TEXT, SETTINGS_TEXT_RU, appUrl, pageButton, sendNotLinked, settingsKeyboard } from "@/lib/telegram-bot/ui";
import { L, type BotLang } from "@/lib/telegram-bot/lang";

/**
 * Botdagi tezkor amallar (Telegram tarafi):
 *  - «Telegram bilan kirish» tasdiqlash: `/start l_<kod>` → `lg:ok|no:<kod>`
 *  - Buyurtmani bir bosishda qabul qilish / rad etish: `ord:ok|no:<id>`
 *  - `/buyurtmalarim` — ochiq buyurtmalar ro'yxati (tugmalar bilan)
 *
 * QOIDA: har bir amal chatga ulangan hisob huquqi bilan tekshiriladi — tugma havolasi
 * boshqa odamga tushsa ham ish bajarilmaydi.
 */

type Answer = (text: string) => Promise<unknown>;

/** Chatga ulangan hisob (yo'q bo'lsa null). `lang` — foydalanuvchi tanlagan til (`/til`, sayt); null — Telegram tiliga qaraladi */
export async function accountOf(chatId: string) {
  return db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, name: true, role: true, isBanned: true, email: true, username: true, createdAt: true, notifyPrefs: true, lang: true } });
}

/** Bloklangan hisobga botdagi yagona javob (o'qish buyruqlari ham yopiq — kontaktlar, buyurtmalar, profil) */
export const BANNED_TEXT = (lang?: BotLang): string =>
  L(lang, "Hisobingiz bloklangan — botdagi amallar yopiq. Xato deb hisoblasangiz, /yordam orqali qo'llab-quvvatlashga yozing.", "Ваш аккаунт заблокирован — действия в боте недоступны. Если это ошибка, напишите в поддержку через /yordam.");

/**
 * Shaxsiy ma'lumot ko'rsatadigan buyruqlar uchun FAOL hisob: ulanmagan chatga «akkauntingiz bormi?», bloklangan hisobga blok
 * matni yuboriladi va null qaytadi. Bloklangan foydalanuvchi bot orqali ochilgan kontaktlar, buyurtmalar, profil va kurslarni
 * o'qiy olmasligi kerak (yozish amallari avvaldan yopiq edi — o'qish ochiq qolgan edi).
 */
export async function activeAccount(chatId: string, lang?: BotLang) {
  const me = await accountOf(chatId);
  if (!me) {
    await sendNotLinked(chatId, lang);
    return null;
  }
  if (me.isBanned) {
    await sendTelegram(chatId, BANNED_TEXT(lang));
    return null;
  }
  return me;
}

const ROLE_LABEL: Record<string, string> = { client: "Mijoz", specialist: "Mutaxassis", admin: "Administrator" };
const ROLE_LABEL_RU: Record<string, string> = { client: "Клиент", specialist: "Специалист", admin: "Администратор" };

/* ------------------------------------------------------------------ */
/* «Telegram bilan kirish»                                             */
/* ------------------------------------------------------------------ */

const LOGIN_EXPIRED = (lang?: BotLang): string =>
  L(lang, "Kirish so'rovi topilmadi yoki eskirgan. Saytda «Telegram bilan kirish»ni qayta bosing.", "Запрос на вход не найден или истёк. Нажмите «Войти через Telegram» на сайте ещё раз.");

/**
 * Kirish so'rovi tasdig'i: qaysi qurilmadan va qachon so'ralgani + fishing ogohlantirishi + «Ha, bu men / Yo'q».
 * QOIDA (2026-11-10): saytga kirish HAR DOIM shu savol orqali tasdiqlanadi — hisob endigina ochilgan yoki qayta ulangan
 * bo'lsa ham avtomatik tasdiq YO'Q (ilgari begona odam yuborgan `l_<kod>` havolasi bir bosishda kirishni tasdiqlab qo'yardi).
 * So'rov eskirgan bo'lsa — shu aytiladi va false qaytadi.
 */
export async function sendLoginPrompt(chatId: string, code: string, accountName: string, lang?: BotLang): Promise<boolean> {
  const req = await findLoginRequest(code);
  if (!req) {
    await sendTelegram(chatId, LOGIN_EXPIRED(lang));
    return false;
  }
  const when = new Date(req.createdAt).toLocaleTimeString(lang === "ru" ? "ru-RU" : "uz-UZ", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" });
  const device = req.deviceLabel ? escapeTelegramHtml(req.deviceLabel) : L(lang, "noma'lum qurilma", "неизвестное устройство");
  const text = L(
    lang,
    `<b>Saytga kirish so'rovi</b>\nKod: <code>${code}</code>\nHisob: <b>${escapeTelegramHtml(accountName)}</b>\nQurilma: ${device} · ${when}\n\n⚠️ Faqat <b>o'zingiz hozir saytda</b> «Telegram bilan kirish»ni bosgan bo'lsangiz tasdiqlang. Kodni kimdir sizga yuborgan bo'lsa — bu firibgarlik: «Yo'q» ni bosing.`,
    `<b>Запрос на вход на сайт</b>\nКод: <code>${code}</code>\nАккаунт: <b>${escapeTelegramHtml(accountName)}</b>\nУстройство: ${device} · ${when}\n\n⚠️ Подтверждайте, только если <b>вы сами сейчас</b> нажали «Войти через Telegram» на сайте. Если код вам кто-то прислал — это мошенничество: нажмите «Нет».`,
  );
  await sendTelegram(chatId, text, {
    keyboard: [
      [
        { text: L(lang, "✅ Ha, bu men", "✅ Да, это я"), data: `lg:ok:${code}` },
        { text: L(lang, "✖️ Yo'q", "✖️ Нет"), data: `lg:no:${code}` },
      ],
    ],
  });
  return true;
}

/** `/start l_<kod>` — tasdiqlash tugmalarini ko'rsatadi (hisobsiz chat — avval ro'yxatdan o'tadi, keyin shu savol) */
export async function handleLoginStart(chatId: string, arg: string, who: { name?: string; username?: string; lang?: BotLang }): Promise<boolean> {
  const m = /^l_(\d{6})$/.exec(arg);
  if (!m) return false;
  const lang = who.lang;
  if (!(await findLoginRequest(m[1]))) {
    await sendTelegram(chatId, LOGIN_EXPIRED(lang));
    return true;
  }
  const linked = await accountOf(chatId);
  if (linked?.isBanned) {
    await sendTelegram(chatId, BANNED_TEXT(lang));
    return true;
  }
  if (!linked) {
    // Hisobsiz Telegram — avtomatik hisob OCHILMAYDI: savol-javob bilan ro'yxatdan o'tadi, so'ng kirishni tasdiqlaydi
    const { startRegistration } = await import("@/lib/telegram-bot/register");
    await startRegistration(chatId, who, { loginCode: m[1] });
    return true;
  }
  await sendLoginPrompt(chatId, m[1], linked.name, lang);
  return true;
}

/** `lg:ok|no:<kod>` tugmasi. «Tasdiqlandi» faqat so'rov HAQIQATDA tasdiqlangan bo'lsa aytiladi (eskirgan — shu aytiladi) */
export async function handleLoginCallback(chatId: string, data: string, answer: Answer, who: { name?: string; username?: string; lang?: BotLang }): Promise<boolean> {
  const m = /^lg:(ok|no):(\d{6})$/.exec(data);
  if (!m) return false;
  const lang = who.lang;
  const me = await accountOf(chatId);
  if (me?.isBanned) {
    await answer(BANNED_TEXT(lang));
    return true;
  }
  if (m[1] === "ok" && !me) {
    await answer("");
    const { startRegistration } = await import("@/lib/telegram-bot/register");
    await startRegistration(chatId, who, { loginCode: m[2] });
    return true;
  }
  const okNow = await decideLoginRequest(m[2], chatId, m[1] === "ok", who);
  if (!okNow) {
    await answer(L(lang, "So'rov eskirgan — saytda qayta bosing", "Запрос истёк — нажмите на сайте ещё раз"));
    return true;
  }
  await answer(m[1] === "ok" ? L(lang, "Tasdiqlandi — saytga qaytasiz", "Подтверждено — вернитесь на сайт") : L(lang, "Rad etildi", "Отклонено"));
  await sendTelegram(
    chatId,
    m[1] === "ok"
      ? L(lang, "✅ Kirish tasdiqlandi. Saytdagi oynaga qaytib qarang.", "✅ Вход подтверждён. Вернитесь в окно сайта.")
      : L(lang, "Kirish rad etildi. Agar so'rovni siz yubormagan bo'lsangiz, hech narsa qilish shart emas.", "Вход отклонён. Если запрос отправляли не вы, ничего делать не нужно."),
  );
  return true;
}

/* ------------------------------------------------------------------ */
/* Buyurtma: qabul qilish / rad etish                                  */
/* ------------------------------------------------------------------ */

/** Buyurtma tugmalari: xabar ostida «Qabul qilish» va «Rad etish» (+ ochish; sayt manzili noma'lum bo'lsa — faqat amallar) */
export function orderButtons(orderId: string, href: string | null, lang?: BotLang): TelegramButton[][] {
  const open = L(lang, "Buyurtmani ochish", "Открыть заказ");
  const app = appUrl(`/buyurtma/${orderId}`);
  const openBtn: TelegramButton | null = app ? { text: open, webApp: app } : href ? { text: open, url: href } : null;
  return [
    [
      { text: L(lang, "✅ Qabul qilish", "✅ Принять"), data: `ord:ok:${orderId}` },
      { text: L(lang, "✖️ Rad etish", "✖️ Отклонить"), data: `ord:no:${orderId}` },
    ],
    ...(openBtn ? [[openBtn]] : []),
  ];
}

/** `ord:ok|no:<id>` — mutaxassis buyurtmani botda hal qiladi; bosilgan xabardagi tugmalar olib tashlanadi */
export async function handleOrderCallback(chatId: string, data: string, answer: Answer, lang?: BotLang, msgId: number | null = null): Promise<boolean> {
  const m = /^ord:(ok|no):([\w-]{1,64})$/.exec(data);
  if (!m) return false;
  const me = await accountOf(chatId);
  if (!me || me.isBanned) {
    await answer(me?.isBanned ? BANNED_TEXT(lang) : L(lang, "Avval hisobni ulang: saytda Kabinet → Profil", "Сначала привяжите аккаунт: на сайте Кабинет → Профиль"));
    return true;
  }
  try {
    const { setOrderStatus } = await import("@/lib/telegram-bot/orders");
    const res = await setOrderStatus(m[2], me.id, m[1] === "ok", lang);
    await answer(res);
    // Hal qilingan buyurtma xabarida faqat «ochish» qoladi (amal tugmalari qayta bosilmasin)
    if (msgId) await telegramApi("editMessageReplyMarkup", { chat_id: chatId, message_id: msgId, reply_markup: replyMarkup({ keyboard: [[pageButton(L(lang, "Buyurtmani ochish", "Открыть заказ"), `/buyurtma/${m[2]}`)]] }) });
    await sendTelegram(chatId, escapeTelegramHtml(res), { keyboard: [[pageButton(L(lang, "Buyurtmani ochish", "Открыть заказ"), `/buyurtma/${m[2]}`)]] });
  } catch (e) {
    const { errorText } = await import("@/lib/telegram-bot/i18n");
    await answer(await errorText(e, lang, "Xatolik — saytdan bajaring", "Ошибка — выполните на сайте"));
  }
  return true;
}

/** `/buyurtmalarim` — ochiq buyurtmalar (mutaxassis uchun yangi buyurtmalar tugmalar bilan) */
export async function handleMyOrders(chatId: string, lang?: BotLang): Promise<void> {
  const me = await activeAccount(chatId, lang);
  if (!me) return;
  // Buyurtmada `specialistId` — specialists qatori; mutaxassis userId'si join bilan olinadi
  const rows = await db
    .select({ id: orders.id, title: orders.title, status: orders.status, amount: orders.amount, spUserId: specialists.userId })
    .from(orders)
    .innerJoin(specialists, eq(specialists.id, orders.specialistId))
    .where(and(or(eq(specialists.userId, me.id), eq(orders.clientId, me.id)), inArray(orders.status, ["new", "accepted", "in_progress"])))
    .orderBy(desc(orders.createdAt))
    .limit(8);
  if (!rows.length) {
    await sendTelegram(chatId, L(lang, "Ochiq buyurtma yo'q.", "Открытых заказов нет."), { keyboard: [[pageButton(L(lang, "Buyurtmalarim", "Мои заказы"), "/kabinet/buyurtmalar")]] });
    return;
  }
  const { STATUS_LABEL } = await import("@/lib/telegram-bot/orders");
  const { orderStatusLabel } = await import("@/lib/i18n/dict/kabinet-pages");
  for (const o of rows) {
    const mine = o.spUserId === me.id;
    const text = `<b>${escapeTelegramHtml(o.title)}</b>\n${escapeTelegramHtml(orderStatusLabel(lang ?? "uz", o.status, STATUS_LABEL[o.status] ?? o.status))}${o.amount ? ` · ${escapeTelegramHtml(formatPrice(o.amount))}` : ""}`;
    // Shaxsiy sahifa — Mini App tugmasi (botda ro'yxatdan o'tganlar kirish sahifasiga tushib qolmasin)
    await sendTelegram(chatId, text, { keyboard: mine && o.status === "new" ? orderButtons(o.id, `${siteUrl() ?? ""}/buyurtma/${o.id}`, lang) : [[pageButton(L(lang, "Ochish", "Открыть"), `/buyurtma/${o.id}`)]] });
  }
}

/* ------------------------------------------------------------------ */
/* Profil, xabarlar, vakansiyalar, sozlamalar                           */
/* ------------------------------------------------------------------ */

/** `/profil` — hisob kartasi: ko'rsatkichlar, profil tayyorligi (%) va keyingi qadam (lib/profile/completion.ts — sayt bilan bitta hisob) */
export async function handleProfile(chatId: string, lang?: BotLang): Promise<void> {
  const me = await activeAccount(chatId, lang);
  if (!me) return;
  const ru = lang === "ru";
  const since = new Date(me.createdAt).toLocaleDateString(ru ? "ru-RU" : "uz-UZ", { day: "numeric", month: "long", year: "numeric" });
  const { follows, posts, contactUnlocks } = await import("@/lib/db/schema");
  const { count, isNull } = await import("drizzle-orm");
  const sp = me.role !== "client" ? await db.query.specialists.findFirst({ where: eq(specialists.userId, me.id), columns: { id: true, slug: true, title: true, isVerified: true, viewCount: true, rating: true, reviewCount: true, contactMode: true, subscriptionUntil: true } }) : null;
  const [followers, postsN, soldN, boughtN, ordersN] = await Promise.all([
    db.select({ n: count() }).from(follows).where(eq(follows.followingId, me.id)).then((r) => Number(r[0]?.n ?? 0)).catch(() => 0),
    db.select({ n: count() }).from(posts).where(and(eq(posts.authorId, me.id), isNull(posts.groupId))).then((r) => Number(r[0]?.n ?? 0)).catch(() => 0),
    sp ? db.select({ n: count() }).from(contactUnlocks).where(and(eq(contactUnlocks.specialistId, sp.id), eq(contactUnlocks.status, "paid"))).then((r) => Number(r[0]?.n ?? 0)).catch(() => 0) : Promise.resolve(0),
    db.select({ n: count() }).from(contactUnlocks).where(and(eq(contactUnlocks.clientId, me.id), eq(contactUnlocks.status, "paid"))).then((r) => Number(r[0]?.n ?? 0)).catch(() => 0),
    sp
      ? db.select({ n: count() }).from(orders).where(and(eq(orders.specialistId, sp.id), inArray(orders.status, ["new", "accepted", "in_progress"]))).then((r) => Number(r[0]?.n ?? 0)).catch(() => 0)
      : db.select({ n: count() }).from(orders).where(and(eq(orders.clientId, me.id), inArray(orders.status, ["new", "accepted", "in_progress"]))).then((r) => Number(r[0]?.n ?? 0)).catch(() => 0),
  ]);
  const roleLabel = (ru ? ROLE_LABEL_RU[me.role] : ROLE_LABEL[me.role]) ?? me.role;
  const lines = [
    `<b>${escapeTelegramHtml(me.name)}</b> — ${escapeTelegramHtml(roleLabel)}${me.username ? ` · @${escapeTelegramHtml(me.username)}` : ""}`,
    // Botda ochilgan hisobning emaili ichki o'rinbosar (`tg<chat>@telegram.local`) — foydalanuvchiga ko'rsatilmaydi
    `${/@telegram\.local$/i.test(me.email) ? L(lang, "email kiritilmagan", "email не указан") : escapeTelegramHtml(me.email)} · ${L(lang, "ro'yxatdan", "с")} ${escapeTelegramHtml(since)}`,
    "",
  ];
  const followersL = L(lang, "obunachi", "подписчиков");
  const postsL = L(lang, "post", "постов");
  const ordersL = L(lang, "faol buyurtma", "активных заказов");
  if (sp) {
    lines.push(`🎨 ${escapeTelegramHtml(sp.title)} · ${sp.isVerified ? L(lang, "tasdiqlangan ✅", "подтверждён ✅") : L(lang, "tasdiq kutmoqda ⏳", "ожидает подтверждения ⏳")}`);
    lines.push(`👁 ${sp.viewCount} ${L(lang, "ko'rish", "просмотров")} · ⭐ ${sp.reviewCount ? `${sp.rating.toFixed(1)} (${sp.reviewCount})` : L(lang, "sharh yo'q", "отзывов нет")} · 👥 ${followers} ${followersL} · 📝 ${postsN} ${postsL}`);
    lines.push(`📦 ${ordersN} ${ordersL} · 🔓 ${L(lang, `kontaktingizni ${soldN} kishi oldi`, `контакт купили: ${soldN}`)} · ${L(lang, "rejim", "режим")}: ${sp.contactMode === "hidden" ? L(lang, "faqat portfolio", "только портфолио") : L(lang, "sotiladi", "продаётся")}`);
    if (sp.subscriptionUntil) {
      const until = new Date(sp.subscriptionUntil).toLocaleDateString(ru ? "ru-RU" : "uz-UZ", { day: "numeric", month: "long" });
      lines.push(`💠 ${L(lang, `Obuna: ${until} gacha`, `Подписка: до ${until}`)}`);
    }
  } else {
    lines.push(`👥 ${followers} ${followersL} · 📝 ${postsN} ${postsL} · 📦 ${ordersN} ${ordersL} · 🔓 ${boughtN} ${L(lang, "ochilgan kontakt", "открытых контактов")}`);
  }
  // Profil tayyorligi — sayt bilan BITTA manba (lib/profile/completion.ts): foiz, chiziq va eng muhim keyingi qadam (tugmasi bilan)
  let nextStep: TelegramButton | null = null;
  try {
    const { profileCompletion } = await import("@/lib/profile/completion");
    const full = await db.query.users.findFirst({ where: eq(users.id, me.id), columns: { id: true, role: true, name: true, avatarUrl: true, phone: true, emailVerified: true, totpEnabled: true, telegramChatId: true }, with: { specialist: true } });
    if (full) {
      const c = await profileCompletion(full);
      const filled = Math.max(0, Math.min(10, Math.round(c.pct / 10)));
      lines.push("", `📈 ${L(lang, "Profil tayyorligi", "Заполненность профиля")}: <b>${c.pct}%</b> ${"▰".repeat(filled)}${"▱".repeat(10 - filled)}`);
      if (c.next) {
        const label = ru ? c.next.label.ru : c.next.label.uz;
        lines.push(`➡️ ${L(lang, "Keyingi qadam", "Следующий шаг")}: <b>${escapeTelegramHtml(label)}</b>${c.left > 1 ? L(lang, ` · yana ${c.left - 1} ta qadam bor`, ` · осталось шагов: ${c.left - 1}`) : ""}`);
        nextStep = pageButton(`➡️ ${cutPlain(label, 40)}`, c.next.href);
      } else lines.push(L(lang, "Barcha qadamlar bajarilgan ✅", "Все шаги выполнены ✅"));
    }
  } catch (e) {
    console.error("[telegram:profil] tayyorlik", e instanceof Error ? e.message : e);
  }
  lines.push("", L(lang, "Telegram ulangan ✅ — buyurtma, xabar va kurs bildirishnomalari shu yerga keladi.", "Telegram привязан ✅ — уведомления о заказах, сообщениях и курсах приходят сюда."));
  const s = siteUrl() ?? "";
  const kb = (path: string, text: string) => (appUrl(path) ? { text, webApp: appUrl(path)! } : { text, url: `${s}${path}` });
  await sendTelegram(chatId, lines.join("\n"), {
    keyboard: [
      ...(nextStep ? [[nextStep]] : []),
      [kb("/kabinet", L(lang, "Kabinet", "Кабинет")), kb("/kabinet/profil", L(lang, "Profilni tahrirlash", "Редактировать профиль"))],
      [
        kb("/kabinet/kontaktlar", sp ? L(lang, "Kontaktimni olganlar", "Кто купил контакт") : L(lang, "Ochilgan kontaktlar", "Открытые контакты")),
        ...(sp ? [{ text: L(lang, "Ommaviy sahifam", "Моя страница"), url: `${s}/mutaxassislar/${sp.slug}` }] : [kb("/mutaxassislar", L(lang, "Mutaxassislar", "Специалисты"))]),
      ],
    ],
  });
}

// `/xabarlar` (suhbatlar ro'yxati, o'qish va javob yozish) — lib/telegram-bot/dm.ts

/** `/vakansiyalar` — so'nggi 5 ta ochiq vakansiya (hamma uchun, ulash shart emas) */
export async function handleVacancies(chatId: string, lang?: BotLang): Promise<void> {
  const { listVacancies } = await import("@/lib/vacancies/service");
  const { professionLabelTr, salaryLabelTr } = await import("@/lib/i18n/dict/vacancies");
  const { vacancyFilterSchema } = await import("@/lib/vacancies/validators");
  const { items, total } = await listVacancies(vacancyFilterSchema.parse({ limit: 5 }));
  const s = siteUrl() ?? "";
  const til = lang ?? "uz";
  if (!items.length) {
    await sendTelegram(chatId, L(lang, "Hozircha ochiq vakansiya yo'q.", "Открытых вакансий пока нет."), { button: { text: L(lang, "Vakansiyalar", "Вакансии"), url: `${s}/vakansiyalar` } });
    return;
  }
  const lines = items.map((v, i) => {
    const where = v.regionSlug ? regionLabel(v.regionSlug, lang) : L(lang, "Masofaviy", "Удалённо");
    return `${i + 1}. <a href="${s}/vakansiyalar/${v.id}"><b>${escapeTelegramHtml(v.title)}</b></a>\n   ${escapeTelegramHtml(v.company)} · ${escapeTelegramHtml(professionLabelTr(til, v.profession, true))} · ${escapeTelegramHtml(where)}\n   ${escapeTelegramHtml(salaryLabelTr(til, v.salaryMin, v.salaryMax))}`;
  });
  await sendTelegram(chatId, `💼 <b>${L(lang, "So'nggi vakansiyalar", "Последние вакансии")}</b> (${L(lang, `${total} ta ochiq`, `открытых: ${total}`)})\n\n${lines.join("\n\n")}`, { button: { text: L(lang, "Barcha vakansiyalar", "Все вакансии"), url: `${s}/vakansiyalar` } });
}

/** `/sozlamalar` — bildirishnoma guruhlari switch'lari */
export async function handleSettings(chatId: string, lang?: BotLang): Promise<void> {
  const me = await activeAccount(chatId, lang);
  if (!me) return;
  await sendTelegram(chatId, L(lang, SETTINGS_TEXT, SETTINGS_TEXT_RU), { keyboard: settingsKeyboard(me.notifyPrefs ?? {}, lang) });
}

/** `st:<guruh>` — switch'ni almashtirib, klaviaturani joyida yangilaydi */
export async function handleSettingsCallback(chatId: string, data: string, answer: Answer, messageId: number | null, lang?: BotLang): Promise<boolean> {
  const m = /^st:([a-z]+)$/.exec(data);
  if (!m) return false;
  const key = m[1] as NotifyGroupKey;
  if (!NOTIFY_GROUP_KEYS.includes(key)) return false;
  const me = await accountOf(chatId);
  if (!me || me.isBanned) {
    await answer(me?.isBanned ? BANNED_TEXT(lang) : L(lang, "Avval hisobni ulang", "Сначала привяжите аккаунт"));
    return true;
  }
  const next = { ...(me.notifyPrefs ?? {}) };
  next[key] = next[key] === false; // o'chirilgan → yoqiladi, aks holda o'chadi
  await db.update(users).set({ notifyPrefs: next }).where(eq(users.id, me.id));
  await answer(next[key] ? L(lang, "Yoqildi", "Включено") : L(lang, "O'chirildi", "Выключено"));
  if (messageId) {
    const { replyMarkup } = await import("@/lib/telegram");
    await telegramApi("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: replyMarkup({ keyboard: settingsKeyboard(next, lang) }) });
  }
  return true;
}

/** `menu:*` — xush kelibsiz ekranidagi inline tugmalar */
export async function handleMenuCallback(chatId: string, data: string, answer: Answer, lang?: "uz" | "ru"): Promise<boolean> {
  if (data === "menu:help") {
    await answer("");
    const { sendHelp } = await import("@/lib/telegram-bot/ui");
    const me = await accountOf(chatId);
    await sendHelp(chatId, Boolean(me), me?.role === "admin", lang);
    return true;
  }
  if (data === "menu:mycourses") {
    await answer("");
    const { handleMyPurchases } = await import("@/lib/mentorship/telegram-pay");
    await handleMyPurchases(chatId, lang);
    return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Qidiruv, kurslar, efirlar, TOP — ulash shart emas                   */
/* ------------------------------------------------------------------ */

const stars = (r: number, lang?: BotLang) => (r > 0 ? `⭐ ${r.toFixed(1)}` : L(lang, "yangi", "новый"));

/** Matn yoki `/qidiruv <so'z>` — ijodkorlar (5 tagacha) */
export interface BotPerson {
  slug: string;
  name: string;
  title: string;
  category: string;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  avatarUrl?: string | null;
  /** Mutaxassis qatori id'si — «Kontaktni ochish» tugmasi uchun */
  specialistId?: string;
  /** Kontakt sotuvi: narx (so'm) yoki null — «faqat portfolio» */
  contactPrice?: number | null;
}

/** Ruscha so'rov so'zlari → kasb slug'i (bot/inline qidiruvi; DB'dagi 8 asosiy slug) */
const RU_CATEGORY_ALIASES: [RegExp, string][] = [
  [/видеограф|видеосъ[её]м|видеооператор|оператор/, "videograf"],
  [/монтаж/, "montajor"],
  [/моушн|motion|анимац/, "motion-dizayner"],
  [/фотограф|фотосъ[её]м|фотосесс/, "fotograf"],
  [/\b3d\b|3д|тр[её]хмер/, "3d-artist"],
  [/\bui\b|\bux\b|интерфейс|веб-?дизайн|сайт/, "ui-ux"],
  [/звук|озвуч|диктор|саунд|аудио/, "ovoz"],
  [/дизайн|логотип|бренд|графич|иллюстр/, "dizayner"],
];
/** Ruscha hudud nomlari → REGIONS slug'i */
const RU_REGION_ALIASES: [RegExp, string][] = [
  [/ташкент/, "toshkent-shahri"],
  [/самарканд/, "samarqand"],
  [/бухар/, "buxoro"],
  [/ферган/, "fargona"],
  [/андижан/, "andijon"],
  [/наманган/, "namangan"],
  [/хорезм|ургенч|хива/, "xorazm"],
  [/навои/, "navoiy"],
  [/кашкадар|карши/, "qashqadaryo"],
  [/сурхандар|термез/, "surxondaryo"],
  [/джизак/, "jizzax"],
  [/сырдар|гулистан/, "sirdaryo"],
  [/каракалпак|нукус/, "qoraqalpogiston"],
];

/**
 * Ism / sarlavha / ko'nikma bo'yicha ijodkorlar — registrning bir nechta varianti bilan (lib/telegram-bot/text-search.ts).
 * Sayt qidiruvi (`exploreSearch`) so'rovni kichik harfga o'tkazib `lower(ustun)` bilan solishtiradi, SQLite esa kirillchani
 * kichraytirmaydi — «Алишер» deb saqlangan ism topilmaydi. Ko'rinish shartlari `exploreSearch` bilan bir xil
 * (bloklanmagan, yashirilmagan, obunasi faol).
 */
async function peopleByVariants(q: string, limit: number): Promise<BotPerson[]> {
  const { listableCondition } = await import("@/lib/subscriptions/access");
  const { getSettings } = await import("@/lib/payments/settings");
  const { likeAny } = await import("@/lib/telegram-bot/text-search");
  const settings = await getSettings();
  const rows = await db
    .select({ slug: specialists.slug, name: users.name, title: specialists.title, avatarUrl: users.avatarUrl, category: specialists.category, rating: specialists.rating, reviewCount: specialists.reviewCount, isVerified: specialists.isVerified })
    .from(specialists)
    .innerJoin(users, eq(users.id, specialists.userId))
    .where(and(eq(users.isBanned, false), eq(specialists.isHidden, false), listableCondition(settings), or(likeAny(users.name, q), likeAny(specialists.title, q), likeAny(specialists.bio, q))))
    .orderBy(desc(specialists.rating), desc(specialists.reviewCount))
    .limit(limit);
  return rows.map((r) => ({ ...r, title: r.title ?? "", isVerified: Boolean(r.isVerified) }));
}

/** Ijodkor qidiruvi (bot va inline rejim umumiy): ism/sarlavha → bo'lmasa kasb+hudud bo'yicha katalog (o'zbekcha yoki ruscha so'zlar); bo'sh so'rov — eng yaxshilari */
export async function searchPeople(q: string, limit = 5): Promise<BotPerson[]> {
  const { exploreSearch } = await import("@/lib/search/service");
  const { CATEGORIES, REGIONS } = await import("@/lib/constants");
  const { listSpecialists } = await import("@/lib/queries");
  const { specialistFilterSchema } = await import("@/lib/validators");
  const { hasNonAsciiLetter } = await import("@/lib/telegram-bot/text-search");
  const fromCatalog = async (f: Record<string, unknown>) => {
    const r = await listSpecialists(specialistFilterSchema.parse({ ...f, limit }));
    return r.items.slice(0, limit).map((it) => ({ slug: it.slug, name: it.user.name, title: it.title ?? "", category: it.category, rating: it.rating, reviewCount: it.reviewCount, isVerified: Boolean(it.isVerified), avatarUrl: it.user.avatarUrl }));
  };
  if (q.length < 2) return withContactPrices(await fromCatalog({}));
  const res = await exploreSearch(q, "people");
  let people: BotPerson[] = res.people.slice(0, limit);
  // Kirillcha so'rov: registr variantlari bilan qo'shimcha qidiruv (sayt qidiruvi katta harfli kirill ismni topa olmaydi)
  if (people.length < limit && hasNonAsciiLetter(q)) {
    const seen = new Set(people.map((p) => p.slug));
    for (const p of await peopleByVariants(q, limit).catch(() => [] as BotPerson[])) {
      if (people.length >= limit) break;
      if (!seen.has(p.slug)) people.push(p);
    }
  }
  if (!people.length) {
    // Ism/sarlavha topilmadi — kasb va hudud nomi bo'yicha katalog («montajchi Samarqand»)
    const ql = q.toLowerCase();
    // Kasb: so'rovdagi so'z kasb nomi/ko'pligi/slug'ining boshi bilan mos kelsa («montaj» → Montajchi)
    const words = ql.split(/\s+/).filter((w) => w.length >= 4);
    const ruCat = RU_CATEGORY_ALIASES.find(([re]) => re.test(ql))?.[1];
    const ruReg = RU_REGION_ALIASES.find(([re]) => re.test(ql))?.[1];
    const cat =
      (ruCat && CATEGORIES.find((c) => c.slug === ruCat)) ||
      CATEGORIES.find((c) => {
        const names = [c.name, c.plural, c.slug].map((x) => x.toLowerCase());
        return words.some((w) => names.some((n) => n.startsWith(w.slice(0, 5)) || n.includes(w)));
      });
    const reg = (ruReg && REGIONS.find((r) => r.slug === ruReg)) || REGIONS.find((r) => ql.includes(r.short.toLowerCase().replace(/\s*(sh\.|vil\.)$/, "")) || ql.includes(r.slug));
    if (cat || reg) people = await fromCatalog({ category: cat?.slug, region: reg?.slug });
  }
  return withContactPrices(people);
}

/** Har ijodkorga mutaxassis id'si va kontakt narxi (daraja/maxsus) yoki null («faqat portfolio») — bot va inline natijalarida ko'rsatiladi */
async function withContactPrices(people: BotPerson[]): Promise<BotPerson[]> {
  if (!people.length) return people;
  const { contactPriceFor } = await import("@/lib/contacts/unlock");
  const { getSettings } = await import("@/lib/payments/settings");
  const [rows, settings] = await Promise.all([
    db.query.specialists.findMany({ where: inArray(specialists.slug, people.map((p) => p.slug)), columns: { id: true, slug: true, contactMode: true, experience: true, contactPrice: true } }),
    getSettings(),
  ]);
  const map = new Map(rows.map((r) => [r.slug, r]));
  return people.map((p) => {
    const r = map.get(p.slug);
    return { ...p, specialistId: r?.id, contactPrice: r ? (r.contactMode === "hidden" ? null : contactPriceFor(r, settings)) : undefined };
  });
}

/** `/kontaktlarim` — ochilgan kontaktlar to'g'ridan-to'g'ri chatda (telefon, Telegram, Instagram, email) */
export async function handleMyContacts(chatId: string, lang?: BotLang): Promise<void> {
  const me = await activeAccount(chatId, lang);
  if (!me) return;
  const { listUnlockedContacts } = await import("@/lib/contacts/unlock");
  const { formatUzPhone } = await import("@/lib/utils");
  const s = siteUrl() ?? "";
  const list = await listUnlockedContacts(me.id);
  if (!list.length) {
    const app = appUrl("/mutaxassislar");
    const t = L(lang, "Mutaxassislar", "Специалисты");
    await sendTelegram(chatId, L(lang, "🔓 Hali kontakt ochmagansiz. Ijodkor profilida «Kontaktni ochish» tugmasini bosing — to'lovdan so'ng kontakt shu yerda va kabinetda saqlanadi.", "🔓 Вы ещё не открывали контакты. В профиле специалиста нажмите «Открыть контакт» — после оплаты контакт сохранится здесь и в кабинете."), { keyboard: [[app ? { text: t, webApp: app } : { text: t, url: `${s}/mutaxassislar` }]] });
    return;
  }
  const h = (v: string) => v.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(t\.me|telegram\.me|instagram\.com)\//i, "").replace(/\/+$/, "");
  const blocks = list.slice(0, 10).map((u) => {
    const sp = u.specialist;
    const lines = [`<b>${escapeTelegramHtml(sp.name)}</b> — ${escapeTelegramHtml(sp.title)}`];
    if (sp.phone) lines.push(`📞 ${escapeTelegramHtml(formatUzPhone(sp.phone))}`);
    if (sp.telegram) lines.push(`✈️ @${escapeTelegramHtml(h(sp.telegram))}`);
    if (sp.instagram) lines.push(`📸 instagram.com/${escapeTelegramHtml(h(sp.instagram))}`);
    if (sp.email) lines.push(`✉️ ${escapeTelegramHtml(sp.email)}`);
    if (lines.length === 1) lines.push(L(lang, "— aloqa ma'lumotlari hali to'ldirilmagan, sayt chati orqali yozing", "— контакты ещё не заполнены, напишите через чат на сайте"));
    return lines.join("\n");
  });
  const app = appUrl("/kabinet/kontaktlar");
  const kabinetT = L(lang, "Kabinetda ko'rish", "Открыть в кабинете");
  await sendTelegram(chatId, `🔓 <b>${L(lang, "Ochilgan kontaktlarim", "Мои открытые контакты")}</b> (${list.length})\n\n${blocks.join("\n\n")}`, { keyboard: [[app ? { text: kabinetT, webApp: app } : { text: kabinetT, url: `${s}/kabinet/kontaktlar` }]] });
}

export async function handleSearch(chatId: string, qRaw: string, lang?: BotLang): Promise<void> {
  const q = qRaw.trim().slice(0, 80);
  const s = siteUrl() ?? "";
  if (q.length < 2) {
    await sendTelegram(
      chatId,
      L(
        lang,
        "Kimni qidiramiz? Masalan: <i>montajchi</i>, <i>videograf Samarqand</i>, <i>logo dizayner</i>.\n\nIstalgan chatda ham: <code>@bot so'z</code> yozsangiz ijodkor kartasini ulashasiz.",
        "Кого ищем? Например: <i>montajchi</i>, <i>videograf Samarqand</i>, <i>logo dizayner</i>.\n\nВ любом чате: напишите <code>@bot слово</code> — и поделитесь карточкой специалиста.",
      ),
    );
    return;
  }
  const { categoryLabel } = await import("@/lib/telegram-bot/labels-ru");
  const people = await searchPeople(q, 5);
  if (!people.length) {
    await sendTelegram(chatId, L(lang, `🔎 «${escapeTelegramHtml(q)}» bo'yicha ijodkor topilmadi.`, `🔎 По запросу «${escapeTelegramHtml(q)}» никого не нашлось.`), { button: { text: L(lang, "Katalogda qidirish", "Искать в каталоге"), url: `${s}/qidiruv?q=${encodeURIComponent(q)}` } });
    return;
  }
  const lines = people.map((p, i) => {
    const cat = categoryLabel(p.category, lang);
    const contact = p.contactPrice === undefined ? "" : p.contactPrice === null ? L(lang, " · 🔒 faqat portfolio", " · 🔒 только портфолио") : ` · 🔓 ${L(lang, "kontakt", "контакт")} ${formatPrice(p.contactPrice, { compact: true })}`;
    return `${i + 1}. <a href="${s}/mutaxassislar/${p.slug}"><b>${escapeTelegramHtml(p.name)}</b></a>${p.isVerified ? " ✅" : ""}\n   ${escapeTelegramHtml(p.title || cat)} · ${stars(p.rating, lang)}${p.reviewCount ? ` (${p.reviewCount})` : ""}${contact}`;
  });
  const app = appUrl(`/qidiruv?q=${encodeURIComponent(q)}`);
  // «🔓 Kontaktni ochish» — ro'yxatning o'zidan xarid (`cb:<mutaxassis>` → lib/telegram-bot/contact-pay.ts): narx va to'lov usullari
  const buy: TelegramButton[][] = people.flatMap((p, i) =>
    p.specialistId && typeof p.contactPrice === "number" ? [[{ text: `🔓 ${i + 1}. ${cutPlain(p.name, 22)} — ${p.contactPrice > 0 ? formatPrice(p.contactPrice, { compact: true }) : L(lang, "bepul", "бесплатно")}`, data: `cb:${p.specialistId}` }]] : [],
  );
  const hint = buy.length ? `\n\n${L(lang, "Kontaktni (telefon, Telegram, Instagram) ochish uchun pastdagi tugmani bosing.", "Чтобы открыть контакт (телефон, Telegram, Instagram), нажмите кнопку ниже.")}` : "";
  await sendTelegram(chatId, `${L(lang, `🔎 <b>«${escapeTelegramHtml(q)}»</b> bo'yicha ijodkorlar`, `🔎 Специалисты по запросу <b>«${escapeTelegramHtml(q)}»</b>`)}\n\n${lines.join("\n\n")}${hint}`, {
    keyboard: [...buy, [app ? { text: L(lang, "Hammasini ilovada ko'rish", "Все — в приложении"), webApp: app } : { text: L(lang, "Hammasini ko'rish", "Показать все"), url: `${s}/qidiruv?q=${encodeURIComponent(q)}` }]],
  });
}

/** `/kurslar` — mashhur 5 kurs */
export async function handleCourses(chatId: string, lang?: BotLang): Promise<void> {
  const { listCourses } = await import("@/lib/mentorship/service");
  const s = siteUrl() ?? "";
  const { items } = await listCourses({ sort: "popular", limit: 5 });
  if (!items.length) {
    await sendTelegram(chatId, L(lang, "Hozircha kurslar yo'q.", "Курсов пока нет."), { button: { text: L(lang, "Mentorlik", "Наставничество"), url: `${s}/mentorlik` } });
    return;
  }
  const lines = items.map((c, i) => {
    const price = c.priceFrom > 0 ? formatPrice(c.priceFrom) : L(lang, "Bepul", "Бесплатно");
    return `${i + 1}. <a href="${s}/mentorlik/${c.slug}"><b>${escapeTelegramHtml(c.title)}</b></a>\n   ${c.lessonsCount} ${L(lang, "dars", "уроков")} · ${c.studentsCount} ${L(lang, "talaba", "учеников")} · ${stars(c.rating, lang)} · ${escapeTelegramHtml(price)}`;
  });
  // «Sotib olish» — ro'yxatning o'zidan (`buy:c:<kurs>` → lib/mentorship/telegram-pay.ts): narx va to'lov usullari; bepul kurs — «Boshlash»
  const buy: TelegramButton[][] = items.map((c, i) => [{ text: `${c.priceFrom > 0 ? "🛒" : "🎁"} ${i + 1}. ${c.priceFrom > 0 ? `${L(lang, "Sotib olish", "Купить")} — ${formatPrice(c.priceFrom, { compact: true })}` : L(lang, "Bepul boshlash", "Начать бесплатно")}`, data: `buy:c:${c.id}` }]);
  await sendTelegram(chatId, `🎓 <b>${L(lang, "Mashhur kurslar", "Популярные курсы")}</b>\n\n${lines.join("\n\n")}`, {
    keyboard: [
      ...buy,
      [{ text: L(lang, "Barcha kurslar", "Все курсы"), url: `${s}/mentorlik` }],
      [{ text: L(lang, "📚 Mening kurslarim", "📚 Мои курсы"), data: "menu:mycourses" }],
    ],
  });
}

/** `/efirlar` — jonli va bu haftadagi ustoz efirlari */
export async function handleLives(chatId: string, lang?: BotLang): Promise<void> {
  const { liveAndUpcoming } = await import("@/lib/mentorship/growth");
  const s = siteUrl() ?? "";
  const items = await liveAndUpcoming(6);
  if (!items.length) {
    await sendTelegram(chatId, L(lang, "Hozir jonli efir yo'q va bu haftaga rejalashtirilgani ham yo'q.", "Сейчас нет прямых эфиров, и на эту неделю ничего не запланировано."), { button: { text: L(lang, "Mentorlik", "Наставничество"), url: `${s}/mentorlik` } });
    return;
  }
  const fmt = (ms: number) => new Date(ms).toLocaleString(lang === "ru" ? "ru-RU" : "uz-UZ", { timeZone: "Asia/Tashkent", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const lines = items.map((it) => {
    const href = it.live && it.streamId ? `${s}/efir/${it.streamId}` : it.mentorSlug ? `${s}/mentorlik/ustoz/${it.mentorSlug}?tab=efirlar` : `${s}/mentorlik`;
    return `${it.live ? `🔴 <b>${L(lang, "JONLI", "В ЭФИРЕ")}</b>` : `🗓 ${escapeTelegramHtml(fmt(it.startsAt))}`} — <a href="${href}"><b>${escapeTelegramHtml(it.title)}</b></a>\n   ${escapeTelegramHtml(it.mentorName)}${it.price > 0 ? ` · ${escapeTelegramHtml(formatPrice(it.price))}` : ""}`;
  });
  await sendTelegram(chatId, `🎥 <b>${L(lang, "Efirlar", "Эфиры")}</b>\n\n${lines.join("\n\n")}`, { button: { text: L(lang, "Mentorlik", "Наставничество"), url: `${s}/mentorlik` } });
}

/** `/top` — joriy oy TOP-5 */
export async function handleTop(chatId: string, lang?: BotLang): Promise<void> {
  const { currentMonthTop } = await import("@/lib/top");
  const s = siteUrl() ?? "";
  const rows = await currentMonthTop(5);
  if (!rows.length) {
    await sendTelegram(chatId, L(lang, "Bu oy reytingi hali shakllanmadi.", "Рейтинг этого месяца ещё не сформирован."), { button: { text: L(lang, "TOP reyting", "ТОП-рейтинг"), url: `${s}/top` } });
    return;
  }
  const medal = ["🥇", "🥈", "🥉", "4.", "5."];
  const lines = rows.map((r, i) => `${medal[i] ?? `${i + 1}.`} <a href="${s}/mutaxassislar/${r.author.slug ?? ""}"><b>${escapeTelegramHtml(r.author.name)}</b></a> — ${r.score} ${L(lang, "ball", "баллов")}\n   ❤️ ${r.likes} · 💬 ${r.comments} · 👁 ${r.views}`);
  await sendTelegram(chatId, `🏆 <b>${L(lang, "Oyning TOP ijodkorlari", "ТОП авторов месяца")}</b> (${L(lang, "jonli hisob", "живой счёт")})\n\n${lines.join("\n\n")}`, { button: { text: L(lang, "To'liq reyting", "Полный рейтинг"), url: `${s}/top` } });
}


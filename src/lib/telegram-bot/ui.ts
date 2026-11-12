import "server-only";
import { NOTIFY_GROUP_KEYS, NOTIFY_GROUP_META, type NotifyGroupKey } from "@/lib/notifications";
import { escapeTelegramHtml, sendTelegram, sendTelegramPhoto, telegramApi, telegramBotUsername, type ReplyButton, type TelegramButton } from "@/lib/telegram";
import { siteUrl } from "@/lib/security/site";
import { appLinkUrl, appUrl } from "@/lib/telegram-bot/app-url";
import { L, type BotLang } from "@/lib/telegram-bot/lang";

export { appUrl };

/**
 * Bot DIZAYNI (2026-10-31): profil matnlari, buyruqlar ro'yxati, doimiy menyu, xush kelibsiz ekrani.
 * Hamma matn shu yerda — bot «ovozi» bir joydan boshqariladi. Rasmlar: `public/bot/*.png`
 * (welcome 1280×640 — /start banneri; description 640×360 va avatar — BotFather orqali qo'lda).
 * IKKI TIL (2026-11-10): buyruqlar menyusi va bot tavsifi ham uz/ru — Telegram ularni foydalanuvchi ilovasi tiliga qarab
 * ko'rsatadi (`language_code: "ru"`); foydalanuvchi `/til` bilan boshqa tilni tanlasa, o'sha chatga alohida menyu qo'yiladi.
 */

export const BOT_NAME = "Kasb Egalari";
/** «About» — profil kartasida (≤120 belgi) */
export const BOT_SHORT_DESC = "Kasb Egalari — ijodkorlar platformasi. Buyurtma, xabar va kurs bildirishnomalari Telegramda.";
export const BOT_SHORT_DESC_RU = "Kasb Egalari — платформа творческих специалистов. Заказы, сообщения и курсы — в Telegram.";
/** Bo'sh chatdagi tavsif (≤512 belgi) */
export const BOT_DESC =
  "Kasb Egalari — videograf, montajchi, dizayner va boshqa ijodkorlar platformasining rasmiy boti.\n\n" +
  "• Yangi buyurtma kelganda shu yerda qabul qilasiz\n" +
  "• Xabarlar, to'lovlar va kurslar bo'yicha bildirishnomalar\n" +
  "• Saytga Telegram orqali bir bosishda kirish\n\n" +
  "Boshlash uchun «Start» ni bosing.";
export const BOT_DESC_RU =
  "Kasb Egalari — официальный бот платформы видеографов, монтажёров, дизайнеров и других творческих специалистов.\n\n" +
  "• Новые заказы принимаете прямо здесь\n" +
  "• Уведомления о сообщениях, оплатах и курсах\n" +
  "• Вход на сайт через Telegram в один клик\n\n" +
  "Чтобы начать, нажмите «Start».";

interface Cmd {
  command: string;
  uz: string;
  ru: string;
}
/** Buyruqlar menyusi (Telegram «/» tugmasi) — tartib: eng ko'p ishlatiladigani yuqorida */
const COMMANDS: Cmd[] = [
  { command: "start", uz: "Bosh menyu", ru: "Главное меню" },
  { command: "royxat", uz: "Ro'yxatdan o'tish — hisob ochish (1 daqiqa)", ru: "Регистрация — создать аккаунт (1 минута)" },
  { command: "ilova", uz: "Ilovani Telegram ichida ochish", ru: "Открыть приложение внутри Telegram" },
  { command: "post", uz: "Rasm/video yuborib lentaga post joylash", ru: "Опубликовать пост: пришлите фото или видео" },
  { command: "kontaktlarim", uz: "Ochilgan kontaktlar (telefon, Telegram)", ru: "Открытые контакты (телефон, Telegram)" },
  { command: "buyurtmalarim", uz: "Ochiq buyurtmalar — qabul qilish / rad etish", ru: "Открытые заказы — принять / отклонить" },
  { command: "xabarlar", uz: "Xabarlar — o'qish va javob yozish", ru: "Сообщения — читать и отвечать" },
  { command: "qidiruv", uz: "Ijodkor qidirish: /qidiruv montajchi", ru: "Поиск специалиста: /qidiruv монтажёр" },
  { command: "kurslar", uz: "Kurslar katalogi", ru: "Каталог курсов" },
  { command: "kurslarim", uz: "Mening kurslarim va to'lovlar", ru: "Мои курсы и оплаты" },
  { command: "efirlar", uz: "Jonli va yaqin efirlar", ru: "Прямые и ближайшие эфиры" },
  { command: "vakansiyalar", uz: "So'nggi vakansiyalar", ru: "Свежие вакансии" },
  { command: "arizalarim", uz: "Yuborgan arizalarim va holati", ru: "Мои отклики и их статус" },
  { command: "arizalar", uz: "Vakansiyalarimga kelgan arizalar", ru: "Отклики на мои вакансии" },
  { command: "top", uz: "Oyning TOP ijodkorlari", ru: "ТОП авторов месяца" },
  { command: "profil", uz: "Hisobim va ulanish holati", ru: "Мой аккаунт и статус привязки" },
  { command: "sozlamalar", uz: "Qaysi bildirishnomalar kelsin", ru: "Какие уведомления присылать" },
  { command: "til", uz: "Til: o'zbekcha / ruscha", ru: "Язык: узбекский / русский" },
  { command: "yordam", uz: "Bot nima qila oladi va qo'llab-quvvatlash", ru: "Что умеет бот и поддержка" },
  { command: "stop", uz: "Telegramni hisobdan uzish", ru: "Отвязать Telegram от аккаунта" },
];
/** Faqat admin chatida ko'rinadigan buyruqlar (umumiy ro'yxatdagi /start dan keyin) */
const ADMIN_ONLY: Cmd[] = [
  { command: "admin", uz: "🛠 Admin menyu: statistika, navbat, to'lovlar", ru: "🛠 Админ-меню: статистика, очередь, платежи" },
  { command: "stat", uz: "📊 Statistika — bugun / 7 kun / 30 kun", ru: "📊 Статистика — сегодня / 7 дней / 30 дней" },
  { command: "navbat", uz: "📥 Tasdiq navbati (mutaxassis, o'tkazma, shikoyat)", ru: "📥 Очередь подтверждений (специалисты, переводы, жалобы)" },
  { command: "tolovlar", uz: "💳 Kutilayotgan qo'lda o'tkazmalar", ru: "💳 Ожидающие ручные переводы" },
  { command: "shikoyatlar", uz: "🚩 Ochiq shikoyatlar — yopish / o'chirish / bloklash", ru: "🚩 Открытые жалобы — закрыть / удалить / заблокировать" },
  { command: "mentorlar", uz: "🎓 Mentor arizalari — tasdiqlash / rad etish", ru: "🎓 Заявки менторов — подтвердить / отклонить" },
  { command: "nizolar", uz: "⚖️ Ochiq nizolar (qaror — admin panelda)", ru: "⚖️ Открытые споры (решение — в админ-панели)" },
  { command: "payoutlar", uz: "💸 Pul chiqarish so'rovlari — to'landi / rad etish", ru: "💸 Запросы на вывод — выплачено / отклонить" },
  { command: "user", uz: "👤 Foydalanuvchi qidirish: /user ism, email yoki telefon", ru: "👤 Поиск пользователя: /user имя, email или телефон" },
  { command: "narx", uz: "💰 Kontakt narxlari: /narx middle 60000", ru: "💰 Цены контактов: /narx middle 60000" },
  { command: "konkurs", uz: "🏆 Ijod konkursi: /konkurs Sarlavha | Tavsif | kunlar", ru: "🏆 Творческий конкурс: /konkurs Название | Описание | дни" },
  { command: "elon", uz: "📣 Ommaviy e'lon: /elon Sarlavha | Matn", ru: "📣 Рассылка: /elon Заголовок | Текст" },
  { command: "tuzoq", uz: "🪤 Tuzoq (honeypot): urinishlar va bloklangan IP'lar", ru: "🪤 Ловушка (honeypot): попытки и заблокированные IP" },
  { command: "blok", uz: "⛔ IP'ni bloklash: /blok 1.2.3.4 sabab", ru: "⛔ Заблокировать IP: /blok 1.2.3.4 причина" },
  { command: "blokdan", uz: "✅ IP'ni blokdan chiqarish: /blokdan 1.2.3.4", ru: "✅ Разблокировать IP: /blokdan 1.2.3.4" },
];
type TgCommand = { command: string; description: string };
const pick = (list: Cmd[], lang: BotLang): TgCommand[] => list.map((c) => ({ command: c.command, description: lang === "ru" ? c.ru : c.uz }));

/** Buyruqlar ro'yxati tanlangan tilda */
export const botCommands = (lang: BotLang = "uz"): TgCommand[] => pick(COMMANDS, lang);
/** Admin chat uchun: /start, admin buyruqlari, keyin qolgan umumiy buyruqlar */
export const adminCommands = (lang: BotLang = "uz"): TgCommand[] => [...pick(COMMANDS.slice(0, 1), lang), ...pick(ADMIN_ONLY, lang), ...pick(COMMANDS.slice(1), lang)];
/** Eski nomlar (o'zbekcha ro'yxat) — mos kelish uchun */
export const BOT_COMMANDS = botCommands("uz");
export const ADMIN_COMMANDS = adminCommands("uz");

const chatScope = (chatId: string) => ({ type: "chat", chat_id: Number(chatId) || chatId });

/** Admin chatiga admin buyruqlari bilan menyuni qo'yish (ulanganda, til almashganda va «Bot profilini sozlash»da) */
export async function setAdminCommands(chatId: string, lang: BotLang = "uz"): Promise<boolean> {
  const r = await telegramApi("setMyCommands", { commands: adminCommands(lang), scope: chatScope(chatId) });
  return Boolean(r?.ok);
}
/** Chat uzilganda maxsus (admin / til) menyusini olib tashlash — umumiy menyuga qaytadi */
export async function clearChatCommands(chatId: string): Promise<void> {
  await telegramApi("deleteMyCommands", { scope: chatScope(chatId) });
}
/**
 * Chat tilini qo'llash (`/til`): shu chatga buyruqlar menyusi va Mini App tugmasi tanlangan tilda qo'yiladi — foydalanuvchining
 * Telegram ilovasi boshqa tilda bo'lsa ham bot tanlangan tilda ko'rinadi.
 */
export async function applyChatLanguage(chatId: string, lang: BotLang, admin = false): Promise<void> {
  await telegramApi("setMyCommands", { commands: admin ? adminCommands(lang) : botCommands(lang), scope: chatScope(chatId) });
  const app = appUrl();
  if (app) await telegramApi("setChatMenuButton", { chat_id: Number(chatId) || chatId, menu_button: { type: "web_app", text: L(lang, "Ilova", "Приложение"), web_app: { url: app } } });
}

/** Doimiy menyu tugmalari (chat ostida) — matn tugma sifatida keladi, `MENU_COMMAND` buyruqqa aylantiradi */
export const MENU = {
  app: "📱 Ilovani ochish",
  admin: "🛠 Admin",
  orders: "📦 Buyurtmalarim",
  chat: "💬 Xabarlar",
  courses: "🎓 Kurslar",
  jobs: "💼 Vakansiyalar",
  profile: "👤 Profil",
  help: "❓ Yordam",
} as const;
/** Ruscha doimiy menyu (language_code=ru) — buyruqlar bir xil */
export const MENU_RU = {
  app: "📱 Открыть приложение",
  admin: "🛠 Админ",
  orders: "📦 Мои заказы",
  chat: "💬 Сообщения",
  courses: "🎓 Курсы",
  jobs: "💼 Вакансии",
  profile: "👤 Профиль",
  help: "❓ Помощь",
} as const;
export const MENU_COMMAND: Record<string, string> = {
  [MENU.app]: "/ilova",
  [MENU.admin]: "/admin",
  [MENU.orders]: "/buyurtmalarim",
  [MENU.chat]: "/xabarlar",
  [MENU.courses]: "/kurslar",
  [MENU.jobs]: "/vakansiyalar",
  [MENU.profile]: "/profil",
  [MENU.help]: "/yordam",
  [MENU_RU.app]: "/ilova",
  [MENU_RU.admin]: "/admin",
  [MENU_RU.orders]: "/buyurtmalarim",
  [MENU_RU.chat]: "/xabarlar",
  [MENU_RU.courses]: "/kurslar",
  [MENU_RU.jobs]: "/vakansiyalar",
  [MENU_RU.profile]: "/profil",
  [MENU_RU.help]: "/yordam",
};

/** Sayt manzili: sozlamadagi kanonik manzil; dev'da sozlanmagan bo'lsa — lokal server (nisbiy havola Telegram tugmasiga yaramaydi) */
const site = () => siteUrl() ?? (process.env.NODE_ENV !== "production" ? `http://localhost:${process.env.PORT || 3000}` : "");
const BANNER = () => `${site()}/bot/welcome.png`;

/**
 * Sayt sahifasiga olib boradigan tugma. https bo'lsa — Mini App (`web_app`): Telegram ichida ochiladi va hisobga AVTOMATIK
 * kiradi. Botda ro'yxatdan o'tgan foydalanuvchining paroli yo'q — oddiy `url` tugmasi uni kirish sahifasiga olib borib
 * qo'yardi; shuning uchun shaxsiy sahifalar (kabinet, buyurtma, chat, to'lov holati) FAQAT shu yordamchi orqali beriladi.
 * http (dev) yoki tashqi havolada — oddiy URL.
 */
export function pageButton(text: string, path: string): TelegramButton {
  const app = path.startsWith("/") ? appUrl(path) : null;
  return app ? { text, webApp: app } : { text, url: path.startsWith("/") ? `${site()}${path}` : path };
}

/** Doimiy menyu: yuqorida Mini App tugmasi (https bo'lsa), keyin bo'limlar; admin uchun «🛠 Admin» qatori */
export function menuRows(admin = false, lang: BotLang = "uz"): ReplyButton[][] {
  const app = appUrl();
  const M = lang === "ru" ? MENU_RU : MENU;
  return [
    ...(app ? [[{ text: M.app, webApp: app }]] : []),
    ...(admin ? [[M.admin]] : []),
    [M.orders, M.chat],
    [M.courses, M.jobs],
    [M.profile, M.help],
  ];
}
/** Eski nom — bir xil ma'no */
export const MENU_ROWS = menuRows();

export interface BotAccount {
  id: string;
  name: string;
  role: "client" | "specialist" | "admin";
}

/** «Akkauntingiz bormi?» — Yo'q → botda savol-javob (rg:start); Ha → ulash (rg:have) */
export const ACCOUNT_QUESTION_ROWS = (lang: BotLang = "uz"): TelegramButton[][] => [
  [{ text: L(lang, "❌ Yo'q — ro'yxatdan o'taman", "❌ Нет — зарегистрируюсь"), data: "rg:start" }],
  [{ text: L(lang, "✅ Ha, akkauntim bor — ulash", "✅ Да, есть аккаунт — привязать"), data: "rg:have" }],
];

/** «Ha, akkauntim bor»: ilovada Google/email bilan kirish → Telegram avtomatik ulanadi; zaxira — saytdagi ulash */
export async function sendLinkOptions(chatId: string, lang: BotLang = "uz"): Promise<void> {
  const app = appLinkUrl("/kabinet");
  await sendTelegram(
    chatId,
    L(
      lang,
      "🔗 <b>Akkauntni ulash</b>\nIlovada saytdagi hisobingiz bilan kiring — <b>Google</b> yoki <b>email va parol</b> — Telegram shu hisobga avtomatik ulanadi.\n\nYoki saytda: <b>Kabinet → Profil → «Telegramga ulash»</b>.",
      "🔗 <b>Привязать аккаунт</b>\nВойдите в приложении под аккаунтом сайта — <b>Google</b> или <b>email и пароль</b> — Telegram привяжется к нему автоматически.\n\nИли на сайте: <b>Кабинет → Профиль → «Подключить Telegram»</b>.",
    ),
    {
      keyboard: [
        ...(app ? [[{ text: L(lang, "🔑 Kirish va ulash", "🔑 Войти и привязать"), webApp: app }]] : []),
        [{ text: L(lang, "🌐 Saytda ulash", "🌐 Привязать на сайте"), url: `${site()}/auth/kirish?next=${encodeURIComponent("/kabinet/profil?tab=telegram#telegram")}` }],
        [{ text: L(lang, "⬅️ Akkauntim yo'q — ro'yxatdan o'taman", "⬅️ Нет аккаунта — зарегистрируюсь"), data: "rg:start" }],
      ],
    },
  );
}

/** Xush kelibsiz ekrani: banner + qisqa matn. Ulangan — doimiy menyu; ulanmagan — «akkauntingiz bormi?» savoli */
export async function sendWelcome(chatId: string, me: BotAccount | null, firstName?: string, lang: BotLang = "uz"): Promise<void> {
  const name = firstName ? `<b>${escapeTelegramHtml(firstName)}</b>` : "";
  const hi = lang === "ru" ? (name ? `Привет, ${name}!` : "Привет!") : name ? `Salom, ${name}!` : "Salom!";
  if (me) {
    const caption =
      lang === "ru"
        ? `${hi}\nАккаунт <b>${escapeTelegramHtml(me.name)}</b> привязан ✅\n\n` +
          "Здесь вы:\n📦 принимаете заказы в один клик\n💬 получаете уведомления о сообщениях и оплатах\n🎓 видите курсы и платежи\n🔎 ищете специалиста любым словом\n\nПользуйтесь меню внизу 👇"
        : `${hi}\n<b>${escapeTelegramHtml(me.name)}</b> hisobingiz ulangan ✅\n\n` +
          "Bu yerda:\n" +
          "📦 buyurtmani bir bosishda qabul qilasiz\n" +
          "💬 xabar va to'lov bildirishnomalarini olasiz\n" +
          "🎓 kurslaringizni va to'lovlarni ko'rasiz\n" +
          "🔎 istalgan so'z yozsangiz — ijodkor qidiraman\n\n" +
          "Pastdagi menyudan foydalaning 👇";
    await sendTelegramPhoto(chatId, BANNER(), caption, { replyKeyboard: menuRows(me.role === "admin", lang) });
    return;
  }
  const caption =
    lang === "ru"
      ? `${hi} Это бот <b>Kasb Egalari</b> — платформы видеографов, монтажёров, дизайнеров и других творческих специалистов.\n\n` +
        "После привязки сюда приходят уведомления о заказах, сообщениях и курсах, а заказы можно принимать прямо в боте.\n\n" +
        "<b>У вас есть аккаунт в Kasb Egalari?</b>"
      : `${hi} Bu — <b>Kasb Egalari</b> boti: videograf, montajchi, dizayner va boshqa ijodkorlar platformasi.\n\n` +
        "Ulangach buyurtmalar, xabarlar va kurslar bo'yicha bildirishnomalar shu yerga keladi, buyurtmani botning o'zida qabul qilasiz.\n\n" +
        "<b>Kasb Egalari'da akkauntingiz bormi?</b>";
  await sendTelegramPhoto(chatId, BANNER(), caption, {
    keyboard: [
      ...ACCOUNT_QUESTION_ROWS(lang),
      [
        { text: L(lang, "🌐 Saytni ochish", "🌐 Открыть сайт"), url: `${site()}/` },
        { text: L(lang, "❓ Yordam", "❓ Помощь"), data: "menu:help" },
      ],
      [shareInlineButton(lang)],
    ],
  });
}

/** `/ilova` — Mini App tugmasi */
export async function sendApp(chatId: string, lang: BotLang = "uz"): Promise<void> {
  const app = appUrl();
  if (!app) {
    await sendTelegram(chatId, L(lang, "Ilova faqat https manzilda ishlaydi — saytni oching.", "Приложение работает только по https — откройте сайт."), { button: { text: L(lang, "🌐 Sayt", "🌐 Сайт"), url: `${site()}/` } });
    return;
  }
  await sendTelegram(chatId, L(lang, "📱 <b>Kasb Egalari ilovasi</b> — Telegram ichida ochiladi, hisobingizga avtomatik kirasiz.", "📱 <b>Приложение Kasb Egalari</b> — открывается внутри Telegram, вход в аккаунт выполняется автоматически."), { keyboard: [[{ text: L(lang, "Ilovani ochish", "Открыть приложение"), webApp: app }]] });
}

/** Yordam ostidagi tugmalar: qo'llab-quvvatlashga yozish (`sup:start`) va til (`lng:menu`); ulanmagan chatga — «akkauntingiz bormi?» ham */
/** «Chatga ijodkor yuborish» — inline rejimni bir bosishda ochadi (bot nomini qo'lda yozish shart emas) */
export const shareInlineButton = (lang: BotLang, q = ""): TelegramButton => ({ text: L(lang, "📤 Chatga ijodkor yuborish", "📤 Отправить специалиста в чат"), switchInline: q });

function helpKeyboard(linked: boolean, lang: BotLang): TelegramButton[][] {
  return [
    [shareInlineButton(lang)],
    [{ text: L(lang, "✍️ Qo'llab-quvvatlashga yozish", "✍️ Написать в поддержку"), data: "sup:start" }],
    [{ text: L(lang, "🌐 Til / Язык", "🌐 Язык / Til"), data: "lng:menu" }],
    ...(linked ? [] : ACCOUNT_QUESTION_ROWS(lang)),
  ];
}

/** Yordam — bot nima qila oladi (ulangan/ulanmagan holatga qarab) */
export async function sendHelp(chatId: string, linked: boolean, admin = false, lang: BotLang = "uz"): Promise<void> {
  if (lang === "ru") {
    const ru =
      "<b>Что умеет бот Kasb Egalari</b>\n\n" +
      "📦 /buyurtmalarim — открытые заказы; новый заказ принимаете кнопкой «Принять» / «Отклонить»\n" +
      "💬 /xabarlar — переписки: читать и отвечать прямо здесь\n" +
      "🔎 любое слово или /qidiruv &lt;слово&gt; — поиск специалиста (например: <i>монтажёр Ташкент</i>), контакт можно открыть тут же; в любом чате <code>@bot слово</code> — поделиться карточкой\n" +
      "🎓 /kurslar — каталог и покупка · /kurslarim — мои курсы и ожидающие оплаты (чек — фото или PDF — можно прислать сюда)\n" +
      "🔴 /efirlar — эфиры · 🏆 /top — ТОП месяца\n" +
      "💼 /vakansiyalar — вакансии · /arizalarim — мои отклики · /arizalar — отклики на мои вакансии (в шорт-лист / отклонить)\n" +
      "📱 /ilova — приложение внутри Telegram\n" +
      "📸 /post — пришлите фото или видео (подпись под фото) — опубликую пост или сторис\n" +
      "🔓 /kontaktlarim — открытые вами контакты (телефон, Telegram, Instagram)\n" +
      "👤 /profil — аккаунт, заполненность профиля и следующий шаг\n" +
      "🔔 /sozlamalar — какие уведомления присылать · 🌐 /til — язык бота\n" +
      "🔐 Если на сайте нажать «Войти через Telegram» — подтверждение придёт сюда\n" +
      (linked ? "" : "📝 /royxat — создать аккаунт (вопрос-ответ, 1 минута); если аккаунт уже есть — кнопка «Да, есть аккаунт»\n") +
      "⛔ /stop — отвязать Telegram\n" +
      (admin ? "🛠 /admin · 📊 /stat · 📥 /navbat · 💳 /tolovlar · 🚩 /shikoyatlar · 🎓 /mentorlar · ⚖️ /nizolar · 💸 /payoutlar · 👤 /user имя · 💰 /narx · 🏆 /konkurs · 📣 /elon · 🪤 /tuzoq · ⛔ /blok · ✅ /blokdan — инструменты администратора\n" : "") +
      "\n" +
      (linked ? "Аккаунт привязан ✅" : "Аккаунт ещё не привязан.") +
      "\n\nЕсть вопрос или что-то не работает? Напишите в поддержку — кнопка ниже.";
    await sendTelegram(chatId, ru, { keyboard: helpKeyboard(linked, "ru") });
    return;
  }
  const text =
    "<b>Kasb Egalari boti nima qiladi</b>\n\n" +
    "📦 /buyurtmalarim — ochiq buyurtmalar; yangi buyurtmani «Qabul qilish» / «Rad etish» tugmasi bilan hal qilasiz\n" +
    "💬 /xabarlar — suhbatlar: o'qish va shu yerning o'zida javob yozish\n" +
    "🔎 istalgan so'z yoki /qidiruv &lt;so'z&gt; — ijodkor qidirish (masalan: <i>montajchi Toshkent</i>), kontaktini shu yerda ochish mumkin; istalgan chatda <code>@bot so'z</code> — ijodkor kartasini ulashish\n" +
    "🎓 /kurslar — katalog va sotib olish · /kurslarim — yozilgan kurslar, kutilayotgan to'lovlar (chek rasmi yoki PDF'ni shu yerga yuborsangiz bo'ladi)\n" +
    "🔴 /efirlar — jonli va yaqin efirlar · 🏆 /top — oyning TOP ijodkorlari\n" +
    "💼 /vakansiyalar — so'nggi vakansiyalar · /arizalarim — yuborgan arizalarim · /arizalar — vakansiyalarimga kelgan arizalar (tanlovga olish / rad etish)\n" +
    "📱 /ilova — Telegram ichida ochiladigan ilova\n" +
    "📸 /post — rasm yoki video yuboring (izoh rasm ostida) — post yoki story joylayman\n" +
    "🔓 /kontaktlarim — ochgan kontaktlaringiz (telefon, Telegram, Instagram) shu yerda\n" +
    "👤 /profil — hisob, profil to'liqligi va keyingi qadam\n" +
    "🔔 /sozlamalar — qaysi bildirishnomalar Telegramga kelsin · 🌐 /til — bot tili\n" +
    "🔐 Saytda «Telegram bilan kirish» bosilsa — tasdiqlash shu yerga keladi\n" +
    (linked ? "" : "📝 /royxat — hisob ochish (savol-javob, 1 daqiqa) · akkauntingiz bo'lsa — «Ha, akkauntim bor» tugmasi bilan ulang\n") +
    "⛔ /stop — Telegramni hisobdan uzish\n" +
    (admin ? "🛠 /admin — admin menyu · 📊 /stat — statistika va trend · 📥 /navbat — tasdiq navbati · 💳 /tolovlar · 🚩 /shikoyatlar — shikoyatlarni chatda hal qilish · 🎓 /mentorlar — mentor arizalari · ⚖️ /nizolar — ochiq nizolar · 💸 /payoutlar — pul chiqarish so'rovlari · 👤 /user ism (blok, kontakt rejimi, maxsus narx) · 💰 /narx — kontakt narxlari · 🏆 /konkurs — ijod konkursi ochish · 📣 /elon — ommaviy e'lon · 🪤 /tuzoq — tuzoq holati · ⛔ /blok va ✅ /blokdan — IP bloklash\n" : "") +
    "\n" +
    (linked ? "Hisob ulangan ✅" : "Hisob hali ulanmagan — saytda Kabinet → Profil → «Telegramga ulash».") +
    "\n\nSavol yoki muammo bo'lsa — pastdagi tugma orqali qo'llab-quvvatlashga yozing.";
  await sendTelegram(chatId, text, { keyboard: helpKeyboard(linked, "uz") });
}

/** Ulanmagan chat uchun standart javob (amal tugmasi bilan) */
export async function sendNotLinked(chatId: string, lang: BotLang = "uz"): Promise<void> {
  await sendTelegram(chatId, L(lang, "Bu amal uchun hisob kerak. <b>Kasb Egalari'da akkauntingiz bormi?</b>", "Для этого нужен аккаунт. <b>У вас есть аккаунт в Kasb Egalari?</b>"), { keyboard: ACCOUNT_QUESTION_ROWS(lang) });
}

/* ------------------------------------------------------------------ */
/* Sozlamalar: bildirishnoma guruhlari (notify_prefs) — inline switch  */
/* ------------------------------------------------------------------ */

const GROUP_ICON: Record<NotifyGroupKey, string> = { orders: "📦", jobs: "💼", social: "❤️", chat: "💬", system: "⚙️" };

/** Sozlamalar klaviaturasi: har guruh — bitta qator, bosilsa `st:<guruh>` bilan almashadi */
export function settingsKeyboard(prefs: Record<string, boolean>, lang: BotLang = "uz"): TelegramButton[][] {
  const rows: TelegramButton[][] = NOTIFY_GROUP_KEYS.map((k) => [{ text: `${prefs[k] === false ? "○" : "●"} ${GROUP_ICON[k]} ${lang === "ru" ? GROUP_LABEL_RU[k] : NOTIFY_GROUP_META[k].label}`, data: `st:${k}` }]);
  rows.push([pageButton(L(lang, "Saytdagi sozlamalar", "Настройки на сайте"), "/kabinet/bildirishnomalar#sozlamalar")]);
  return rows;
}
export const SETTINGS_TEXT = "<b>Bildirishnomalar</b>\nQaysi turdagi xabarlar Telegramga kelsin — bosib yoqing/o'chiring (● yoqilgan, ○ o'chirilgan).\nHisob xavfsizligi va nizo xabarlari doim keladi.";
export const SETTINGS_TEXT_RU = "<b>Уведомления</b>\nКакие сообщения присылать в Telegram — нажмите, чтобы включить/выключить (● включено, ○ выключено).\nСообщения о безопасности аккаунта и спорах приходят всегда.";
const GROUP_LABEL_RU: Record<NotifyGroupKey, string> = { orders: "Заказы", jobs: "Объявления и вакансии", social: "Соцсеть", chat: "Сообщения", system: "Система" };

/* ------------------------------------------------------------------ */
/* Bot profili (Bot API orqali bir tugmada) — admin paneldan           */
/* ------------------------------------------------------------------ */

export interface BotProfileResult {
  name: boolean;
  shortDescription: boolean;
  description: boolean;
  commands: boolean;
  menuButton: boolean;
  /** /elon menyusi qo'yilgan admin chatlari soni */
  adminChats: number;
  errors: string[];
}

/** Nom, tavsiflar, buyruqlar menyusi va menyu tugmasi — hammasi API bilan (rasm va avatar — BotFather) */
export async function setupBotProfile(): Promise<BotProfileResult> {
  const errors: string[] = [];
  const call = async (method: string, body: Record<string, unknown>) => {
    const r = await telegramApi(method, body);
    if (!r?.ok) errors.push(`${method}: ${r?.description ?? "ulanib bo'lmadi"}`);
    return Boolean(r?.ok);
  };
  const all = { type: "all_private_chats" };
  const [name, shortDescription, description, commands, menuButton] = await Promise.all([
    call("setMyName", { name: BOT_NAME }),
    call("setMyShortDescription", { short_description: BOT_SHORT_DESC }),
    call("setMyDescription", { description: BOT_DESC }),
    call("setMyCommands", { commands: botCommands("uz"), scope: all }),
    // Menyu tugmasi: https bo'lsa Mini App («Ilova»), aks holda buyruqlar ro'yxati
    call("setChatMenuButton", { menu_button: appUrl() ? { type: "web_app", text: "Ilova", web_app: { url: appUrl() } } : { type: "commands" } }),
  ]);
  // Ruscha variantlar: Telegram ilovasi rus tilida bo'lgan foydalanuvchiga tavsif va buyruqlar menyusi ruscha ko'rinadi
  // (natija asosiy bayroqlarga qo'shilmaydi — xato bo'lsa `errors`ga yoziladi)
  await Promise.all([
    call("setMyShortDescription", { short_description: BOT_SHORT_DESC_RU, language_code: "ru" }),
    call("setMyDescription", { description: BOT_DESC_RU, language_code: "ru" }),
    call("setMyCommands", { commands: botCommands("ru"), scope: all, language_code: "ru" }),
  ]);
  // Adminlar (Telegram ulangan) — chat scope bilan admin buyruqlari ham menyuda, har biri o'z tilida
  let adminChats = 0;
  try {
    const { db } = await import("@/lib/db");
    const { users } = await import("@/lib/db/schema");
    const { and, eq, isNotNull } = await import("drizzle-orm");
    const admins = await db.select({ chat: users.telegramChatId, lang: users.lang }).from(users).where(and(eq(users.role, "admin"), eq(users.isBanned, false), isNotNull(users.telegramChatId)));
    for (const a of admins) if (a.chat && (await setAdminCommands(a.chat, a.lang === "ru" ? "ru" : "uz"))) adminChats++;
  } catch (e) {
    errors.push(`adminCommands: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { name, shortDescription, description, commands, menuButton, adminChats, errors };
}

/** Bot havolasi (deep-link'siz) — profil kartasi uchun */
export function botLink(): string | null {
  const u = telegramBotUsername();
  return u ? `https://t.me/${u}` : null;
}

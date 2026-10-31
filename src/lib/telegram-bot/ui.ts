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
 */

export const BOT_NAME = "Kasb Egalari";
/** «About» — profil kartasida (≤120 belgi) */
export const BOT_SHORT_DESC = "Kasb Egalari — ijodkorlar platformasi. Buyurtma, xabar va kurs bildirishnomalari Telegramda.";
/** Bo'sh chatdagi tavsif (≤512 belgi) */
export const BOT_DESC =
  "Kasb Egalari — videograf, montajchi, dizayner va boshqa ijodkorlar platformasining rasmiy boti.\n\n" +
  "• Yangi buyurtma kelganda shu yerda qabul qilasiz\n" +
  "• Xabarlar, to'lovlar va kurslar bo'yicha bildirishnomalar\n" +
  "• Saytga Telegram orqali bir bosishda kirish\n\n" +
  "Boshlash uchun «Start» ni bosing.";

/** Buyruqlar menyusi (Telegram «/» tugmasi) — tartib: eng ko'p ishlatiladigani yuqorida */
export const BOT_COMMANDS: { command: string; description: string }[] = [
  { command: "start", description: "Bosh menyu" },
  { command: "royxat", description: "Ro'yxatdan o'tish — hisob ochish (1 daqiqa)" },
  { command: "ilova", description: "Ilovani Telegram ichida ochish" },
  { command: "post", description: "Rasm/video yuborib lentaga post joylash" },
  { command: "kontaktlarim", description: "Ochilgan kontaktlar (telefon, Telegram)" },
  { command: "buyurtmalarim", description: "Ochiq buyurtmalar — qabul qilish / rad etish" },
  { command: "xabarlar", description: "O'qilmagan xabarlar" },
  { command: "qidiruv", description: "Ijodkor qidirish: /qidiruv montajchi" },
  { command: "kurslar", description: "Kurslar katalogi" },
  { command: "kurslarim", description: "Mening kurslarim va to'lovlar" },
  { command: "efirlar", description: "Jonli va yaqin efirlar" },
  { command: "vakansiyalar", description: "So'nggi vakansiyalar" },
  { command: "top", description: "Oyning TOP ijodkorlari" },
  { command: "profil", description: "Hisobim va ulanish holati" },
  { command: "sozlamalar", description: "Qaysi bildirishnomalar kelsin" },
  { command: "yordam", description: "Bot nima qila oladi" },
  { command: "stop", description: "Telegramni hisobdan uzish" },
];

/** Admin chat uchun buyruqlar: umumiy ro'yxat + /elon (Telegram «chat» scope — faqat shu chatda ko'rinadi) */
export const ADMIN_COMMANDS = [
  ...BOT_COMMANDS.slice(0, 1),
  { command: "admin", description: "🛠 Admin menyu: statistika, navbat, to'lovlar" },
  { command: "stat", description: "📊 Statistika — bugun / 7 kun / 30 kun" },
  { command: "navbat", description: "📥 Tasdiq navbati (mutaxassis, o'tkazma, shikoyat)" },
  { command: "tolovlar", description: "💳 Kutilayotgan qo'lda o'tkazmalar" },
  { command: "user", description: "👤 Foydalanuvchi qidirish: /user ism yoki email" },
  { command: "narx", description: "💰 Kontakt narxlari: /narx middle 60000" },
  { command: "elon", description: "📣 Ommaviy e'lon: /elon Sarlavha | Matn" },
  ...BOT_COMMANDS.slice(1),
];

/** Admin chatiga /elon bilan buyruqlar menyusini qo'yish (ulanganda va «Bot profilini sozlash»da) */
export async function setAdminCommands(chatId: string): Promise<boolean> {
  const r = await telegramApi("setMyCommands", { commands: ADMIN_COMMANDS, scope: { type: "chat", chat_id: Number(chatId) || chatId } });
  return Boolean(r?.ok);
}
/** Chat uzilganda admin menyusini olib tashlash */
export async function clearChatCommands(chatId: string): Promise<void> {
  await telegramApi("deleteMyCommands", { scope: { type: "chat", chat_id: Number(chatId) || chatId } });
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

const site = () => siteUrl() ?? "";
const BANNER = () => `${site()}/bot/welcome.png`;

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
    ],
  });
}

/** `/ilova` — Mini App tugmasi */
export async function sendApp(chatId: string): Promise<void> {
  const app = appUrl();
  if (!app) {
    await sendTelegram(chatId, "Ilova faqat https manzilda ishlaydi — saytni oching.", { button: { text: "🌐 Sayt", url: `${site()}/` } });
    return;
  }
  await sendTelegram(chatId, "📱 <b>Kasb Egalari ilovasi</b> — Telegram ichida ochiladi, hisobingizga avtomatik kirasiz.", { keyboard: [[{ text: "Ilovani ochish", webApp: app }]] });
}

/** Yordam — bot nima qila oladi (ulangan/ulanmagan holatga qarab) */
export async function sendHelp(chatId: string, linked: boolean, admin = false, lang: BotLang = "uz"): Promise<void> {
  if (lang === "ru") {
    const ru =
      "<b>Что умеет бот Kasb Egalari</b>\n\n" +
      "📦 /buyurtmalarim — открытые заказы; новый заказ принимаете кнопкой «Принять» / «Отклонить»\n" +
      "💬 /xabarlar — непрочитанные сообщения и ссылка на чат\n" +
      "🔎 любое слово или /qidiruv &lt;слово&gt; — поиск специалиста (например: <i>монтажёр Ташкент</i>); в любом чате <code>@bot слово</code> — поделиться карточкой\n" +
      "🎓 /kurslar — каталог · /kurslarim — мои курсы и ожидающие оплаты (чек можно прислать сюда)\n" +
      "🔴 /efirlar — эфиры · 🏆 /top — ТОП месяца · 💼 /vakansiyalar — вакансии\n" +
      "📱 /ilova — приложение внутри Telegram\n" +
      "📸 /post — пришлите фото или видео (подпись под фото) — опубликую пост или сторис\n" +
      "🔓 /kontaktlarim — открытые вами контакты (телефон, Telegram, Instagram)\n" +
      "👤 /profil — аккаунт и статус привязки · 🔔 /sozlamalar — какие уведомления присылать\n" +
      (linked ? "" : "📝 /royxat — создать аккаунт (вопрос-ответ, 1 минута); если аккаунт уже есть — кнопка «Да, есть аккаунт»\n") +
      "⛔ /stop — отвязать Telegram\n" +
      (admin ? "🛠 /admin · 📊 /stat · 📥 /navbat · 💳 /tolovlar · 👤 /user имя · 💰 /narx · 📣 /elon — инструменты администратора\n" : "") +
      "\n" +
      (linked ? "Аккаунт привязан ✅" : "Аккаунт ещё не привязан.");
    await sendTelegram(chatId, ru, linked ? { replyKeyboard: menuRows(admin, "ru") } : { keyboard: ACCOUNT_QUESTION_ROWS("ru") });
    return;
  }
  const text =
    "<b>Kasb Egalari boti nima qiladi</b>\n\n" +
    "📦 /buyurtmalarim — ochiq buyurtmalar; yangi buyurtmani «Qabul qilish» / «Rad etish» tugmasi bilan hal qilasiz\n" +
    "💬 /xabarlar — o'qilmagan xabarlar soni va chatga havola\n" +
    "🔎 istalgan so'z yoki /qidiruv &lt;so'z&gt; — ijodkor qidirish (masalan: <i>montajchi Toshkent</i>); istalgan chatda <code>@bot so'z</code> — ijodkor kartasini ulashish\n" +
    "🎓 /kurslar — katalog · /kurslarim — yozilgan kurslar, kutilayotgan to'lovlar (chek rasmini shu yerga yuborsangiz bo'ladi)\n" +
    "🔴 /efirlar — jonli va yaqin efirlar · 🏆 /top — oyning TOP ijodkorlari\n" +
    "💼 /vakansiyalar — so'nggi ochiq vakansiyalar\n" +
    "📱 /ilova — Telegram ichida ochiladigan ilova\n" +
    "📸 /post — rasm yoki video yuboring (izoh rasm ostida) — lentangizga post joylayman\n" +
    "🔓 /kontaktlarim — ochgan kontaktlaringiz (telefon, Telegram, Instagram) shu yerda\n" +
    "👤 /profil — hisob va ulanish holati\n" +
    "🔔 /sozlamalar — qaysi bildirishnomalar Telegramga kelsin\n" +
    "🔐 Saytda «Telegram bilan kirish» bosilsa — tasdiqlash shu yerga keladi\n" +
    (linked ? "" : "📝 /royxat — hisob ochish (savol-javob, 1 daqiqa) · akkauntingiz bo'lsa — «Ha, akkauntim bor» tugmasi bilan ulang\n") +
    "⛔ /stop — Telegramni hisobdan uzish\n" +
    (admin ? "🛠 /admin — admin menyu · 📊 /stat — statistika · 📥 /navbat — tasdiq navbati · 💳 /tolovlar · 👤 /user ism (blok, kontakt rejimi, maxsus narx) · 💰 /narx — kontakt narxlari · 📣 /elon — ommaviy e'lon\n" : "") +
    "\n" +
    (linked ? "Hisob ulangan ✅" : "Hisob hali ulanmagan — saytda Kabinet → Profil → «Telegramga ulash».");
  await sendTelegram(chatId, text, linked ? { replyKeyboard: menuRows(admin) } : { keyboard: ACCOUNT_QUESTION_ROWS() });
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
export function settingsKeyboard(prefs: Record<string, boolean>): TelegramButton[][] {
  const rows: TelegramButton[][] = NOTIFY_GROUP_KEYS.map((k) => [{ text: `${prefs[k] === false ? "○" : "●"} ${GROUP_ICON[k]} ${NOTIFY_GROUP_META[k].label}`, data: `st:${k}` }]);
  rows.push([{ text: "Saytdagi sozlamalar", url: `${site()}/kabinet/bildirishnomalar#sozlamalar` }]);
  return rows;
}
export const SETTINGS_TEXT = "<b>Bildirishnomalar</b>\nQaysi turdagi xabarlar Telegramga kelsin — bosib yoqing/o'chiring (● yoqilgan, ○ o'chirilgan).\nHisob xavfsizligi va nizo xabarlari doim keladi.";

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
  const [name, shortDescription, description, commands, menuButton] = await Promise.all([
    call("setMyName", { name: BOT_NAME }),
    call("setMyShortDescription", { short_description: BOT_SHORT_DESC }),
    call("setMyDescription", { description: BOT_DESC }),
    call("setMyCommands", { commands: BOT_COMMANDS, scope: { type: "all_private_chats" } }),
    // Menyu tugmasi: https bo'lsa Mini App («Ilova»), aks holda buyruqlar ro'yxati
    call("setChatMenuButton", { menu_button: appUrl() ? { type: "web_app", text: "Ilova", web_app: { url: appUrl() } } : { type: "commands" } }),
  ]);
  // Adminlar (Telegram ulangan) — chat scope bilan /elon ham menyuda
  let adminChats = 0;
  try {
    const { db } = await import("@/lib/db");
    const { users } = await import("@/lib/db/schema");
    const { and, eq, isNotNull } = await import("drizzle-orm");
    const admins = await db.select({ chat: users.telegramChatId }).from(users).where(and(eq(users.role, "admin"), eq(users.isBanned, false), isNotNull(users.telegramChatId)));
    for (const a of admins) if (a.chat && (await setAdminCommands(a.chat))) adminChats++;
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

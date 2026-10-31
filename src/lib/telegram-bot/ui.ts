import "server-only";
import { NOTIFY_GROUP_KEYS, NOTIFY_GROUP_META, type NotifyGroupKey } from "@/lib/notifications";
import { escapeTelegramHtml, sendTelegram, sendTelegramPhoto, telegramApi, telegramBotUsername, type ReplyButton, type TelegramButton } from "@/lib/telegram";
import { siteUrl } from "@/lib/security/site";
import { appUrl } from "@/lib/telegram-bot/app-url";

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
  { command: "ilova", description: "Ilovani Telegram ichida ochish" },
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

/** Doimiy menyu tugmalari (chat ostida) — matn tugma sifatida keladi, `MENU_COMMAND` buyruqqa aylantiradi */
export const MENU = {
  app: "📱 Ilovani ochish",
  orders: "📦 Buyurtmalarim",
  chat: "💬 Xabarlar",
  courses: "🎓 Kurslar",
  jobs: "💼 Vakansiyalar",
  profile: "👤 Profil",
  help: "❓ Yordam",
} as const;
export const MENU_COMMAND: Record<string, string> = {
  [MENU.app]: "/ilova",
  [MENU.orders]: "/buyurtmalarim",
  [MENU.chat]: "/xabarlar",
  [MENU.courses]: "/kurslar",
  [MENU.jobs]: "/vakansiyalar",
  [MENU.profile]: "/profil",
  [MENU.help]: "/yordam",
};

const site = () => siteUrl() ?? "";
const BANNER = () => `${site()}/bot/welcome.png`;

/** Doimiy menyu: yuqorida Mini App tugmasi (https bo'lsa), keyin bo'limlar */
export function menuRows(): ReplyButton[][] {
  const app = appUrl();
  return [
    ...(app ? [[{ text: MENU.app, webApp: app }]] : []),
    [MENU.orders, MENU.chat],
    [MENU.courses, MENU.jobs],
    [MENU.profile, MENU.help],
  ];
}
/** Eski nom — bir xil ma'no */
export const MENU_ROWS = menuRows();

export interface BotAccount {
  id: string;
  name: string;
  role: "client" | "specialist" | "admin";
}

/** Xush kelibsiz ekrani: banner + qisqa matn. Ulangan — doimiy menyu; ulanmagan — «Hisobni ulash» tugmasi */
export async function sendWelcome(chatId: string, me: BotAccount | null, firstName?: string): Promise<void> {
  const hi = firstName ? `Salom, <b>${escapeTelegramHtml(firstName)}</b>!` : "Salom!";
  if (me) {
    const caption =
      `${hi}\n<b>${escapeTelegramHtml(me.name)}</b> hisobingiz ulangan ✅\n\n` +
      "Bu yerda:\n" +
      "📦 buyurtmani bir bosishda qabul qilasiz\n" +
      "💬 xabar va to'lov bildirishnomalarini olasiz\n" +
      "🎓 kurslaringizni va to'lovlarni ko'rasiz\n" +
      "🔎 istalgan so'z yozsangiz — ijodkor qidiraman\n\n" +
      "Pastdagi menyudan foydalaning 👇";
    await sendTelegramPhoto(chatId, BANNER(), caption, { replyKeyboard: menuRows() });
    return;
  }
  const caption =
    `${hi} Bu — <b>Kasb Egalari</b> boti.\n\n` +
    "Hisobingizni ulasangiz buyurtmalar, xabarlar va kurslar bo'yicha bildirishnomalar shu yerga keladi, buyurtmani botning o'zida qabul qilasiz.\n\n" +
    "Ulash: saytda <b>Kabinet → Profil → «Telegramga ulash»</b> — bot o'zi ochiladi.";
  const app = appUrl();
  await sendTelegramPhoto(chatId, BANNER(), caption, {
    keyboard: [
      ...(app ? [[{ text: "📱 Ilovani ochish — shu yerdan kirish", webApp: app }]] : []),
      [{ text: "🔗 Hisobni ulash", url: `${site()}/kabinet/profil?tab=telegram#telegram` }],
      [
        { text: "🌐 Saytni ochish", url: `${site()}/` },
        { text: "❓ Yordam", data: "menu:help" },
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
export async function sendHelp(chatId: string, linked: boolean, admin = false): Promise<void> {
  const text =
    "<b>Kasb Egalari boti nima qiladi</b>\n\n" +
    "📦 /buyurtmalarim — ochiq buyurtmalar; yangi buyurtmani «Qabul qilish» / «Rad etish» tugmasi bilan hal qilasiz\n" +
    "💬 /xabarlar — o'qilmagan xabarlar soni va chatga havola\n" +
    "🔎 istalgan so'z yoki /qidiruv &lt;so'z&gt; — ijodkor qidirish (masalan: <i>montajchi Toshkent</i>)\n" +
    "🎓 /kurslar — katalog · /kurslarim — yozilgan kurslar, kutilayotgan to'lovlar (chek rasmini shu yerga yuborsangiz bo'ladi)\n" +
    "🔴 /efirlar — jonli va yaqin efirlar · 🏆 /top — oyning TOP ijodkorlari\n" +
    "💼 /vakansiyalar — so'nggi ochiq vakansiyalar\n" +
    "📱 /ilova — Telegram ichida ochiladigan ilova\n" +
    "👤 /profil — hisob va ulanish holati\n" +
    "🔔 /sozlamalar — qaysi bildirishnomalar Telegramga kelsin\n" +
    "🔐 Saytda «Telegram bilan kirish» bosilsa — tasdiqlash shu yerga keladi\n" +
    "⛔ /stop — Telegramni hisobdan uzish\n" +
    (admin ? "📣 /elon Sarlavha | Matn — barcha foydalanuvchilarga e'lon (faqat admin)\n" : "") +
    "\n" +
    (linked ? "Hisob ulangan ✅" : "Hisob hali ulanmagan — saytda Kabinet → Profil → «Telegramga ulash».");
  await sendTelegram(chatId, text, linked ? { replyKeyboard: menuRows() } : { button: { text: "🔗 Hisobni ulash", url: `${site()}/kabinet/profil?tab=telegram#telegram` } });
}

/** Ulanmagan chat uchun standart javob (amal tugmasi bilan) */
export async function sendNotLinked(chatId: string): Promise<void> {
  await sendTelegram(chatId, "Bu amal uchun avval hisobni ulang: saytda <b>Kabinet → Profil → «Telegramga ulash»</b>.", {
    keyboard: [[{ text: "🔗 Hisobni ulash", url: `${site()}/kabinet/profil?tab=telegram#telegram` }]],
  });
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
  return { name, shortDescription, description, commands, menuButton, errors };
}

/** Bot havolasi (deep-link'siz) — profil kartasi uchun */
export function botLink(): string | null {
  const u = telegramBotUsername();
  return u ? `https://t.me/${u}` : null;
}

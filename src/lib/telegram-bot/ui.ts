import "server-only";
import { NOTIFY_GROUP_KEYS, NOTIFY_GROUP_META, type NotifyGroupKey } from "@/lib/notifications";
import { escapeTelegramHtml, sendTelegram, sendTelegramPhoto, telegramApi, telegramBotUsername, type TelegramButton } from "@/lib/telegram";
import { siteUrl } from "@/lib/security/site";

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
  { command: "buyurtmalarim", description: "Ochiq buyurtmalar — qabul qilish / rad etish" },
  { command: "xabarlar", description: "O'qilmagan xabarlar" },
  { command: "kurslarim", description: "Mening kurslarim va to'lovlar" },
  { command: "vakansiyalar", description: "So'nggi vakansiyalar" },
  { command: "profil", description: "Hisobim va ulanish holati" },
  { command: "sozlamalar", description: "Qaysi bildirishnomalar kelsin" },
  { command: "yordam", description: "Bot nima qila oladi" },
  { command: "stop", description: "Telegramni hisobdan uzish" },
];

/** Doimiy menyu tugmalari (chat ostida) — matn tugma sifatida keladi, `MENU_COMMAND` buyruqqa aylantiradi */
export const MENU = {
  orders: "📦 Buyurtmalarim",
  chat: "💬 Xabarlar",
  courses: "🎓 Kurslarim",
  jobs: "💼 Vakansiyalar",
  profile: "👤 Profil",
  help: "❓ Yordam",
} as const;
export const MENU_ROWS: string[][] = [
  [MENU.orders, MENU.chat],
  [MENU.courses, MENU.jobs],
  [MENU.profile, MENU.help],
];
export const MENU_COMMAND: Record<string, string> = {
  [MENU.orders]: "/buyurtmalarim",
  [MENU.chat]: "/xabarlar",
  [MENU.courses]: "/kurslarim",
  [MENU.jobs]: "/vakansiyalar",
  [MENU.profile]: "/profil",
  [MENU.help]: "/yordam",
};

const site = () => siteUrl() ?? "";
const BANNER = () => `${site()}/bot/welcome.png`;

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
      "🎓 kurslaringizni va to'lovlarni ko'rasiz\n\n" +
      "Pastdagi menyudan foydalaning 👇";
    await sendTelegramPhoto(chatId, BANNER(), caption, { replyKeyboard: MENU_ROWS });
    return;
  }
  const caption =
    `${hi} Bu — <b>Kasb Egalari</b> boti.\n\n` +
    "Hisobingizni ulasangiz buyurtmalar, xabarlar va kurslar bo'yicha bildirishnomalar shu yerga keladi, buyurtmani botning o'zida qabul qilasiz.\n\n" +
    "Ulash: saytda <b>Kabinet → Profil → «Telegramga ulash»</b> — bot o'zi ochiladi.";
  await sendTelegramPhoto(chatId, BANNER(), caption, {
    keyboard: [
      [{ text: "🔗 Hisobni ulash", url: `${site()}/kabinet/profil?tab=telegram#telegram` }],
      [
        { text: "🌐 Saytni ochish", url: `${site()}/` },
        { text: "❓ Yordam", data: "menu:help" },
      ],
    ],
  });
}

/** Yordam — bot nima qila oladi (ulangan/ulanmagan holatga qarab) */
export async function sendHelp(chatId: string, linked: boolean): Promise<void> {
  const text =
    "<b>Kasb Egalari boti nima qiladi</b>\n\n" +
    "📦 /buyurtmalarim — ochiq buyurtmalar; yangi buyurtmani «Qabul qilish» / «Rad etish» tugmasi bilan hal qilasiz\n" +
    "💬 /xabarlar — o'qilmagan xabarlar soni va chatga havola\n" +
    "🎓 /kurslarim — yozilgan kurslar, kutilayotgan to'lovlar (chek rasmini shu yerga yuborsangiz bo'ladi)\n" +
    "💼 /vakansiyalar — so'nggi ochiq vakansiyalar\n" +
    "👤 /profil — hisob va ulanish holati\n" +
    "🔔 /sozlamalar — qaysi bildirishnomalar Telegramga kelsin\n" +
    "🔐 Saytda «Telegram bilan kirish» bosilsa — tasdiqlash shu yerga keladi\n" +
    "⛔ /stop — Telegramni hisobdan uzish\n\n" +
    (linked ? "Hisob ulangan ✅" : "Hisob hali ulanmagan — saytda Kabinet → Profil → «Telegramga ulash».");
  await sendTelegram(chatId, text, linked ? { replyKeyboard: MENU_ROWS } : { button: { text: "🔗 Hisobni ulash", url: `${site()}/kabinet/profil?tab=telegram#telegram` } });
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
    call("setChatMenuButton", { menu_button: { type: "commands" } }),
  ]);
  return { name, shortDescription, description, commands, menuButton, errors };
}

/** Bot havolasi (deep-link'siz) — profil kartasi uchun */
export function botLink(): string | null {
  const u = telegramBotUsername();
  return u ? `https://t.me/${u}` : null;
}

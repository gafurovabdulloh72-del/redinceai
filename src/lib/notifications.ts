import "server-only";
import { after } from "next/server";
import { and, desc, eq, gt, inArray, isNull, like, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, rateLimits, users } from "@/lib/db/schema";
import { brandedMail, sendMail } from "@/lib/security/mailer";
import { tryConsume } from "@/lib/security/rate-limit";
import { siteUrl } from "@/lib/security/site";
import { cutPlain, escapeTelegramHtml, isTelegramEnabled, sendTelegramEx } from "@/lib/telegram";
import { appUrl } from "@/lib/telegram-bot/app-url";
import { L, type BotLang } from "@/lib/telegram-bot/lang";
import { uid } from "@/lib/utils";

/**
 * Bildirishnoma turlari (UI'da ikonka/rang tanlash uchun). Matn har doim o'zbekcha.
 *  order_new        — mutaxassisga: yangi buyurtma keldi
 *  order_amount     — mijozga: narx belgilandi, to'lash mumkin
 *  order_paid       — mutaxassisga: mijoz to'ladi (eskrou)
 *  order_done       — mijozga: ish yakunlandi, qabul qiling
 *  order_released   — mutaxassisga: mijoz qabul qildi, pul balansga tushdi
 *  order_cancelled  — qarshi tomonga: bekor qilindi / rad etildi (sabab bilan)
 *  payment_pending  — adminga: qo'lda o'tkazma tasdiqlashni kutmoqda
 *  payment_refunded — mijozga: pul qaytarildi
 *  payment_cancelled — mijozga: «To'ladim» deb bildirilgan o'tkazma admin tomonidan tasdiqlanmadi
 *  payout           — mutaxassisga: pul chiqarish qarori
 *  payout_requested — adminga: yangi pul chiqarish so'rovi
 *  refund_needed    — adminga: bekor qilingan to'langan buyurtma / provayder qaytarish so'rovi
 *  dispute          — tomonlarga/adminga: nizo ochildi yoki hal qilindi
 *  report           — adminga: shikoyat keldi
 *  account          — foydalanuvchiga: hisob holati (bloklash, 2FA yoqildi/o'chirildi va h.k.)
 *  dispute_opened / dispute_resolved — nizo (eski "dispute" ham qo'llab-quvvatlanadi)
 *  proposal_new / proposal_accepted / proposal_declined / proposal_shortlisted — e'lon takliflari
 *  job_new / job_closed / job_expired / saved_search — e'lonlar va saqlangan qidiruvlar
 *  message_new      — buyurtma chatida yangi xabar (email: buyurtma bo'yicha 30 daqiqada ko'pi bilan 1 ta)
 *  order_due / order_sla — muddat eslatmalari
 *  review_new       — mutaxassisga: yangi sharh
 *  subscription_expiring / subscription_expired / subscription_paid / subscription_pending — obuna
 *  broadcast        — admin paneldan barcha (yoki rolga ko'ra) foydalanuvchilarga ommaviy e'lon/eslatma
 *  group_request / group_joined / post_comment / follow — jamoalar (qo'shilish so'rovi, tasdiq, izoh, yangi obunachi)
 *  post_like / mention — postga reaksiya (❤️🔥👏…; 24 soatda bir marta har bir odamdan) va @username eslatma (post yoki izohda)
 *  digest           — kunlik/haftalik jamlama (lib/digest.ts). Guruhga kirmaydi: uni o'chirish yo'li — users.digest_freq='off'
 */
export type NotificationType =
  | "order_new"
  | "order_amount"
  | "order_paid"
  | "order_done"
  | "order_released"
  | "order_cancelled"
  | "payment_pending"
  | "payment_refunded"
  | "payment_cancelled"
  | "payout"
  | "payout_requested"
  | "refund_needed"
  | "dispute"
  | "report"
  | "account"
  | "dispute_opened"
  | "dispute_resolved"
  | "proposal_new"
  | "proposal_accepted"
  | "proposal_declined"
  | "proposal_shortlisted"
  | "job_new"
  | "job_closed"
  | "job_expired"
  | "saved_search"
  | "message_new"
  | "chat"
  | "order_due"
  | "order_sla"
  | "review_new"
  | "subscription_expiring"
  | "subscription_expired"
  | "subscription_paid"
  | "subscription_pending"
  | "broadcast"
  | "group_request"
  | "channel_post"
  | "live_event"
  | "application_new"
  | "application_status"
  | "vacancy_expiring"
  | "profile_post"
  | "group_joined"
  | "post_comment"
  | "post_like"
  | "mention"
  | "follow"
  | "top_award"
  | "digest";

/** Email ham yuboriladigan muhim hodisalar (foydalanuvchi notifyEmail=true bo'lsa) */
const MAIL_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "order_new",
  "order_amount",
  "order_paid",
  "order_done",
  "order_released",
  "order_cancelled",
  "payment_refunded",
  "payment_cancelled",
  "payout",
  "dispute",
  "dispute_opened",
  "dispute_resolved",
  "account",
  "proposal_new",
  "proposal_accepted",
  "job_expired",
  "vacancy_expiring",
  "message_new",
  // Ichki chat (DM, #46): yangi xabar emaili — mavzu "Yangi xabar — {ism}", havola /kabinet/chat
  // (dm.ts sendDm shu sarlavha/havola bilan chaqiradi; qarshi tomonda o'qilmagan xabar bo'lsa yubormaydi)
  "chat",
  "subscription_expiring",
  "subscription_expired",
  "subscription_paid",
  // Jamlama: foydalanuvchi o'zi yoqqan (digest_freq) — email ham ketadi (notifyEmail=true bo'lsa)
  "digest",
]);

/** message_new / chat emaili: bitta buyurtma/suhbat bo'yicha 30 daqiqada ko'pi bilan bitta xat */
const MESSAGE_MAIL_WINDOW_MS = 30 * 60 * 1000;
/** O'chirilgan (anonimlashtirilgan) hisob manzili — hech qachon xat yuborilmaydi */
const DELETED_EMAIL_RE = /^deleted-.*@redince\.invalid$/i;

/** Havolani mutlaq URLga aylantirish: tashqi https:// bo'lsa o'zi, /yo'l bo'lsa sayt manzili qo'shiladi */
function absoluteHref(origin: string | null | undefined, href: string | null | undefined): string | null {
  if (!href) return null;
  if (href.startsWith("https://")) return href;
  return origin && href.startsWith("/") && !href.startsWith("//") ? `${origin}${href}` : null;
}

export interface NotifyOptions {
  /** message_new emaili/Telegram xabari uchun cheklov kaliti (odatda orderId). Berilmasa href ishlatiladi */
  mailKey?: string;
  /**
   * Faqat EMAIL yuborilmaydi — Telegram va push avvalgidek ketadi (2026-11-10 tuzatildi: ilgari bu bayroq butun tashqi
   * fan-out'ni to'xtatib, «sayt + Telegram» deb mo'ljallangan xabarlar Telegramga umuman bormasdi).
   */
  skipMail?: boolean;
  /**
   * FAQAT saytdagi bildirishnoma: email ham, Telegram ham, push ham chiqmaydi. Chaqiruvchi Telegram xabarini O'ZI
   * (tugmalar bilan) yuboradigan joylar uchun — aks holda admin bitta hodisa haqida ikki marta xabar oladi.
   */
  siteOnly?: boolean;
  /** MAIL_TYPES'da bo'lmagan tur uchun ham email yuborish (masalan, admin ommaviy e'loni "email bilan" rejimida) */
  forceMail?: boolean;
  /**
   * Telegram kanalini o'tkazib yuborish (email va push ketadi): chaqiruvchi Telegramga `deliverTelegramNotification`
   * bilan o'zi yuboradi va natijani sanaydi (ommaviy e'lon — haqiqiy yetkazilgan son uchun).
   */
  skipTelegram?: boolean;
  /** Yangi buyurtma bildirishnomasi: «Qabul qilish / Rad etish» tugmalari shu buyurtmaga bog'lanadi (berilmasa href'dan olinadi) */
  orderId?: string;
}

/** Email havolasi uchun sayt manzili: sozlamadagi kanonik manzil, dev'da — lokal server */
function mailOrigin(): string | null {
  const configured = siteUrl();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return `http://localhost:${process.env.PORT || 3000}`;
  return null;
}

/**
 * Muhim hodisa uchun email (Resend sozlanmagan bo'lsa dev'da konsolga): sarlavha = bildirishnoma sarlavhasi,
 * matn + mutlaq havola. notifyEmail=false, o'chirilgan (deleted-*@redince.invalid) yoki bloklangan hisobga
 * yuborilmaydi (bloklash haqidagi "account" xabaridan tashqari).
 */
async function mailNotification(userId: string, type: NotificationType, title: string, body: string | null | undefined, href: string | null | undefined, opts: NotifyOptions): Promise<void> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { email: true, name: true, notifyEmail: true, isBanned: true, lang: true } });
  if (!u || !u.notifyEmail || !u.email || DELETED_EMAIL_RE.test(u.email)) return;
  if (u.isBanned && type !== "account") return;
  if (type === "message_new" || type === "chat") {
    const key = opts.mailKey ?? href ?? "general";
    if (!(await tryConsume(`mailMsg:${userId}:${key}`.slice(0, 200), MESSAGE_MAIL_WINDOW_MS))) return;
  }
  const origin = mailOrigin();
  const link = absoluteHref(origin, href);
  const lang = u.lang === "ru" ? "ru" : "uz";
  const footer = MAIL_FOOTER[lang];
  // Rus tilidagi foydalanuvchiga sarlavha/matn ruscha (lug'at → baza keshi → AI); foydalanuvchi matni (ism, iqtibos) qo'shilgan uzun matn lug'atda bo'lmaydi va o'zgarmaydi
  const t = lang === "ru" ? await localizeNotification(title, body) : { title, body };
  await sendMail(brandedMail({ to: u.email, title: t.title, name: u.name, body: t.body, link, footer, lang }));
}

/** Email pastki izohi — aniq {uz, ru} juftligi (avto-tarjima emas) */
const MAIL_FOOTER = {
  uz: "Email bildirishnomalarni Kabinet → Profil → «Email bildirishnomalar» orqali o'chirishingiz mumkin.",
  ru: "Отключить email-уведомления можно в Кабинет → Профиль → «Email-уведомления».",
} as const;

/** Bildirishnoma matnidagi bo'lak ajratgichlari: «Sarlavha: nom», «Sarlavha — nom», «a · b», gaplar va qatorlar */
const PART_SEP = /(: | — | · |\. |\n)/;

/**
 * Butun matn tarjimasi topilmaganda — BO'LAKLAB lug'atdan: `Yangi buyurtma: <nom>` → `Новый заказ: <nom>`,
 * `… Qabul qiling va narx belgilang.` → `… Примите заказ и назначьте цену.` Faqat lug'atda ANIQ bor bo'laklar almashadi
 * (foydalanuvchi matni — ism, sarlavha — o'zgarishsiz qoladi); AI'ga hech narsa yuborilmaydi. Hech biri topilmasa — asl matn.
 */
function localizeParts(s: string, lookup: (x: string) => string | null): string {
  const parts = s.split(PART_SEP);
  if (parts.length < 3) return s;
  let hit = false;
  const out = parts.map((p, i) => {
    if (i % 2 === 1) return p; // ajratgichning o'zi
    const core = p.trim();
    if (core.length < 3) return p;
    const end = /[.!]$/.test(core) ? core.slice(-1) : "";
    const ru = lookup(core) ?? (end ? lookup(core.slice(0, -1)) : null);
    if (!ru) return p;
    hit = true;
    return p.replace(core, end && !/[.!]$/.test(ru) ? ru + end : ru);
  });
  return hit ? out.join("") : s;
}

/**
 * Bildirishnoma sarlavhasi/matnini ruschaga o'girish (users.lang = ru): `translateUiBatch` — faqat qisqa o'zbekcha UI iboralari
 * (≤160 belgi, `looksUzbek`: lug'at → baza keshi → AI); butun matn topilmasa — bo'laklab lug'atdan (`localizeParts`: dinamik
 * sarlavhalarning doimiy qismi). Topilmagani yoki foydalanuvchi matni o'zgarishsiz qoladi. Xato — asl matn.
 */
export async function localizeNotification(title: string, body: string | null | undefined): Promise<{ title: string; body: string | null | undefined }> {
  try {
    const { translateUiBatch } = await import("@/lib/i18n/translate-service");
    const { normalizeUz, lookupRu } = await import("@/lib/i18n/auto");
    const map = await translateUiBatch([title, ...(body ? [body] : [])]);
    const pick = (s: string) => map[normalizeUz(s)] ?? localizeParts(s, lookupRu);
    return { title: pick(title), body: body ? pick(body) : body };
  } catch {
    return { title, body };
  }
}

/**
 * Telegram xabari: foydalanuvchi hisobini botga ulagan bo'lsa (users.telegramChatId) bildirishnoma qisqa
 * ko'rinishda Telegramga ham boradi. Ulanganlikning o'zi rozilik — alohida opt-out yo'q (uzish: karta yoki /stop).
 * Email'dan farqli, barcha turlar yuboriladi (eslatmalar ham foydali); bloklangan hisobga faqat "account".
 * message_new / chat uchun email bilan bir xil 30 daqiqalik cheklov — alohida kalit (emailga xalal bermaydi).
 */
/** Telegram inline tugma yorlig'i — bildirishnoma turiga mos (foydalanuvchi nima ochilishini oldindan biladi): [uz, ru] */
type Pair = readonly [uz: string, ru: string];
const TG_BUTTON_LABEL: Partial<Record<NotificationType, Pair>> = {
  message_new: ["Xabarni ochish", "Открыть сообщение"],
  chat: ["Xabarni ochish", "Открыть сообщение"],
  proposal_new: ["Taklifni ko'rish", "Посмотреть отклик"],
  proposal_accepted: ["Buyurtmani ochish", "Открыть заказ"],
  proposal_declined: ["E'lonni ochish", "Открыть объявление"],
  proposal_shortlisted: ["E'lonni ochish", "Открыть объявление"],
  job_new: ["E'lonni ochish", "Открыть объявление"],
  job_closed: ["E'lonni ochish", "Открыть объявление"],
  job_expired: ["E'lonni uzaytirish", "Продлить объявление"],
  saved_search: ["Natijalarni ko'rish", "Посмотреть результаты"],
  payout: ["Balansni ochish", "Открыть баланс"],
  payout_requested: ["So'rovni ko'rish", "Посмотреть запрос"],
  refund_needed: ["To'lovni ko'rish", "Посмотреть платёж"],
  payment_pending: ["To'lovni ko'rish", "Посмотреть платёж"],
  payment_refunded: ["To'lovni ko'rish", "Посмотреть платёж"],
  payment_cancelled: ["To'lovni ko'rish", "Посмотреть платёж"],
  dispute: ["Nizoni ko'rish", "Посмотреть спор"],
  dispute_opened: ["Nizoni ko'rish", "Посмотреть спор"],
  dispute_resolved: ["Qarorni ko'rish", "Посмотреть решение"],
  report: ["Shikoyatni ko'rish", "Посмотреть жалобу"],
  review_new: ["Sharhni ko'rish", "Посмотреть отзыв"],
  subscription_expiring: ["Obunani uzaytirish", "Продлить подписку"],
  subscription_expired: ["Obunani uzaytirish", "Продлить подписку"],
  subscription_paid: ["Obunani ko'rish", "Открыть подписку"],
  subscription_pending: ["Hisobni ko'rish", "Посмотреть счёт"],
  group_request: ["So'rovni ko'rish", "Посмотреть запрос"],
  channel_post: ["Postni ochish", "Открыть пост"],
  live_event: ["Efirga qo'shilish", "Присоединиться к эфиру"],
  application_new: ["Arizani ko'rish", "Посмотреть отклик"],
  application_status: ["Arizani ko'rish", "Посмотреть отклик"],
  vacancy_expiring: ["Vakansiyani uzaytirish", "Продлить вакансию"],
  broadcast: ["Batafsil", "Подробнее"],
  account: ["Kabinetni ochish", "Открыть кабинет"],
  digest: ["Kabinetni ochish", "Открыть кабинет"],
};

/**
 * Umumiy turlar (`subscription_paid`, `account` …) juda ko'p hodisaga ishlatiladi — sertifikat, kurs sotuvi, kontakt…
 * Ularda tugma yorlig'i HAVOLAGA qarab tanlanadi (aks holda sertifikat xabari ostida «Obunani ko'rish» chiqardi).
 */
const HREF_LABEL: readonly (readonly [RegExp, Pair])[] = [
  [/^\/sertifikat\//, ["Sertifikatni ochish", "Открыть сертификат"]],
  [/^\/mentorlik\/dars\//, ["Darsni ochish", "Открыть урок"]],
  [/^\/mentorlik\/konsultatsiya\//, ["Konsultatsiyani ochish", "Открыть консультацию"]],
  [/^\/kabinet\/mentorlik\/vazifalar/, ["Vazifalarni ko'rish", "Посмотреть задания"]],
  [/^\/kabinet\/mentorlik\/daromad/, ["Daromadni ko'rish", "Посмотреть доход"]],
  [/^\/kabinet\/mentorlik/, ["Mentorlikni ochish", "Открыть наставничество"]],
  [/^\/mentorlik/, ["Kursni ochish", "Открыть курс"]],
  [/^\/kabinet\/kontaktlar/, ["Kontaktlarni ko'rish", "Посмотреть контакты"]],
  [/^\/kabinet\/obuna/, ["Obunani ko'rish", "Открыть подписку"]],
  [/^\/kabinet\/xavfsizlik/, ["Xavfsizlik bo'limini ochish", "Открыть раздел безопасности"]],
  [/^\/kabinet\/story-javoblar/, ["Javoblarni ko'rish", "Посмотреть ответы"]],
  [/^\/kabinet\/tolovlar/, ["Balansni ochish", "Открыть баланс"]],
  [/^\/mutaxassislar\/[^?#]+\?(?:.*&)?post=/, ["Postni ochish", "Открыть пост"]],
  [/^\/mutaxassislar\//, ["Profilni ochish", "Открыть профиль"]],
  [/^\/jamoalar\//, ["Jamoani ochish", "Открыть сообщество"]],
  [/^\/efir\//, ["Efirga qo'shilish", "Присоединиться к эфиру"]],
  [/^\/konkurs/, ["Konkursni ochish", "Открыть конкурс"]],
  [/^\/savollar/, ["Savolni ochish", "Открыть вопрос"]],
  [/^\/top/, ["Reytingni ko'rish", "Открыть рейтинг"]],
  [/^\/admin/, ["Admin panelni ochish", "Открыть админ-панель"]],
];
const GENERIC_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>(["subscription_paid", "account", "post_comment", "post_like", "mention", "group_joined", "profile_post", "follow", "top_award", "broadcast"]);

function buttonLabel(type: NotificationType, href: string | null | undefined, lang: BotLang): string {
  const pick = (p: Pair) => L(lang, p[0], p[1]);
  if (href?.startsWith("https://")) return type === "live_event" ? L(lang, "Efirga qo'shilish", "Присоединиться к эфиру") : L(lang, "Havolani ochish", "Открыть ссылку");
  const byType = TG_BUTTON_LABEL[type];
  const byHref = href ? HREF_LABEL.find(([re]) => re.test(href))?.[1] : undefined;
  const chosen = GENERIC_TYPES.has(type) ? (byHref ?? byType) : (byType ?? byHref);
  if (chosen) return pick(chosen);
  return type.startsWith("order_") ? L(lang, "Buyurtmani ochish", "Открыть заказ") : L(lang, "Saytda ochish", "Открыть на сайте");
}

/** Buyurtma id'si: `/buyurtma/<id>` yoki kabinet havolasi `/kabinet/buyurtmalar?id=<id>` (orderHref shuni qaytaradi) */
export function orderIdFromHref(href: string | null | undefined): string | undefined {
  if (!href) return undefined;
  return /\/buyurtma\/([\w-]{1,64})/.exec(href)?.[1] ?? (/^\/kabinet\/buyurtmalar/.test(href) ? /[?&]id=([\w-]{1,64})/.exec(href)?.[1] : undefined);
}

/** Telegramga yetkazish natijasi: `none` — yuborilmadi (chat ulanmagan, o'chirilgan, cheklov), `blocked` — foydalanuvchi botni bloklagan */
export type TelegramDelivery = "sent" | "none" | "blocked" | "failed";

/**
 * Bitta bildirishnomani foydalanuvchining Telegramiga yetkazish (til: `users.lang`; ruscha — `localizeNotification`).
 * `notify()` fan-out'i va ommaviy e'lon (`lib/broadcast.ts` — natijani sanaydi) shu funksiyadan foydalanadi.
 * Yuborish «ommaviy» qatorda (`bulk`) ketadi: navbat ~25 xabar/s, 429'da `retry_after` kutiladi, bloklagan chatga urinilmaydi.
 */
export async function deliverTelegramNotification(userId: string, type: NotificationType, title: string, body: string | null | undefined, href: string | null | undefined, opts: NotifyOptions = {}): Promise<TelegramDelivery> {
  if (!isTelegramEnabled()) return "none";
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { telegramChatId: true, isBanned: true, lang: true } });
  if (!u?.telegramChatId) return "none";
  if (u.isBanned && type !== "account") return "none";
  if (type === "message_new" || type === "chat") {
    const key = opts.mailKey ?? href ?? "general";
    if (!(await tryConsume(`tgMsg:${userId}:${key}`.slice(0, 200), MESSAGE_MAIL_WINDOW_MS))) return "none";
  }
  const chat = u.telegramChatId;
  const lang: BotLang = u.lang === "ru" ? "ru" : "uz";
  const origin = mailOrigin();
  const link = absoluteHref(origin, href);
  const done = (r: { ok: boolean; blocked?: boolean }): TelegramDelivery => (r.ok ? "sent" : r.blocked ? "blocked" : "failed");

  // Yangi ariza ish beruvchiga: oddiy xabar o'rniga NOMZOD KARTASI (moslik balli, rezyume, xat parchasi) va
  // «Tanlovga olish / Rad etish» tugmalari — lib/telegram-bot/applications.ts. Karta tuzilmasa oddiy xabar ketadi.
  if (type === "application_new") {
    const vacancyId = /[?&]v=([\w-]{1,64})/.exec(href ?? "")?.[1];
    if (vacancyId) {
      try {
        const { applicationCardFor } = await import("@/lib/telegram-bot/applications");
        const card = await applicationCardFor(vacancyId, userId, lang);
        if (card) return done(await sendTelegramEx(chat, card.text, { keyboard: card.keyboard, bulk: true }));
      } catch (e) {
        console.error("[notify:tg] ariza kartasi", e instanceof Error ? e.message : e);
      }
    }
  }

  // Rus tilidagi foydalanuvchiga sarlavha/matn ruscha (email bilan bir xil yo'l: lug'at → baza keshi → AI)
  const t = lang === "ru" ? await localizeNotification(title, body) : { title, body };
  const text = `<b>${escapeTelegramHtml(t.title)}</b>` + (t.body ? `\n${escapeTelegramHtml(t.body)}` : "");

  // Yangi buyurtma mutaxassisga: xabar ostida «Qabul qilish / Rad etish» tugmalari (botda bir bosishda)
  const orderId = type === "order_new" ? (opts.orderId ?? orderIdFromHref(href)) : undefined;
  if (orderId) {
    const kb = await orderActionButtons(orderId, userId, link, lang);
    if (kb) return done(await sendTelegramEx(chat, text, { keyboard: kb, bulk: true }));
  }

  const keyboard: { text: string; url?: string; data?: string; webApp?: string }[][] = [];
  // Yalang'och URL o'rniga xabar ostida tugma — turga/havolaga mos yorliq bilan
  if (link) keyboard.push([telegramOpenButton(buttonLabel(type, href, lang), href ?? null, link)]);
  // Shaxsiy xabar: saytni ochmasdan shu chatning o'zidan javob yozish (lib/telegram-bot/dm.ts — `dm:r:<suhbat>`)
  if (type === "chat") {
    const convId = /^\/kabinet\/chat\?(?:.*&)?s=([\w-]{1,64})/.exec(href ?? "")?.[1];
    if (convId) keyboard.unshift([{ text: L(lang, "✍️ Javob yozish", "✍️ Ответить"), data: `dm:r:${convId}` }, { text: L(lang, "💬 Suhbatni ko'rish", "💬 Показать переписку"), data: `dm:o:${convId}` }]);
  }
  return done(await sendTelegramEx(chat, text, { ...(keyboard.length ? { keyboard } : {}), bulk: true }));
}

/**
 * Bildirishnoma tugmasi: ichki havola bo'lsa Mini App (Telegram ichida, avtomatik kirish — `lib/telegram-bot/ui.ts appUrl`),
 * tashqi https yoki Mini App mavjud bo'lmasa (dev, http) — oddiy URL.
 */
export function telegramOpenButton(text: string, href: string | null, link: string): { text: string; url?: string; webApp?: string } {
  if (href && href.startsWith("/") && !href.startsWith("//")) {
    const app = appUrl(href);
    if (app) return { text, webApp: app };
  }
  return { text, url: link };
}

/**
 * Yangi buyurtma bildirishnomasi mutaxassisga ketayotgan bo'lsa, botda tezkor tugmalar beramiz.
 * Faqat `new` holatidagi va AYNAN shu mutaxassisning buyurtmasi uchun (mijozga oddiy havola ketadi).
 */
async function orderActionButtons(orderId: string, recipientId: string, link: string | null, lang: BotLang) {
  try {
    const { orders, specialists } = await import("@/lib/db/schema");
    const row = await db
      .select({ status: orders.status, spUserId: specialists.userId })
      .from(orders)
      .innerJoin(specialists, eq(specialists.id, orders.specialistId))
      .where(eq(orders.id, orderId))
      .limit(1);
    if (row[0]?.status !== "new" || row[0]?.spUserId !== recipientId) return null;
    const { orderButtons } = await import("@/lib/telegram-bot/actions");
    return orderButtons(orderId, link, lang);
  } catch {
    return null;
  }
}

/** Darhol ko'rinishi kerak bo'lgan turlar — push `urgency: high` bilan ketadi (telefon uyg'onadi) */
const PUSH_URGENT: ReadonlySet<NotificationType> = new Set<NotificationType>(["chat", "message_new", "live_event", "order_new", "order_paid", "dispute", "dispute_opened"]);

/**
 * Brauzer push bildirishnomasi (Web Push / VAPID). VAPID kalitlari sozlanmagan bo'lsa
 * yoki qurilma obunasi yo'q bo'lsa jim o'tadi. Bloklangan foydalanuvchiga faqat `account`.
 */
async function pushNotification(userId: string, type: NotificationType, title: string, body: string | null | undefined, href: string | null | undefined): Promise<void> {
  const { isPushEnabled } = await import("@/lib/push/web-push");
  if (!isPushEnabled()) return;
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { isBanned: true } });
  if (u?.isBanned && type !== "account") return;
  const { pushToUser } = await import("@/lib/push/service");
  await pushToUser(userId, { title, body, href: href ?? "/kabinet/bildirishnomalar", tag: type, urgency: PUSH_URGENT.has(type) ? "high" : "normal" });
}

/** Javobdan keyin bajarish (Next after()); so'rov kontekstidan tashqarida — oddiy fon promise */
function inBackground(task: () => Promise<void>): void {
  const run = () => task().catch((e) => console.error("[notify:mail]", e));
  try {
    after(run);
  } catch {
    void run();
  }
}

/**
 * Foydalanuvchiga bildirishnoma yozish. Hech qachon xato tashlamaydi —
 * buyurtma/to'lov oqimini bildirishnoma xatosi buzmasin. Muhim turlar uchun email fon rejimida
 * (javobni kutmasdan) yuboriladi.
 */
/**
 * Chat xabarlari (DM va buyurtma chati) SAYT bildirishnomalari ro'yxatiga YOZILMAYDI (2026-10-31, foydalanuvchi qarori):
 * o'qilmagan xabarlar soni «Xabarlar» bandida ko'rinadi, qo'ng'iroqcha faqat boshqa hodisalar uchun.
 * Telegram/push/email kanallari bu turlar uchun avvalgidek ishlaydi (qurilmaga keladi).
 */
const SITE_SKIP_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>(["chat", "message_new"]);

/** Suhbat o'qilganda eski (shu o'zgarishgacha yozilgan) chat bildirishnomalarini o'qilgan deb belgilash */
export async function markChatNotificationsRead(userId: string, hrefPrefix: string): Promise<void> {
  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), inArray(notifications.type, ["chat", "message_new"]), like(notifications.href, `${hrefPrefix}%`)));
  } catch (e) {
    console.error("[notify] markChatRead", e);
  }
}

/**
 * Foydalanuvchi suhbatni BOTDA o'qidi yoki botdan javob yozdi — shu suhbat bo'yicha Telegram cheklovi (30 daqiqada bitta xabar)
 * bo'shatiladi: suhbatdoshning keyingi xabari yana Telegramga keladi. Aks holda botdagi ikki tomonlama yozishma uzilib qolardi
 * (javob yozdingiz, suhbatdosh 2 daqiqada javob berdi — Telegramga hech narsa kelmaydi). Saytda o'qilganda cheklov SAQLANADI —
 * saytda jonli yozishayotgan odamga har xabar Telegramga ham kelib turmasin. `href` — bildirishnoma havolasi (`/kabinet/chat?s=<id>`).
 */
export async function rearmChatPing(userId: string, href: string): Promise<void> {
  try {
    await db.delete(rateLimits).where(eq(rateLimits.key, `tgMsg:${userId}:${href}`.slice(0, 200)));
  } catch {
    /* cheklov o'z muddatida tugaydi */
  }
}

export async function notify(userId: string, type: NotificationType, title: string, body?: string | null, href?: string | null, opts: NotifyOptions = {}): Promise<void> {
  // Kabinet sozlamalari (users.notifyPrefs): guruh o'chirilgan bo'lsa — na saytda, na emailda, na Telegramda (xavfsizlik turlari bundan mustasno)
  if (!(await isNotifyAllowed(userId, type))) return;
  if (SITE_SKIP_TYPES.has(type)) {
    /* chat — faqat tashqi kanallar */
  } else
  try {
    await db.insert(notifications).values({
      id: uid(),
      userId,
      type,
      title: cutPlain(title, 160),
      body: body ? cutPlain(body, 600) : null,
      href: href ?? null,
    });
  } catch (e) {
    console.error("[notify]", type, e);
  }
  // `siteOnly` — faqat sayt qo'ng'irog'i (chaqiruvchi Telegram xabarini o'zi yuboradi). `skipMail` esa FAQAT emailni o'chiradi.
  if (opts.siteOnly) return;
  const t = cutPlain(title, 160);
  const b = body ? cutPlain(body, 600) : body;
  const wantMail = !opts.skipMail && (MAIL_TYPES.has(type) || Boolean(opts.forceMail));
  try {
    // Email (faqat MAIL_TYPES), Telegram va push parallel — biri yiqilsa qolganlari baribir yuboriladi
    inBackground(async () => {
      const results = await Promise.allSettled([
        wantMail ? mailNotification(userId, type, t, b, href, opts) : Promise.resolve(),
        opts.skipTelegram ? Promise.resolve() : deliverTelegramNotification(userId, type, t, b, href, opts),
        pushNotification(userId, type, t, b, href),
      ]);
      for (const r of results) if (r.status === "rejected") console.error("[notify:fanout]", type, r.reason);
    });
  } catch (e) {
    console.error("[notify:fanout]", type, e);
  }
}

/**
 * Barcha adminlarga bir xil bildirishnoma (qo'lda to'lov, qaytarish, payout so'rovi).
 * `dedupeMs` berilsa, shu muddat ichida bir xil (tur + sarlavha + matn) xabar bo'lsa qayta yozilmaydi —
 * provayder takroriy chaqiruvlari (masalan Payme CancelTransaction) adminni xabar bilan to'ldirmasin.
 */
export async function notifyAdmins(type: NotificationType, title: string, body?: string | null, href?: string | null, opts: { dedupeMs?: number; skipMail?: boolean; siteOnly?: boolean } = {}): Promise<void> {
  try {
    if (opts.dedupeMs) {
      const dup = await db.query.notifications.findFirst({
        where: and(eq(notifications.type, type), eq(notifications.title, cutPlain(title, 160)), gt(notifications.createdAt, new Date(Date.now() - opts.dedupeMs))),
        columns: { id: true },
      });
      if (dup) return;
    }
    const admins = await db.query.users.findMany({ where: eq(users.role, "admin"), columns: { id: true } });
    // `skipMail` — emailsiz (sayt + Telegram + push); `siteOnly` — faqat sayt (chaqiruvchi Telegramga o'zi tugmali xabar yuboradi)
    const pass: NotifyOptions = { ...(opts.skipMail ? { skipMail: true } : {}), ...(opts.siteOnly ? { siteOnly: true } : {}) };
    await Promise.all(admins.map((a) => notify(a.id, type, title, body, href, pass)));
  } catch (e) {
    console.error("[notifyAdmins]", type, e);
  }
}

/** O'qilmaganlar birinchi, keyin yangilari — 20 ta */
export async function listNotifications(userId: string, limit = 20) {
  const [rows, [{ unread }]] = await Promise.all([
    db.query.notifications.findMany({
      where: eq(notifications.userId, userId),
      orderBy: [sql`case when ${notifications.readAt} is null then 0 else 1 end`, desc(notifications.createdAt)],
      limit,
    }),
    db
      .select({ unread: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);
  return { items: rows, unread: Number(unread) };
}

/** Belgilangan (yoki hammasini) o'qilgan deb belgilash — faqat o'z yozuvlari */
export async function markNotificationsRead(userId: string, ids?: string[]): Promise<number> {
  const where = ids && ids.length ? and(eq(notifications.userId, userId), isNull(notifications.readAt), inArray(notifications.id, ids)) : and(eq(notifications.userId, userId), isNull(notifications.readAt));
  const res = await db.update(notifications).set({ readAt: new Date() }).where(where);
  return res.rowsAffected;
}

/* ------------------------------------------------------------------ */
/* Bildirishnoma sozlamalari (kabinet): guruhlar va tozalash            */
/* ------------------------------------------------------------------ */

/**
 * Bildirishnoma guruhlari (Kabinet → Bildirishnomalar → Sozlamalar). Foydalanuvchi guruhni o'chirsa (users.notifyPrefs[key] = false)
 * shu turlar umuman yozilmaydi. ALWAYS_NOTIFY turlari (hisob xavfsizligi, nizo, to'lov holati) hech qachon o'chirilmaydi.
 */
export const NOTIFY_GROUPS = {
  orders: ["order_new", "order_amount", "order_paid", "order_done", "order_released", "order_cancelled", "order_due", "order_sla", "payment_pending", "payout", "payout_requested", "refund_needed", "review_new"],
  jobs: ["proposal_new", "proposal_accepted", "proposal_declined", "proposal_shortlisted", "job_new", "job_closed", "job_expired", "saved_search", "application_new", "application_status", "vacancy_expiring"],
  social: ["follow", "post_like", "post_comment", "mention", "profile_post", "channel_post", "live_event", "group_request", "group_joined"],
  chat: ["message_new", "chat"],
  system: ["broadcast", "subscription_expiring", "subscription_expired", "subscription_paid", "subscription_pending"],
} as const satisfies Record<string, readonly NotificationType[]>;
export type NotifyGroupKey = keyof typeof NOTIFY_GROUPS;
export const NOTIFY_GROUP_KEYS = Object.keys(NOTIFY_GROUPS) as NotifyGroupKey[];

/** Guruh yorliqlari va izohlari (UI) */
export const NOTIFY_GROUP_META: Record<NotifyGroupKey, { label: string; hint: string }> = {
  orders: { label: "Buyurtmalar", hint: "Yangi buyurtma, narx, to'lov, topshirish, sharh" },
  jobs: { label: "E'lonlar va vakansiyalar", hint: "Takliflar, arizalar, saqlangan qidiruvlar" },
  social: { label: "Ijtimoiy", hint: "Obunachilar, reaksiya, izoh, eslatma, kanal postlari, efir" },
  chat: { label: "Xabarlar", hint: "Chat va buyurtma chatidagi yangi xabarlar" },
  system: { label: "Tizim", hint: "Obuna holati, ma'muriyat e'lonlari" },
};

/** Hech qachon o'chirilmaydigan turlar: hisob xavfsizligi, nizo va qaytarishlar, shikoyat (adminga) */
const ALWAYS_NOTIFY: ReadonlySet<NotificationType> = new Set<NotificationType>(["account", "dispute", "dispute_opened", "dispute_resolved", "payment_refunded", "payment_cancelled", "report"]);

/** Tur qaysi guruhga kiradi (ALWAYS_NOTIFY yoki noma'lum tur — null) */
export function notifyGroupOf(type: string): NotifyGroupKey | null {
  for (const k of NOTIFY_GROUP_KEYS) if ((NOTIFY_GROUPS[k] as readonly string[]).includes(type)) return k;
  return null;
}

/** Sozlamalar bo'yicha ruxsat (yo'q kalit = yoqilgan). Xato bo'lsa — ruxsat (bildirishnoma yo'qolmasin) */
export async function isNotifyAllowed(userId: string, type: NotificationType): Promise<boolean> {
  if (ALWAYS_NOTIFY.has(type)) return true;
  const group = notifyGroupOf(type);
  if (!group) return true;
  try {
    const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { notifyPrefs: true } });
    return (u?.notifyPrefs ?? {})[group] !== false;
  } catch {
    return true;
  }
}

/** Eski o'qilgan bildirishnomalarni o'chirish (faqat o'ziniki); `days` kundan eski o'qilganlar. Qaytaradi: o'chirilganlar soni */
export async function purgeReadNotifications(userId: string, days = 30): Promise<number> {
  const before = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const res = await db.delete(notifications).where(and(eq(notifications.userId, userId), sql`${notifications.readAt} is not null`, sql`${notifications.createdAt} < ${before.getTime()}`));
  return res.rowsAffected;
}

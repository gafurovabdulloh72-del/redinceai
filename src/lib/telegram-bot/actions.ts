import "server-only";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, specialists, users } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { escapeTelegramHtml, sendTelegram, telegramApi } from "@/lib/telegram";
import { decideLoginRequest, findLoginRequest } from "@/lib/auth/telegram-login";
import { siteUrl } from "@/lib/security/site";
import { formatPrice } from "@/lib/utils";
import { REGION_BY_SLUG } from "@/lib/constants";
import { NOTIFY_GROUP_KEYS, type NotifyGroupKey } from "@/lib/notifications";
import { SETTINGS_TEXT, SETTINGS_TEXT_RU, appUrl, sendNotLinked, settingsKeyboard } from "@/lib/telegram-bot/ui";
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

/** Chatga ulangan hisob (yo'q bo'lsa null) */
export async function accountOf(chatId: string) {
  return db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, name: true, role: true, isBanned: true, email: true, username: true, createdAt: true, notifyPrefs: true } });
}

const ROLE_LABEL: Record<string, string> = { client: "Mijoz", specialist: "Mutaxassis", admin: "Administrator" };
const ROLE_LABEL_RU: Record<string, string> = { client: "Клиент", specialist: "Специалист", admin: "Администратор" };

/* ------------------------------------------------------------------ */
/* «Telegram bilan kirish»                                             */
/* ------------------------------------------------------------------ */

/** `/start l_<kod>` — tasdiqlash tugmalarini ko'rsatadi */
export async function handleLoginStart(chatId: string, arg: string, who: { name?: string; username?: string }): Promise<boolean> {
  const m = /^l_(\d{6})$/.exec(arg);
  if (!m) return false;
  const req = await findLoginRequest(m[1]);
  if (!req) {
    await sendTelegram(chatId, "Kirish so'rovi topilmadi yoki eskirgan (5 daqiqa amal qiladi). Saytda «Telegram bilan kirish»ni qayta bosing.");
    return true;
  }
  const linked = await accountOf(chatId);
  if (!linked) {
    // Hisobsiz Telegram — avtomatik hisob OCHILMAYDI: savol-javob bilan ro'yxatdan o'tadi, so'ng kirish tasdiqlanadi
    const { startRegistration } = await import("@/lib/telegram-bot/register");
    await startRegistration(chatId, who, { loginCode: m[1] });
    return true;
  }
  const note = `Hisob: <b>${escapeTelegramHtml(linked.name)}</b>`;
  await sendTelegram(chatId, `<b>Saytga kirish so'rovi</b>\nKod: <code>${m[1]}</code>\n${note}\n\nAgar bu siz bo'lmasangiz «Yo'q» ni bosing.`, {
    keyboard: [
      [
        { text: "✅ Ha, kirish", data: `lg:ok:${m[1]}` },
        { text: "✖️ Yo'q", data: `lg:no:${m[1]}` },
      ],
    ],
  });
  void who;
  return true;
}

/** `lg:ok|no:<kod>` tugmasi */
export async function handleLoginCallback(chatId: string, data: string, answer: Answer, who: { name?: string; username?: string }): Promise<boolean> {
  const m = /^lg:(ok|no):(\d{6})$/.exec(data);
  if (!m) return false;
  if (m[1] === "ok" && !(await accountOf(chatId))) {
    await answer("");
    const { startRegistration } = await import("@/lib/telegram-bot/register");
    await startRegistration(chatId, who, { loginCode: m[2] });
    return true;
  }
  const okNow = await decideLoginRequest(m[2], chatId, m[1] === "ok", who);
  if (!okNow) {
    await answer("So'rov eskirgan — saytda qayta bosing");
    return true;
  }
  await answer(m[1] === "ok" ? "Tasdiqlandi — saytga qaytasiz" : "Rad etildi");
  await sendTelegram(chatId, m[1] === "ok" ? "✅ Kirish tasdiqlandi. Saytdagi oynaga qaytib qarang." : "Kirish rad etildi. Agar bu siz bo'lmasangiz, hech narsa qilish shart emas.");
  return true;
}

/* ------------------------------------------------------------------ */
/* Buyurtma: qabul qilish / rad etish                                  */
/* ------------------------------------------------------------------ */

/** Buyurtma tugmalari: xabar ostida «Qabul qilish» va «Rad etish» */
export function orderButtons(orderId: string, href: string, lang?: BotLang): { text: string; url?: string; data?: string; webApp?: string }[][] {
  const app = appUrl(`/buyurtma/${orderId}`);
  const open = L(lang, "Buyurtmani ochish", "Открыть заказ");
  return [
    [
      { text: L(lang, "✅ Qabul qilish", "✅ Принять"), data: `ord:ok:${orderId}` },
      { text: L(lang, "✖️ Rad etish", "✖️ Отклонить"), data: `ord:no:${orderId}` },
    ],
    [app ? { text: open, webApp: app } : { text: open, url: href }],
  ];
}

/** `ord:ok|no:<id>` — mutaxassis buyurtmani botda hal qiladi */
export async function handleOrderCallback(chatId: string, data: string, answer: Answer): Promise<boolean> {
  const m = /^ord:(ok|no):([\w-]{1,64})$/.exec(data);
  if (!m) return false;
  const me = await accountOf(chatId);
  if (!me || me.isBanned) {
    await answer("Avval hisobni ulang: saytda Kabinet → Profil");
    return true;
  }
  try {
    const { setOrderStatus } = await import("@/lib/telegram-bot/orders");
    const res = await setOrderStatus(m[2], me.id, m[1] === "ok");
    await answer(res);
    await sendTelegram(chatId, escapeTelegramHtml(res), { button: { text: "Buyurtmani ochish", url: `${siteUrl()}/buyurtma/${m[2]}` } });
  } catch (e) {
    await answer(e instanceof ApiError ? e.message : "Xatolik — saytdan bajaring");
  }
  return true;
}

/** `/buyurtmalarim` — ochiq buyurtmalar (mutaxassis uchun yangi buyurtmalar tugmalar bilan) */
export async function handleMyOrders(chatId: string, lang?: BotLang): Promise<void> {
  const me = await accountOf(chatId);
  if (!me) {
    await sendNotLinked(chatId, lang);
    return;
  }
  // Buyurtmada `specialistId` — specialists qatori; mutaxassis userId'si join bilan olinadi
  const rows = await db
    .select({ id: orders.id, title: orders.title, status: orders.status, amount: orders.amount, spUserId: specialists.userId })
    .from(orders)
    .innerJoin(specialists, eq(specialists.id, orders.specialistId))
    .where(and(or(eq(specialists.userId, me.id), eq(orders.clientId, me.id)), inArray(orders.status, ["new", "accepted", "in_progress"])))
    .orderBy(desc(orders.createdAt))
    .limit(8);
  if (!rows.length) {
    await sendTelegram(chatId, L(lang, "Ochiq buyurtma yo'q.", "Открытых заказов нет."), { button: { text: L(lang, "Buyurtmalarim", "Мои заказы"), url: `${siteUrl()}/kabinet/buyurtmalar` } });
    return;
  }
  const { STATUS_LABEL } = await import("@/lib/telegram-bot/orders");
  const { orderStatusLabel } = await import("@/lib/i18n/dict/kabinet-pages");
  for (const o of rows) {
    const mine = o.spUserId === me.id;
    const text = `<b>${escapeTelegramHtml(o.title)}</b>\n${escapeTelegramHtml(orderStatusLabel(lang ?? "uz", o.status, STATUS_LABEL[o.status] ?? o.status))}${o.amount ? ` · ${escapeTelegramHtml(formatPrice(o.amount))}` : ""}`;
    const href = `${siteUrl()}/buyurtma/${o.id}`;
    await sendTelegram(chatId, text, mine && o.status === "new" ? { keyboard: orderButtons(o.id, href, lang) } : { button: { text: L(lang, "Ochish", "Открыть"), url: href } });
  }
}

/* ------------------------------------------------------------------ */
/* Profil, xabarlar, vakansiyalar, sozlamalar                           */
/* ------------------------------------------------------------------ */

/** `/profil` — hisob kartasi */
export async function handleProfile(chatId: string, lang?: BotLang): Promise<void> {
  const me = await accountOf(chatId);
  if (!me) {
    await sendNotLinked(chatId, lang);
    return;
  }
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
    `${escapeTelegramHtml(me.email)} · ${L(lang, "ro'yxatdan", "с")} ${escapeTelegramHtml(since)}`,
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
  lines.push("", L(lang, "Telegram ulangan ✅ — buyurtma, xabar va kurs bildirishnomalari shu yerga keladi.", "Telegram привязан ✅ — уведомления о заказах, сообщениях и курсах приходят сюда."));
  const s = siteUrl() ?? "";
  const kb = (path: string, text: string) => (appUrl(path) ? { text, webApp: appUrl(path)! } : { text, url: `${s}${path}` });
  await sendTelegram(chatId, lines.join("\n"), {
    keyboard: [
      [kb("/kabinet", L(lang, "Kabinet", "Кабинет")), kb("/kabinet/profil", L(lang, "Profilni tahrirlash", "Редактировать профиль"))],
      [
        kb("/kabinet/kontaktlar", sp ? L(lang, "Kontaktimni olganlar", "Кто купил контакт") : L(lang, "Ochilgan kontaktlar", "Открытые контакты")),
        ...(sp ? [{ text: L(lang, "Ommaviy sahifam", "Моя страница"), url: `${s}/mutaxassislar/${sp.slug}` }] : [kb("/mutaxassislar", L(lang, "Mutaxassislar", "Специалисты"))]),
      ],
    ],
  });
}

/** `/xabarlar` — o'qilmagan DM soni */
export async function handleMessages(chatId: string, lang?: BotLang): Promise<void> {
  const me = await accountOf(chatId);
  if (!me) {
    await sendNotLinked(chatId, lang);
    return;
  }
  const { unreadDmCount } = await import("@/lib/chat/dm");
  const n = await unreadDmCount(me.id).catch(() => 0);
  const text = n > 0 ? L(lang, `💬 <b>${n} ta o'qilmagan xabar</b> bor.`, `💬 <b>Непрочитанных сообщений: ${n}</b>`) : L(lang, "💬 O'qilmagan xabar yo'q.", "💬 Непрочитанных сообщений нет.");
  await sendTelegram(chatId, text, { button: { text: n > 0 ? L(lang, "Xabarlarni o'qish", "Читать сообщения") : L(lang, "Chatni ochish", "Открыть чат"), url: `${siteUrl() ?? ""}/kabinet/chat` } });
}

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
    const where = v.regionSlug ? (REGION_BY_SLUG[v.regionSlug]?.name ?? v.regionSlug) : L(lang, "Masofaviy", "Удалённо");
    return `${i + 1}. <a href="${s}/vakansiyalar/${v.id}"><b>${escapeTelegramHtml(v.title)}</b></a>\n   ${escapeTelegramHtml(v.company)} · ${escapeTelegramHtml(professionLabelTr(til, v.profession, true))} · ${escapeTelegramHtml(where)}\n   ${escapeTelegramHtml(salaryLabelTr(til, v.salaryMin, v.salaryMax))}`;
  });
  await sendTelegram(chatId, `💼 <b>${L(lang, "So'nggi vakansiyalar", "Последние вакансии")}</b> (${L(lang, `${total} ta ochiq`, `открытых: ${total}`)})\n\n${lines.join("\n\n")}`, { button: { text: L(lang, "Barcha vakansiyalar", "Все вакансии"), url: `${s}/vakansiyalar` } });
}

/** `/sozlamalar` — bildirishnoma guruhlari switch'lari */
export async function handleSettings(chatId: string, lang?: BotLang): Promise<void> {
  const me = await accountOf(chatId);
  if (!me) {
    await sendNotLinked(chatId, lang);
    return;
  }
  await sendTelegram(chatId, L(lang, SETTINGS_TEXT, SETTINGS_TEXT_RU), { keyboard: settingsKeyboard(me.notifyPrefs ?? {}, lang) });
}

/** `st:<guruh>` — switch'ni almashtirib, klaviaturani joyida yangilaydi */
export async function handleSettingsCallback(chatId: string, data: string, answer: Answer, messageId: number | null, lang?: BotLang): Promise<boolean> {
  const m = /^st:([a-z]+)$/.exec(data);
  if (!m) return false;
  const key = m[1] as NotifyGroupKey;
  if (!NOTIFY_GROUP_KEYS.includes(key)) return false;
  const me = await accountOf(chatId);
  if (!me) {
    await answer(L(lang, "Avval hisobni ulang", "Сначала привяжите аккаунт"));
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

/** Ijodkor qidiruvi (bot va inline rejim umumiy): ism/sarlavha → bo'lmasa kasb+hudud bo'yicha katalog (o'zbekcha yoki ruscha so'zlar); bo'sh so'rov — eng yaxshilari */
export async function searchPeople(q: string, limit = 5): Promise<BotPerson[]> {
  const { exploreSearch } = await import("@/lib/search/service");
  const { CATEGORIES, REGIONS } = await import("@/lib/constants");
  const { listSpecialists } = await import("@/lib/queries");
  const { specialistFilterSchema } = await import("@/lib/validators");
  const fromCatalog = async (f: Record<string, unknown>) => {
    const r = await listSpecialists(specialistFilterSchema.parse({ ...f, limit }));
    return r.items.slice(0, limit).map((it) => ({ slug: it.slug, name: it.user.name, title: it.title ?? "", category: it.category, rating: it.rating, reviewCount: it.reviewCount, isVerified: Boolean(it.isVerified), avatarUrl: it.user.avatarUrl }));
  };
  if (q.length < 2) return fromCatalog({});
  const res = await exploreSearch(q, "people");
  let people: BotPerson[] = res.people.slice(0, limit);
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

/** Har ijodkorga kontakt narxi (daraja/maxsus) yoki null («faqat portfolio») — bot va inline natijalarida ko'rsatiladi */
async function withContactPrices(people: BotPerson[]): Promise<BotPerson[]> {
  if (!people.length) return people;
  const { contactPriceFor } = await import("@/lib/contacts/unlock");
  const { getSettings } = await import("@/lib/payments/settings");
  const [rows, settings] = await Promise.all([
    db.query.specialists.findMany({ where: inArray(specialists.slug, people.map((p) => p.slug)), columns: { slug: true, contactMode: true, experience: true, contactPrice: true } }),
    getSettings(),
  ]);
  const map = new Map(rows.map((r) => [r.slug, r]));
  return people.map((p) => {
    const r = map.get(p.slug);
    return { ...p, contactPrice: r ? (r.contactMode === "hidden" ? null : contactPriceFor(r, settings)) : undefined };
  });
}

/** `/kontaktlarim` — ochilgan kontaktlar to'g'ridan-to'g'ri chatda (telefon, Telegram, Instagram, email) */
export async function handleMyContacts(chatId: string, lang?: BotLang): Promise<void> {
  const me = await accountOf(chatId);
  if (!me) {
    await sendNotLinked(chatId, lang);
    return;
  }
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
  const { CATEGORY_BY_SLUG } = await import("@/lib/constants");
  const people = await searchPeople(q, 5);
  if (!people.length) {
    await sendTelegram(chatId, L(lang, `🔎 «${escapeTelegramHtml(q)}» bo'yicha ijodkor topilmadi.`, `🔎 По запросу «${escapeTelegramHtml(q)}» никого не нашлось.`), { button: { text: L(lang, "Katalogda qidirish", "Искать в каталоге"), url: `${s}/qidiruv?q=${encodeURIComponent(q)}` } });
    return;
  }
  const lines = people.map((p, i) => {
    const cat = CATEGORY_BY_SLUG[p.category]?.name ?? p.category;
    const contact = p.contactPrice === undefined ? "" : p.contactPrice === null ? L(lang, " · 🔒 faqat portfolio", " · 🔒 только портфолио") : ` · 🔓 ${L(lang, "kontakt", "контакт")} ${formatPrice(p.contactPrice, { compact: true })}`;
    return `${i + 1}. <a href="${s}/mutaxassislar/${p.slug}"><b>${escapeTelegramHtml(p.name)}</b></a>${p.isVerified ? " ✅" : ""}\n   ${escapeTelegramHtml(p.title || cat)} · ${stars(p.rating, lang)}${p.reviewCount ? ` (${p.reviewCount})` : ""}${contact}`;
  });
  const app = appUrl(`/qidiruv?q=${encodeURIComponent(q)}`);
  await sendTelegram(chatId, `${L(lang, `🔎 <b>«${escapeTelegramHtml(q)}»</b> bo'yicha ijodkorlar`, `🔎 Специалисты по запросу <b>«${escapeTelegramHtml(q)}»</b>`)}\n\n${lines.join("\n\n")}`, {
    keyboard: [[app ? { text: L(lang, "Hammasini ilovada ko'rish", "Все — в приложении"), webApp: app } : { text: L(lang, "Hammasini ko'rish", "Показать все"), url: `${s}/qidiruv?q=${encodeURIComponent(q)}` }]],
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
  await sendTelegram(chatId, `🎓 <b>${L(lang, "Mashhur kurslar", "Популярные курсы")}</b>\n\n${lines.join("\n\n")}`, {
    keyboard: [
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
    const href = it.mentorSlug ? `${s}/mentorlik/ustoz/${it.mentorSlug}?tab=efirlar` : `${s}/mentorlik`;
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

/* ------------------------------------------------------------------ */
/* Admin: ommaviy e'lon botdan (`/elon`)                               */
/* ------------------------------------------------------------------ */


/**
 * `/elon` — ommaviy e'lon, FAQAT admin chat. Ikki yo'l:
 *  - bir xabarda: `/elon Sarlavha | Matn` (yoki `/elon` + Enter, 1-qator sarlavha, qolgani matn);
 *  - suhbat: `/elon` → bot sarlavhani so'raydi → matnni so'raydi (bot_sessions, flow="broadcast").
 * Oxirida oldindan ko'rish + auditoriya tugmalari (`bc:<all|specialists|clients|no>`). Xato bo'lsa adminga aytiladi.
 */
export async function handleBroadcastStart(chatId: string, text: string): Promise<void> {
  const me = await accountOf(chatId);
  if (!me || me.role !== "admin" || me.isBanned) {
    await sendTelegram(chatId, "Bu buyruq faqat administrator uchun.");
    return;
  }
  const raw = text.replace(/^\/elon(@\w+)?\s*/i, "").trim();
  let title = "";
  let body = "";
  if (raw.includes("|")) {
    const i = raw.indexOf("|");
    title = raw.slice(0, i).trim();
    body = raw.slice(i + 1).trim();
  } else if (raw.includes("\n")) {
    const i = raw.indexOf("\n");
    title = raw.slice(0, i).trim();
    body = raw.slice(i + 1).trim();
  } else if (raw) {
    // Faqat sarlavha yozilgan — matnni so'raymiz
    title = raw;
  }
  try {
    const { setBotSession } = await import("@/lib/telegram-bot/session");
    if (title.length >= 4 && body.length >= 10) {
      await showBroadcastPreview(chatId, title.slice(0, 120), body.slice(0, 600));
      return;
    }
    if (title.length >= 4) {
      await setBotSession(chatId, "broadcast", "body", { title: title.slice(0, 120) });
      await sendTelegram(chatId, `📣 Sarlavha: <b>${escapeTelegramHtml(title.slice(0, 120))}</b>\n\nEndi e'lon <b>matnini</b> yozing (10–600 belgi). Bekor qilish — /start`);
      return;
    }
    await setBotSession(chatId, "broadcast", "title", {});
    await sendTelegram(chatId, "📣 <b>Ommaviy e'lon</b> — barcha foydalanuvchilarga (sayt + Telegram) bir vaqtda ketadi.\n\n1️⃣ E'lon <b>sarlavhasini</b> yozing (4–120 belgi).\n\n<i>Tezkor usul: <code>/elon Sarlavha | Matn</code>. Bekor qilish — /start</i>");
  } catch (e) {
    console.error("[telegram:elon]", e);
    await sendTelegram(chatId, `⚠️ Xatolik: ${escapeTelegramHtml(e instanceof Error ? e.message : "noma'lum")}. Admin paneldagi «Ommaviy xabar» bo'limidan yuborib ko'ring.`);
  }
}

/** Suhbat rejimida matnli javob (sarlavha → matn) — faqat faol broadcast oqimida; `true` — qabul qilindi */
export async function handleBroadcastText(chatId: string, text: string): Promise<boolean> {
  const { getBotSession, setBotSession, clearBotSession } = await import("@/lib/telegram-bot/session");
  const s = await getBotSession<{ title?: string; body?: string }>(chatId);
  if (!s || s.flow !== "broadcast") return false;
  const me = await accountOf(chatId);
  if (!me || me.role !== "admin" || me.isBanned) {
    await clearBotSession(chatId);
    return false;
  }
  const t = text.trim();
  if (s.step === "title") {
    if (t.length < 4 || t.length > 120) {
      await sendTelegram(chatId, "Sarlavha 4–120 belgi bo'lsin. Qaytadan yozing:");
      return true;
    }
    await setBotSession(chatId, "broadcast", "body", { title: t });
    await sendTelegram(chatId, `Sarlavha: <b>${escapeTelegramHtml(t)}</b> ✓\n\n2️⃣ Endi e'lon <b>matnini</b> yozing (10–600 belgi).`);
    return true;
  }
  if (s.step === "body") {
    if (t.length < 10 || t.length > 600) {
      await sendTelegram(chatId, "Matn 10–600 belgi bo'lsin. Qaytadan yozing:");
      return true;
    }
    await showBroadcastPreview(chatId, s.data.title ?? "E'lon", t);
    return true;
  }
  await sendTelegram(chatId, "Yuqoridagi xabarda auditoriya tugmasini bosing 👆 (bekor qilish — /start)");
  return true;
}

/** Oldindan ko'rish + auditoriya tugmalari; qoralama sessiyada (`bc:` bosilganda o'qiladi) */
async function showBroadcastPreview(chatId: string, title: string, body: string): Promise<void> {
  const { setBotSession } = await import("@/lib/telegram-bot/session");
  await setBotSession(chatId, "broadcast", "confirm", { title, body });
  const { audienceRows, channelStat } = await import("@/lib/broadcast");
  const all = await audienceRows("all");
  const st = channelStat(all);
  const sp = all.filter((r) => r.role === "specialist").length;
  const cl = all.filter((r) => r.role === "client").length;
  await sendTelegram(chatId, `<b>${escapeTelegramHtml(title)}</b>\n${escapeTelegramHtml(body)}\n\n— Shunday ketadi. Kimga yuboramiz? (saytda ${all.length} kishi, Telegramda ${st.telegram} kishi)`, {
    keyboard: [
      [{ text: `👥 Hammaga (${all.length})`, data: "bc:all" }],
      [
        { text: `🎨 Mutaxassislar (${sp})`, data: "bc:specialists" },
        { text: `🧑‍💼 Mijozlar (${cl})`, data: "bc:clients" },
      ],
      [{ text: "✖️ Bekor qilish", data: "bc:no" }],
    ],
  });
}

/** `bc:<auditoriya|no>` — admin tasdiqlaydi; natija asl xabar ostiga yoziladi, tugmalar yo'qoladi */
export async function handleBroadcastCallback(chatId: string, data: string, answer: Answer, messageId: number | null): Promise<boolean> {
  const m = /^bc:(all|specialists|clients|no)$/.exec(data);
  if (!m) return false;
  const me = await accountOf(chatId);
  if (!me || me.role !== "admin" || me.isBanned) {
    await answer("Faqat administrator uchun");
    return true;
  }
  const { getBotSession, clearBotSession } = await import("@/lib/telegram-bot/session");
  const s = await getBotSession<{ title?: string; body?: string }>(chatId);
  const draft = s?.flow === "broadcast" && s.step === "confirm" && s.data.title && s.data.body ? { title: s.data.title, body: s.data.body } : null;
  const finish = async (result: string) => {
    await answer(result.slice(0, 190));
    if (messageId) {
      await telegramApi("editMessageText", { chat_id: chatId, message_id: messageId, text: `${draft ? `<b>${escapeTelegramHtml(draft.title)}</b>\n${escapeTelegramHtml(draft.body)}\n\n` : ""}<b>${escapeTelegramHtml(result)}</b>`, parse_mode: "HTML" });
    }
  };
  if (m[1] === "no") {
    await clearBotSession(chatId);
    await finish("Bekor qilindi");
    return true;
  }
  if (!draft) {
    await finish("Qoralama topilmadi yoki eskirgan — /elon bilan qaytadan yozing");
    return true;
  }
  // CAS: sessiya o'chirilgach yuboriladi — ikki marta bosilsa ikkinchi marta ketmaydi
  const { botSessions } = await import("@/lib/db/schema");
  const del = await db.delete(botSessions).where(eq(botSessions.chatId, chatId)).returning({ chatId: botSessions.chatId });
  if (!del.length) {
    await answer("Allaqachon yuborilmoqda");
    return true;
  }
  const { AUDIENCE_LABEL, sendBroadcast } = await import("@/lib/broadcast");
  const aud = m[1] as "all" | "specialists" | "clients";
  try {
    const r = await sendBroadcast({ title: draft.title, body: draft.body, audience: aud }, me.id, "telegram");
    await finish(`✅ Yuborildi — ${AUDIENCE_LABEL[aud].toLowerCase()}: ${r.sent} kishi (Telegram ${r.channels.telegram})`);
  } catch (e) {
    await finish(`Xatolik: ${e instanceof Error ? e.message : "yuborilmadi"}`);
  }
  return true;
}

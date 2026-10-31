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
import { MENU_ROWS, SETTINGS_TEXT, sendNotLinked, settingsKeyboard } from "@/lib/telegram-bot/ui";

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
  const note = linked ? `Hisob: <b>${escapeTelegramHtml(linked.name)}</b>` : "Bu Telegram hali hisobga ulanmagan — tasdiqlasangiz yangi hisob yaratiladi.";
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
export function orderButtons(orderId: string, href: string): { text: string; url?: string; data?: string }[][] {
  return [
    [
      { text: "✅ Qabul qilish", data: `ord:ok:${orderId}` },
      { text: "✖️ Rad etish", data: `ord:no:${orderId}` },
    ],
    [{ text: "Buyurtmani ochish", url: href }],
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
export async function handleMyOrders(chatId: string): Promise<void> {
  const me = await accountOf(chatId);
  if (!me) {
    await sendNotLinked(chatId);
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
    await sendTelegram(chatId, "Ochiq buyurtma yo'q.", { button: { text: "Buyurtmalarim", url: `${siteUrl()}/kabinet/buyurtmalar` } });
    return;
  }
  const { STATUS_LABEL } = await import("@/lib/telegram-bot/orders");
  for (const o of rows) {
    const mine = o.spUserId === me.id;
    const text = `<b>${escapeTelegramHtml(o.title)}</b>\n${escapeTelegramHtml(STATUS_LABEL[o.status] ?? o.status)}${o.amount ? ` · ${escapeTelegramHtml(formatPrice(o.amount))}` : ""}`;
    const href = `${siteUrl()}/buyurtma/${o.id}`;
    await sendTelegram(chatId, text, mine && o.status === "new" ? { keyboard: orderButtons(o.id, href) } : { button: { text: "Ochish", url: href } });
  }
}

/* ------------------------------------------------------------------ */
/* Profil, xabarlar, vakansiyalar, sozlamalar                           */
/* ------------------------------------------------------------------ */

/** `/profil` — hisob kartasi */
export async function handleProfile(chatId: string): Promise<void> {
  const me = await accountOf(chatId);
  if (!me) {
    await sendNotLinked(chatId);
    return;
  }
  const since = new Date(me.createdAt).toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" });
  const text =
    `<b>${escapeTelegramHtml(me.name)}</b>\n` +
    `${escapeTelegramHtml(ROLE_LABEL[me.role] ?? me.role)}${me.username ? ` · @${escapeTelegramHtml(me.username)}` : ""}\n` +
    `${escapeTelegramHtml(me.email)}\n` +
    `Ro'yxatdan: ${escapeTelegramHtml(since)}\n\n` +
    "Telegram ulangan ✅ — buyurtma, xabar va kurs bildirishnomalari shu yerga keladi.";
  const s = siteUrl() ?? "";
  const sp = me.role === "specialist" ? await db.query.specialists.findFirst({ where: eq(specialists.userId, me.id), columns: { slug: true } }) : null;
  await sendTelegram(chatId, text, {
    keyboard: [
      [
        { text: "Kabinet", url: `${s}/kabinet` },
        { text: "Profilni tahrirlash", url: `${s}/kabinet/profil` },
      ],
      ...(sp ? [[{ text: "Ommaviy sahifam", url: `${s}/mutaxassislar/${sp.slug}` }]] : []),
    ],
  });
}

/** `/xabarlar` — o'qilmagan DM soni */
export async function handleMessages(chatId: string): Promise<void> {
  const me = await accountOf(chatId);
  if (!me) {
    await sendNotLinked(chatId);
    return;
  }
  const { unreadDmCount } = await import("@/lib/chat/dm");
  const n = await unreadDmCount(me.id).catch(() => 0);
  const text = n > 0 ? `💬 <b>${n} ta o'qilmagan xabar</b> bor.` : "💬 O'qilmagan xabar yo'q.";
  await sendTelegram(chatId, text, { button: { text: n > 0 ? "Xabarlarni o'qish" : "Chatni ochish", url: `${siteUrl() ?? ""}/kabinet/chat` } });
}

/** `/vakansiyalar` — so'nggi 5 ta ochiq vakansiya (hamma uchun, ulash shart emas) */
export async function handleVacancies(chatId: string): Promise<void> {
  const { listVacancies } = await import("@/lib/vacancies/service");
  const { professionLabel, salaryLabel } = await import("@/lib/vacancies/format");
  const { vacancyFilterSchema } = await import("@/lib/vacancies/validators");
  const { items, total } = await listVacancies(vacancyFilterSchema.parse({ limit: 5 }));
  const s = siteUrl() ?? "";
  if (!items.length) {
    await sendTelegram(chatId, "Hozircha ochiq vakansiya yo'q.", { button: { text: "Vakansiyalar", url: `${s}/vakansiyalar` } });
    return;
  }
  const lines = items.map((v, i) => {
    const where = v.regionSlug ? (REGION_BY_SLUG[v.regionSlug]?.name ?? v.regionSlug) : "Masofaviy";
    return `${i + 1}. <a href="${s}/vakansiyalar/${v.id}"><b>${escapeTelegramHtml(v.title)}</b></a>\n   ${escapeTelegramHtml(v.company)} · ${escapeTelegramHtml(professionLabel(v.profession, true))} · ${escapeTelegramHtml(where)}\n   ${escapeTelegramHtml(salaryLabel(v.salaryMin, v.salaryMax))}`;
  });
  await sendTelegram(chatId, `💼 <b>So'nggi vakansiyalar</b> (${total} ta ochiq)\n\n${lines.join("\n\n")}`, { button: { text: "Barcha vakansiyalar", url: `${s}/vakansiyalar` } });
}

/** `/sozlamalar` — bildirishnoma guruhlari switch'lari */
export async function handleSettings(chatId: string): Promise<void> {
  const me = await accountOf(chatId);
  if (!me) {
    await sendNotLinked(chatId);
    return;
  }
  await sendTelegram(chatId, SETTINGS_TEXT, { keyboard: settingsKeyboard(me.notifyPrefs ?? {}) });
}

/** `st:<guruh>` — switch'ni almashtirib, klaviaturani joyida yangilaydi */
export async function handleSettingsCallback(chatId: string, data: string, answer: Answer, messageId: number | null): Promise<boolean> {
  const m = /^st:([a-z]+)$/.exec(data);
  if (!m) return false;
  const key = m[1] as NotifyGroupKey;
  if (!NOTIFY_GROUP_KEYS.includes(key)) return false;
  const me = await accountOf(chatId);
  if (!me) {
    await answer("Avval hisobni ulang");
    return true;
  }
  const next = { ...(me.notifyPrefs ?? {}) };
  next[key] = next[key] === false; // o'chirilgan → yoqiladi, aks holda o'chadi
  await db.update(users).set({ notifyPrefs: next }).where(eq(users.id, me.id));
  await answer(next[key] ? "Yoqildi" : "O'chirildi");
  if (messageId) {
    const { replyMarkup } = await import("@/lib/telegram");
    await telegramApi("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: replyMarkup({ keyboard: settingsKeyboard(next) }) });
  }
  return true;
}

/** `menu:*` — xush kelibsiz ekranidagi inline tugmalar */
export async function handleMenuCallback(chatId: string, data: string, answer: Answer): Promise<boolean> {
  if (data !== "menu:help") return false;
  await answer("");
  const { sendHelp } = await import("@/lib/telegram-bot/ui");
  await sendHelp(chatId, Boolean(await accountOf(chatId)));
  return true;
}

export { MENU_ROWS };

import "server-only";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, specialists, users } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { escapeTelegramHtml, sendTelegram } from "@/lib/telegram";
import { decideLoginRequest, findLoginRequest } from "@/lib/auth/telegram-login";
import { siteUrl } from "@/lib/security/site";
import { formatPrice } from "@/lib/utils";

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
async function accountOf(chatId: string) {
  return db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, name: true, role: true, isBanned: true } });
}

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
    await sendTelegram(chatId, "Avval hisobni ulang: saytda Kabinet → Profil → «Telegramga ulash».");
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

import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { enrollments, subscriptionInvoices, users } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { isProviderConfigured, siteOrigin } from "@/lib/payments/config";
import { buildInvoiceRedirectUrl, loadInvoice, manualRequisites, markInvoiceSent } from "@/lib/subscriptions/billing";
import { escapeTelegramHtml, sendTelegram, type TelegramButton } from "@/lib/telegram";
import { formatSom, PURCHASE_LABEL, type PurchaseType } from "@/lib/mentorship/format";
import { isPurchase, priceFor, purchaseHref, purchaseMeta, quoteItem, startPurchase } from "@/lib/mentorship/purchases";

/**
 * Mentorlik to'lovi Telegram bot orqali.
 *  - Saytdagi «Telegramda to'lash» → t.me/bot?start=b_<tur>_<id> (tur: c|t|s|k)
 *  - Bot narxni ko'rsatadi, usulni tanlatadi (callback `bp:<usul>:<tur>:<id>`), hisob ochadi (startPurchase),
 *    Payme/Click havolasi yoki karta rekvizitlarini yuboradi; o'tkazma uchun «To'ladim» (`bd:<hisob>`).
 *  - To'langach kirish/bildirishnoma mavjud oqim (markInvoicePaid → fulfillPurchase → notify) orqali keladi.
 * Hisob faqat chat ulangan foydalanuvchiga ochiladi.
 */

const TYPE_CODE: Record<PurchaseType, string> = { course: "c", ticket: "t", sub: "s", consult: "k" };
const CODE_TYPE: Record<string, PurchaseType> = { c: "course", t: "ticket", s: "sub", k: "consult" };
const METHOD: Record<string, "payme" | "click" | "manual"> = { p: "payme", c: "click", m: "manual" };

/** Saytdagi tugma uchun deep-link payload (`b_c_<id>`) — 64 belgidan oshmaydi (UUID bilan ~47) */
export const buyStartPayload = (type: PurchaseType, id: string): string => `b_${TYPE_CODE[type]}_${id}`;

const origin = () => siteOrigin();

async function userByChat(chatId: string) {
  return db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, name: true, isBanned: true } });
}

/** `/start b_c_<id>` — xarid xulosasi va to'lov usullari */
export async function handleBuyStart(chatId: string, payload: string): Promise<boolean> {
  const m = /^b_([ctsk])_([\w-]{1,60})$/.exec(payload);
  if (!m) return false;
  const user = await userByChat(chatId);
  if (!user || user.isBanned) {
    await sendTelegram(chatId, "To'lovni davom ettirish uchun avval hisobni ulang: saytda Kabinet → Profil → «Telegramga ulash», so'ng tugmani qayta bosing.");
    return true;
  }
  const type = CODE_TYPE[m[1]];
  try {
    const q = await quoteItem(type, m[2], user.id);
    const price = await priceFor(q, user.id, {});
    const keyboard: TelegramButton[][] = [];
    if (price.amount <= 0) {
      keyboard.push([{ text: "🎁 Bepul boshlash", data: `bp:f:${m[1]}:${m[2]}` }]);
    } else {
      const row: TelegramButton[] = [];
      if (await isProviderConfigured("payme")) row.push({ text: "Payme", data: `bp:p:${m[1]}:${m[2]}` });
      if (await isProviderConfigured("click")) row.push({ text: "Click", data: `bp:c:${m[1]}:${m[2]}` });
      if (row.length) keyboard.push(row);
      if (await isProviderConfigured("manual")) keyboard.push([{ text: "💳 Karta o'tkazmasi", data: `bp:m:${m[1]}:${m[2]}` }]);
      if (!keyboard.length) {
        await sendTelegram(chatId, "To'lov usullari hozircha ulanmagan — administrator bilan bog'laning.");
        return true;
      }
    }
    await sendTelegram(chatId, `🛒 <b>${escapeTelegramHtml(q.title)}</b>\n${PURCHASE_LABEL[type]} · <b>${price.amount <= 0 ? "Bepul" : formatSom(price.amount)}</b>\n\nTo'lov usulini tanlang:`, { keyboard });
  } catch (e) {
    await sendTelegram(chatId, e instanceof ApiError ? `⚠️ ${escapeTelegramHtml(e.message)}` : "Xatolik. Keyinroq qayta urinib ko'ring.");
  }
  return true;
}

/** `bp:<usul>:<tur>:<id>` va `bd:<hisob>` callback'lari. false — bu callback bizniki emas */
export async function handlePayCallback(chatId: string, data: string, answer: (t: string) => Promise<unknown>): Promise<boolean> {
  const buy = /^bp:([pcmf]):([ctsk]):([\w-]{1,60})$/.exec(data);
  const done = /^bd:([\w-]{1,64})$/.exec(data);
  if (!buy && !done) return false;
  const user = await userByChat(chatId);
  if (!user || user.isBanned) {
    await answer("Avval hisobni ulang");
    return true;
  }
  try {
    if (buy) {
      const type = CODE_TYPE[buy[2]];
      const method = buy[1] === "f" ? "manual" : METHOD[buy[1]];
      const r = await startPurchase({ id: user.id }, { type, id: buy[3], provider: method });
      if (r.free) {
        await answer("Tayyor ✓");
        await sendTelegram(chatId, "🎉 Kirish ochildi! Saytda Kabinet → Mentorlik bo'limiga qarang.");
        return true;
      }
      const inv = r.invoice;
      await answer("Hisob tayyor");
      const back = { text: "Holatni ko'rish", url: `${origin()}${purchaseHref(inv.id)}` };
      if (method === "manual") {
        const req = await manualRequisites();
        await sendTelegram(
          chatId,
          `💳 <b>Karta o'tkazmasi</b>\nSumma: <b>${formatSom(inv.amount)}</b>\nKarta: <code>${escapeTelegramHtml(req?.card ?? "—")}</code>\nQabul qiluvchi: ${escapeTelegramHtml(req?.name ?? "—")}\n\nO'tkazgach pastdagi tugmani bosing — administrator tasdiqlaydi.`,
          { keyboard: [[{ text: "✅ To'ladim", data: `bd:${inv.id}` }], [back]] },
        );
        return true;
      }
      const url = buildInvoiceRedirectUrl(inv, origin());
      if (!url) throw new ApiError(400, "To'lov havolasini tuzib bo'lmadi");
      await sendTelegram(chatId, `${method === "payme" ? "Payme" : "Click"} orqali <b>${formatSom(inv.amount)}</b> to'lang. To'langach kirish avtomatik ochiladi va shu yerga xabar keladi.`, { keyboard: [[{ text: "To'lash", url }], [back]] });
      return true;
    }
    // «To'ladim» — faqat o'z hisobi, faqat xarid hisobi
    const inv = await loadInvoice(done![1]);
    if (!inv || inv.userId !== user.id || !isPurchase(inv)) {
      await answer("Hisob topilmadi");
      return true;
    }
    await markInvoiceSent(inv, user.id);
    await answer("Yuborildi ✓");
    await sendTelegram(chatId, `⏳ O'tkazma tasdiqlashni kutmoqda: <b>${escapeTelegramHtml(purchaseMeta(inv).title)}</b>. Tasdiqlangach xabar beramiz.`);
  } catch (e) {
    await answer(e instanceof ApiError ? e.message : "Xatolik — saytdan urinib ko'ring");
  }
  return true;
}

/** `/kurslarim` — yozilgan kurslar va oxirgi xaridlar holati */
export async function handleMyPurchases(chatId: string): Promise<void> {
  const user = await userByChat(chatId);
  if (!user) {
    await sendTelegram(chatId, "Avval hisobni ulang: saytda Kabinet → Profil → «Telegramga ulash».");
    return;
  }
  const rows = await db.query.enrollments.findMany({ where: eq(enrollments.userId, user.id), with: { course: { columns: { title: true, slug: true } } }, orderBy: [desc(enrollments.createdAt)], limit: 8 });
  const inv = await db.query.subscriptionInvoices.findMany({ where: and(eq(subscriptionInvoices.userId, user.id)), orderBy: [desc(subscriptionInvoices.createdAt)], limit: 15 });
  const pending = inv.filter((i) => isPurchase(i) && (i.state === "created" || i.state === "pending")).slice(0, 4);
  const lines: string[] = [];
  if (rows.length) lines.push("<b>📚 Kurslarim</b>", ...rows.map((r) => `• ${escapeTelegramHtml(r.course.title)} — ${r.progressPct}%`));
  if (pending.length) lines.push("", "<b>⏳ Kutilayotgan to'lovlar</b>", ...pending.map((i) => `• ${escapeTelegramHtml(purchaseMeta(i).title)} — ${formatSom(i.amount)}`));
  await sendTelegram(chatId, lines.length ? lines.join("\n") : "Hozircha kurs yoki xaridlar yo'q. /mentorlik ro'yxatidan tanlang.", { keyboard: [[{ text: "Mentorlik katalogi", url: `${origin()}/mentorlik` }]] });
}

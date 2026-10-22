import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { enrollments, subscriptionInvoices, users } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { isProviderConfigured, siteOrigin } from "@/lib/payments/config";
import { buildInvoiceRedirectUrl, loadInvoice, manualRequisites, markInvoicePaid, markInvoiceSent } from "@/lib/subscriptions/billing";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { escapeTelegramHtml, sendTelegram, telegramApi, telegramDownloadFile, type TelegramButton } from "@/lib/telegram";
import { isR2Enabled, r2Put } from "@/lib/storage/r2";
import { uploadDir } from "@/lib/uploads";
import { uid } from "@/lib/utils";
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
export function buyStartPayload(type: PurchaseType, id: string, promo?: string): string {
  const base = `b_${TYPE_CODE[type]}_${id}`;
  const code = promo?.trim().toUpperCase();
  // Promokod ham sig'sa qo'shiladi (callback_data 64 baytdan oshmasligi uchun ≤12 belgi)
  return code && /^[A-Z0-9]{3,12}$/.test(code) && base.length + code.length + 1 <= 52 ? `${base}.${code}` : base;
}

const origin = () => siteOrigin();

async function userByChat(chatId: string) {
  return db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, name: true, isBanned: true } });
}

/** `/start b_c_<id>` — xarid xulosasi va to'lov usullari */
export async function handleBuyStart(chatId: string, payload: string): Promise<boolean> {
  const m = /^b_([ctsk])_([\w-]{1,48})(?:\.([A-Z0-9]{3,12}))?$/.exec(payload);
  if (!m) return false;
  const user = await userByChat(chatId);
  if (!user || user.isBanned) {
    await sendTelegram(chatId, "To'lovni davom ettirish uchun avval hisobni ulang: saytda Kabinet → Profil → «Telegramga ulash», so'ng tugmani qayta bosing.");
    return true;
  }
  const type = CODE_TYPE[m[1]];
  try {
    const q = await quoteItem(type, m[2], user.id);
    const promo = m[3];
    const price = await priceFor(q, user.id, { promo });
    const suffix = promo ? `.${promo}` : "";
    const keyboard: TelegramButton[][] = [];
    if (price.amount <= 0) {
      keyboard.push([{ text: "🎁 Bepul boshlash", data: `bp:f:${m[1]}:${m[2]}${suffix}` }]);
    } else {
      const row: TelegramButton[] = [];
      if (await isProviderConfigured("payme")) row.push({ text: "Payme", data: `bp:p:${m[1]}:${m[2]}${suffix}` });
      if (await isProviderConfigured("click")) row.push({ text: "Click", data: `bp:c:${m[1]}:${m[2]}${suffix}` });
      if (row.length) keyboard.push(row);
      if (nativeEnabled()) keyboard.push([{ text: "💬 Telegram ichida to'lash", data: `bp:t:${m[1]}:${m[2]}${suffix}` }]);
      if (await isProviderConfigured("manual")) keyboard.push([{ text: "💳 Karta o'tkazmasi", data: `bp:m:${m[1]}:${m[2]}${suffix}` }]);
      if (!keyboard.length) {
        await sendTelegram(chatId, "To'lov usullari hozircha ulanmagan — administrator bilan bog'laning.");
        return true;
      }
    }
    await sendTelegram(chatId, `🛒 <b>${escapeTelegramHtml(q.title)}</b>\n${PURCHASE_LABEL[type]} · <b>${price.amount <= 0 ? "Bepul" : formatSom(price.amount)}</b>${price.promo ? ` (promokod −${price.promo.percent}%)` : ""}\n\nTo'lov usulini tanlang:`, { keyboard });
  } catch (e) {
    await sendTelegram(chatId, e instanceof ApiError ? `⚠️ ${escapeTelegramHtml(e.message)}` : "Xatolik. Keyinroq qayta urinib ko'ring.");
  }
  return true;
}

/** `bp:<usul>:<tur>:<id>` va `bd:<hisob>` callback'lari. false — bu callback bizniki emas */
export async function handlePayCallback(chatId: string, data: string, answer: (t: string) => Promise<unknown>): Promise<boolean> {
  const buy = /^bp:([pcmft]):([ctsk]):([\w-]{1,48})(?:\.([A-Z0-9]{3,12}))?$/.exec(data);
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
      const method = buy[1] === "f" || buy[1] === "t" ? "manual" : METHOD[buy[1]];
      if (buy[1] === "t" && !nativeEnabled()) throw new ApiError(400, "Telegram to'lovi ulanmagan");
      const r = await startPurchase({ id: user.id }, { type, id: buy[3], provider: method, promo: buy[4] });
      if (r.free) {
        await answer("Tayyor ✓");
        await sendTelegram(chatId, "🎉 Kirish ochildi! Saytda Kabinet → Mentorlik bo'limiga qarang.");
        return true;
      }
      const inv = r.invoice;
      await answer("Hisob tayyor");
      if (buy[1] === "t") {
        await telegramApi("sendInvoice", {
          chat_id: chatId,
          title: purchaseMeta(inv).title.slice(0, 32),
          description: `${PURCHASE_LABEL[type]} — Kasb Egalari`.slice(0, 255),
          payload: inv.id,
          provider_token: process.env.TELEGRAM_PAYMENT_PROVIDER_TOKEN,
          currency: "UZS",
          prices: [{ label: "Jami", amount: inv.amount * 100 }],
        });
        return true;
      }
      const back = { text: "Holatni ko'rish", url: `${origin()}${purchaseHref(inv.id)}` };
      if (method === "manual") {
        const req = await manualRequisites();
        await sendTelegram(
          chatId,
          `💳 <b>Karta o'tkazmasi</b>\nSumma: <b>${formatSom(inv.amount)}</b>\nKarta: <code>${escapeTelegramHtml(req?.card ?? "—")}</code>\nQabul qiluvchi: ${escapeTelegramHtml(req?.name ?? "—")}\n\nO'tkazgach <b>chek rasmini (skrinshot) shu yerga yuboring</b> — administrator ko'rib tasdiqlaydi va kirish avtomatik ochiladi.`,
          { keyboard: [[{ text: "Chek yubora olmayman — «To'ladim»", data: `bd:${inv.id}` }], [back]] },
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

/* ------------------------------------------------------------------ */
/* Chek rasmi — karta o'tkazmasi; Telegram'ning o'z to'lovi            */
/* ------------------------------------------------------------------ */

const nativeEnabled = () => Boolean(process.env.TELEGRAM_PAYMENT_PROVIDER_TOKEN);

function sniffImage(b: Buffer): { ext: string; mime: string } | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b.length >= 8 && b.subarray(1, 4).toString("ascii") === "PNG") return { ext: "png", mime: "image/png" };
  if (b.length >= 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

/** Chek rasmini saytdagi yuklash bilan bir xil joyga saqlaydi (R2 → Blob → disk) */
async function storeReceipt(bytes: Buffer): Promise<string | null> {
  const kind = sniffImage(bytes);
  if (!kind) return null;
  const name = `${uid()}.${kind.ext}`;
  if (isR2Enabled()) return r2Put(`uploads/${name}`, bytes, kind.mime);
  if (process.env.BLOB_READ_WRITE_TOKEN) return (await put(`uploads/${name}`, bytes, { access: "public", contentType: kind.mime, addRandomSuffix: false })).url;
  if (process.env.VERCEL) return null;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), name), bytes);
  return `/uploads/${name}`;
}

/** Chatga rasm keldi: foydalanuvchining oxirgi ochiq KARTA xaridiga chek sifatida biriktiriladi → admin tasdiqlaydi */
export async function handleReceiptPhoto(chatId: string, fileId: string): Promise<void> {
  const user = await userByChat(chatId);
  if (!user || user.isBanned) return;
  const open = await db.query.subscriptionInvoices.findMany({
    where: and(eq(subscriptionInvoices.userId, user.id), eq(subscriptionInvoices.state, "created"), eq(subscriptionInvoices.provider, "manual")),
    orderBy: [desc(subscriptionInvoices.createdAt)],
    limit: 5,
  });
  const inv = open.find((i) => isPurchase(i) && Date.now() - i.createdAt.getTime() < 2 * 60 * 60 * 1000);
  if (!inv) {
    await sendTelegram(chatId, "Chek qabul qilish uchun avval to'lov boshlang: saytda xaridda «Telegramda to'lash» → «Karta o'tkazmasi».");
    return;
  }
  try {
    const bytes = await telegramDownloadFile(fileId);
    const url = bytes ? await storeReceipt(bytes) : null;
    if (!url) {
      await sendTelegram(chatId, "Rasmni o'qib bo'lmadi. JPG/PNG skrinshot yuboring (5 MB gacha).");
      return;
    }
    await markInvoiceSent(inv, user.id, undefined, url);
    await sendTelegram(chatId, `📎 Chek qabul qilindi: <b>${escapeTelegramHtml(purchaseMeta(inv).title)}</b>. Administrator tasdiqlagach kirish avtomatik ochiladi va shu yerga xabar keladi.`);
  } catch (e) {
    await sendTelegram(chatId, e instanceof ApiError ? `⚠️ ${escapeTelegramHtml(e.message)}` : "Xatolik. Keyinroq qayta urinib ko'ring.");
  }
}

/** pre_checkout_query: hisob shu foydalanuvchiniki, ochiq va summa mos bo'lsagina ruxsat */
export async function handlePreCheckout(q: { id: string; from?: { id?: unknown }; invoice_payload?: unknown; total_amount?: unknown; currency?: unknown }): Promise<void> {
  const inv = typeof q.invoice_payload === "string" ? await loadInvoice(q.invoice_payload) : null;
  const owner = inv?.userId ? await db.query.users.findFirst({ where: eq(users.id, inv.userId), columns: { telegramChatId: true } }) : null;
  const good = inv && isPurchase(inv) && inv.state === "created" && q.currency === "UZS" && q.total_amount === inv.amount * 100 && owner?.telegramChatId === String(q.from?.id);
  await telegramApi("answerPreCheckoutQuery", good ? { pre_checkout_query_id: q.id, ok: true } : { pre_checkout_query_id: q.id, ok: false, error_message: "Hisob yaroqsiz yoki muddati o'tgan. Qaytadan boshlang." });
}

/** successful_payment: pul Telegram provayderida o'tdi → hisob to'landi (idempotent) */
export async function handleSuccessfulPayment(chatId: string, p: { invoice_payload?: unknown; telegram_payment_charge_id?: unknown; provider_payment_charge_id?: unknown }): Promise<void> {
  const id = typeof p.invoice_payload === "string" ? p.invoice_payload : "";
  const inv = id ? await loadInvoice(id) : null;
  if (!inv || !isPurchase(inv)) return;
  await markInvoicePaid(inv.id, { providerTxnId: `tg-${String(p.telegram_payment_charge_id ?? p.provider_payment_charge_id ?? inv.id)}`, note: "Telegram to'lovi" });
  await sendTelegram(chatId, "✅ To'lov qabul qilindi — rahmat!");
}

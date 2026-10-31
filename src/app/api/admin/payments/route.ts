import { z } from "zod";
import { handler, ok, parseBody, requireSession, ApiError } from "@/lib/api";
import { paymentsEnv } from "@/lib/payments/config";
import { checkCard, CARD_BRAND_LABEL, formatCard } from "@/lib/payments/card";
import { getManualCard, readManualCard, saveManualCard } from "@/lib/payments/settings";
import { notifyAdmins } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";

/**
 * Admin: to'lov provayderlari holati — avtomatik tekshiruv.
 * Payme/Click: kalitlar env'da to'liqmi, qaysi rejim (test/prod), callback URL tayyormi.
 * Qo'lda o'tkazma: platforma kartasi (admin sozlamasi yoki env) va uning Luhn/BIN tekshiruvi.
 * Haqiqiy bank-tomondagi tekshiruv merchant shartnomadan keyin provayder API'si bilan bo'ladi.
 */
export const GET = handler(async (req) => {
  await requireSession(["admin"]);
  const env = paymentsEnv();
  const origin = new URL(req.url).origin;
  const site = process.env.SITE_URL?.replace(/\/$/, "") || origin;
  const manual = await getManualCard();
  const manualCheck = manual.card ? checkCard(manual.card) : null;

  const payme = {
    configured: Boolean(env.payme.merchantId && env.payme.key),
    mode: env.payme.test ? ("test" as const) : ("prod" as const),
    checks: [
      { label: "PAYME_MERCHANT_ID", ok: Boolean(env.payme.merchantId) },
      { label: env.payme.test ? "PAYME_TEST_KEY" : "PAYME_KEY", ok: Boolean(env.payme.key) },
      { label: "Callback (Merchant API) manzili", ok: true, hint: `${site}/api/payments/payme` },
    ],
  };
  const click = {
    configured: Boolean(env.click.serviceId && env.click.merchantId && env.click.secret),
    checks: [
      { label: "CLICK_SERVICE_ID", ok: Boolean(env.click.serviceId) },
      { label: "CLICK_MERCHANT_ID", ok: Boolean(env.click.merchantId) },
      { label: "CLICK_MERCHANT_USER_ID", ok: Boolean(env.click.merchantUserId) },
      { label: "CLICK_SECRET_KEY", ok: Boolean(env.click.secret) },
      { label: "Prepare/Complete manzili", ok: true, hint: `${site}/api/payments/click` },
    ],
  };
  return ok({
    payme,
    click,
    manual: {
      configured: Boolean(manual.card),
      source: manual.source,
      card: manual.card ? formatCard(manual.card) : "",
      name: manual.name,
      valid: manualCheck?.ok ?? false,
      brand: manualCheck?.brand ? CARD_BRAND_LABEL[manualCheck.brand] : null,
      error: manualCheck && !manualCheck.ok ? manualCheck.error : null,
    },
  });
});

const cardSchema = z.object({
  card: z.string().trim().max(30),
  name: z.string().trim().min(2, "Karta egasi nomini kiriting").max(60),
});

/** Admin: qo'lda o'tkazma kartasini saqlash (bo'sh — o'chirish). Saqlashdan oldin avtomatik Luhn/BIN tekshiruvi. */
export const PATCH = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const input = await parseBody(req, cardSchema);
  const digitsOnly = input.card.replace(/\D/g, "");
  if (digitsOnly) {
    const check = checkCard(input.card);
    if (!check.ok) throw new ApiError(422, check.error ?? "Karta raqami noto'g'ri", { card: check.error ?? "Noto'g'ri" });
  }
  const before = await readManualCard();
  await saveManualCard(digitsOnly ? formatCard(digitsOnly) : "", input.name);
  await audit(session.sub, "admin_settings", { targetType: "platform", targetId: "manual-card", meta: { set: Boolean(digitsOnly), last4: digitsOnly.slice(-4) || null } }, req);
  // Firibgarlik yo'li (3-audit): admin paroli o'g'irlansa, karta almashtirilib barcha qo'lda to'lovlar begona kartaga
  // burilishi mumkin — shuning uchun HAR o'zgarish barcha adminlarga (sayt + Telegram + email) darhol bildiriladi
  const beforeDigits = before.card.replace(/\D/g, "");
  if (beforeDigits !== digitsOnly || before.name !== input.name) {
    const masked = (d: string) => (d ? `•••• ${d.slice(-4)}` : "o'chirilgan");
    await notifyAdmins(
      "account",
      "To'lov kartasi o'zgartirildi",
      `${session.name ?? "Administrator"}: ${masked(beforeDigits)} → ${masked(digitsOnly)}${digitsOnly ? ` (${input.name})` : ""}. Bu siz bo'lmasangiz — darhol kartani tekshiring va admin parolini almashtiring.`,
      "/admin#tolov-sozlamalari",
    ).catch(() => undefined);
  }
  const manual = await readManualCard();
  return ok({ card: manual.card, name: manual.name, source: manual.source });
});

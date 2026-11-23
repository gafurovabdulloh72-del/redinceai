import { ApiError, handler, ok } from "@/lib/api";
import { markInvoicePaid } from "@/lib/subscriptions/billing";
import { matchSmsAmounts, parseCreditAmounts, smsAutoState, verifySmsKey } from "@/lib/payments/sms-auto";
import { rateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { notifyAdmins } from "@/lib/notifications";
import { formatPrice } from "@/lib/utils";

/**
 * Bank SMS'i → kartaga o'tkazmani avtomatik tasdiqlash (lib/payments/sms-auto.ts). Chaqiruvchi — admin telefonidagi
 * iPhone Shortcuts / Android SMS-forwarder. Kalit: `X-Sms-Key` sarlavhasi yoki `?key=`. Tana: JSON {text} yoki oddiy matn.
 * SMS matni HECH QAYERGA saqlanmaydi; javob summa/hisob haqida hech narsa oshkor qilmaydi (faqat ok + status).
 */
export const POST = handler(
  async (req) => {
    const url = new URL(req.url);
    const key = req.headers.get("x-sms-key") || url.searchParams.get("key");
    if (!(await verifySmsKey(key))) throw new ApiError(401, "Kalit noto'g'ri");
    await rateLimit("smsAuto", 300, 3_600_000, "SMS");
    const state = await smsAutoState();
    if (!state.enabled) return ok({ status: "disabled" });

    let text = "";
    const ctype = req.headers.get("content-type") || "";
    const raw = (await req.text()).slice(0, 4000);
    if (ctype.includes("json")) {
      try {
        const j = JSON.parse(raw) as Record<string, unknown>;
        text = String(j.text ?? j.message ?? j.body ?? j.sms ?? "");
      } catch {
        text = raw;
      }
    } else if (ctype.includes("form")) {
      const f = new URLSearchParams(raw);
      text = f.get("text") ?? f.get("message") ?? f.get("body") ?? raw;
    } else text = raw;

    const match = await matchSmsAmounts(parseCreditAmounts(text));
    if (match.status === "ignored") return ok({ status: "ignored" });
    if (match.status === "ambiguous") {
      await notifyAdmins("payment_pending", "SMS: summa bir nechta hisobga mos", `${formatPrice(match.amount)} kirim keldi, lekin bir nechta ochiq hisobda shu summa — qo'lda tasdiqlang.`, "/admin/obunalar?status=pending", { skipMail: true }).catch(() => undefined);
      return ok({ status: "ambiguous" });
    }
    const inv = await markInvoicePaid(match.invoiceId, { actorId: null, note: "Bank SMS orqali avtomatik tasdiqlandi", req });
    await audit(null, "payment_sms_auto", { targetType: "subscription_invoice", targetId: inv.id, meta: { amount: match.amount } }, req);
    return ok({ status: "matched" });
  },
  { csrf: false, limit: false },
);

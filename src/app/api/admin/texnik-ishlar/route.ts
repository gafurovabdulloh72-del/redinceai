import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { invalidateSiteNotice } from "@/lib/admin/site-notice";
import { BANNER_LIMITS, readSiteNotice, saveMaintenance } from "@/lib/payments/settings";
import { audit } from "@/lib/security/audit";

const schema = z.object({
  on: z.boolean({ error: "Holat ko'rsatilmagan" }).optional(),
  /** Foydalanuvchiga ko'rinadigan matn; bo'sh — standart matn */
  messageUz: z.string().trim().max(BANNER_LIMITS.message, { error: `Ko'pi bilan ${BANNER_LIMITS.message} belgi` }).optional(),
  messageRu: z.string().trim().max(BANNER_LIMITS.message, { error: `Ko'pi bilan ${BANNER_LIMITS.message} belgi` }).optional(),
});

/** Admin: texnik ishlar («faqat o'qish») rejimi holati */
export const GET = handler(async () => {
  await requireSession(["admin"]);
  return ok((await readSiteNotice()).maintenance);
});

/**
 * Admin: rejimni yoqish/o'chirish va/yoki xabar matnini o'zgartirish. Faqat yuborilgan maydonlar o'zgaradi
 * (`{ on: false }` matnni o'chirib yubormaydi). Yoqilganda admin bo'lmaganlarning o'zgartirishlari 503 oladi
 * (to'siq — `handler()` + lib/admin/maintenance.ts); sayt tepasida ogohlantirish chizig'i chiqadi.
 */
export const PUT = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const input = await parseBody(req, schema, { onlyProvided: true });
  const prev = (await readSiteNotice()).maintenance;
  const next = { on: input.on ?? prev.on, messageUz: input.messageUz ?? prev.messageUz, messageRu: input.messageRu ?? prev.messageRu };
  const saved = await saveMaintenance(next, prev);
  invalidateSiteNotice({ maintenance: saved });
  if (saved.on !== prev.on) await audit(session.sub, saved.on ? "admin_maintenance_on" : "admin_maintenance_off", { targetType: "platform_settings", targetId: "maintenance", meta: { customMessage: Boolean(saved.messageUz || saved.messageRu), minutes: !saved.on && prev.since ? Math.round((Date.now() - prev.since) / 60000) : undefined } }, req);
  else await audit(session.sub, "admin_maintenance_message", { targetType: "platform_settings", targetId: "maintenance", meta: { messageUz: saved.messageUz.slice(0, 120) || undefined, hasRu: Boolean(saved.messageRu) } }, req);
  return ok(saved);
});

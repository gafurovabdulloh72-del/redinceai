import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { platformSettingsSchema } from "@/lib/validators";
import { audit } from "@/lib/security/audit";
import { getSettings, saveSettings } from "@/lib/payments/settings";

/** Komissiya darajalari (F21) — validators.ts sxemasi ularni hali bilmasa ham ixtiyoriy qabul qilinadi */
const pct = z.coerce.number().int().min(0).max(50);
const schema = platformSettingsSchema.extend({ commissionPctNew: pct.optional(), commissionPctTop: pct.optional() });

/** Platforma sozlamalari: komissiya darajalari (%), minimal payout, minimal buyurtma summasi */
export const GET = handler(async () => {
  await requireSession(["admin"]);
  return ok(await getSettings());
});

export const PUT = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const input = await parseBody(req, schema);
  const before = await getSettings();
  const saved = await saveSettings(input);
  await audit(session.sub, "admin_settings", { targetType: "platform_settings", meta: { before, after: saved } }, req);
  return ok(saved);
});

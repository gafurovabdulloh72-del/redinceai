import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { getSettings, saveSettings } from "@/lib/payments/settings";

/**
 * Yangi mutaxassislarni AVTOMATIK tasdiqlash (admin panel «Tasdiqlash navbati» kaliti; bot /navbat ham shu kalitni o'zgartiradi).
 * Yoqilganda yangi profil ochilishi bilan tasdiqlanadi (`notifyAdminsNewSpecialist`) — navbatdagi eski profillarga tegilmaydi.
 */
const schema = z.strictObject({ on: z.boolean() });

export const GET = handler(async () => {
  await requireSession(["admin"]);
  return ok({ on: (await getSettings()).autoVerifySpecialists === 1 });
});

export const PATCH = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const { on } = await parseBody(req, schema);
  const before = (await getSettings()).autoVerifySpecialists;
  const value = on ? 1 : 0;
  if (before !== value) {
    await saveSettings({ autoVerifySpecialists: value });
    await audit(session.sub, "admin_settings", { targetType: "platform_settings", meta: { before: { autoVerifySpecialists: before }, after: { autoVerifySpecialists: value } } }, req);
  }
  return ok({ on });
});

import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { getSettings, saveSettings } from "@/lib/payments/settings";
import { grantLaunchGiftToAll, launchGiftStats } from "@/lib/subscriptions/launch-gift";

/**
 * Ishga tushirish sovg'asi (1 yil Max bepul) — admin «Platforma» bo'limidagi karta.
 * GET — holat; PATCH {until} — aksiya tugash vaqti (ms, 0 — o'chirish); POST {action:"grant_all"} — hali olmaganlarga hozir berish.
 */
const patchSchema = z.strictObject({ until: z.number().int().min(0).max(4_102_444_800_000) });
const postSchema = z.strictObject({ action: z.literal("grant_all") });

export const GET = handler(async () => {
  await requireSession(["admin"]);
  return ok(await launchGiftStats());
});

export const PATCH = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const { until } = await parseBody(req, patchSchema);
  if (until !== 0 && until <= Date.now()) throw new ApiError(422, "Tugash sanasi kelajakda bo'lishi kerak", { until: "Kelajakdagi sana tanlang" });
  const before = (await getSettings()).launchGiftUntil;
  await saveSettings({ launchGiftUntil: until });
  await audit(session.sub, "admin_settings", { targetType: "platform_settings", meta: { before: { launchGiftUntil: before }, after: { launchGiftUntil: until } } }, req);
  return ok(await launchGiftStats());
});

export const POST = handler(async (req) => {
  const session = await requireSession(["admin"]);
  await parseBody(req, postSchema);
  const stats = await launchGiftStats();
  if (!stats.active) throw new ApiError(409, "Avval aksiyani yoqing (tugash sanasini belgilang)");
  const granted = await grantLaunchGiftToAll();
  await audit(session.sub, "admin_launch_gift", { targetType: "platform_settings", meta: { granted } }, req);
  return ok({ ...(await launchGiftStats()), granted });
});

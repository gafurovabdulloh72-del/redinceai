import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { getVerifiedSession } from "@/lib/auth";
import { isPushEnabled, pushPublicKey } from "@/lib/push/web-push";
import { pushDeviceCount, removePushSubscription, savePushSubscription } from "@/lib/push/service";

export const runtime = "nodejs";

/** GET — push yoqilganmi, VAPID ochiq kaliti va shu hisobdagi qurilmalar soni */
export const GET = handler(async () => {
  const me = await getVerifiedSession();
  return ok({ enabled: isPushEnabled(), key: isPushEnabled() ? pushPublicKey() : null, devices: me ? await pushDeviceCount(me.sub) : 0 });
});

const bodySchema = z.object({
  endpoint: z.string().min(10).max(500),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(10).max(80) }),
});

/** POST — brauzer obunasini saqlash (har qurilma uchun alohida) */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, bodySchema);
  await savePushSubscription(session.sub, { endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: req.headers.get("user-agent") });
  return ok({ saved: true, devices: await pushDeviceCount(session.sub) });
});

const delSchema = z.object({ endpoint: z.string().min(10).max(500) });

/** DELETE — shu qurilmada push'ni o'chirish */
export const DELETE = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, delSchema);
  await removePushSubscription(session.sub, input.endpoint);
  return ok({ removed: true, devices: await pushDeviceCount(session.sub) });
});

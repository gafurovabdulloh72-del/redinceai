import { handler, ok, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { pushToUser } from "@/lib/push/service";

export const runtime = "nodejs";

/** POST — o'ziga sinov push yuborish (sozlashni tekshirish uchun) */
export const POST = handler(async () => {
  const session = await requireSession();
  await enforceLimit("pushTest", session.sub);
  const r = await pushToUser(session.sub, { title: "Kasb Egalari", body: "Push bildirishnomalar ishlayapti ✅", href: "/kabinet/bildirishnomalar", tag: "test" });
  return ok(r);
});

import { handler, ok, requireSession } from "@/lib/api";
import { isCallEnabled } from "@/lib/rtc/livekit";
import { getIncoming } from "@/lib/call/service";

export const runtime = "nodejs";

/** Men uchun aktiv kiruvchi qo'ng'iroq (jiringlamoqda) — global CallCenter polling qiladi. */
export const GET = handler(async () => {
  const session = await requireSession();
  if (!isCallEnabled()) return ok({ incoming: null });
  const incoming = await getIncoming(session.sub);
  return ok({ incoming });
});

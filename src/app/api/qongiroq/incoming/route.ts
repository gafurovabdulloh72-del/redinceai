import { handler, ok, requireSession } from "@/lib/api";
import { isCallEnabled } from "@/lib/rtc/livekit";
import { getIncoming } from "@/lib/call/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "cache-control": "no-store, max-age=0" } } as const;

/** Men uchun aktiv kiruvchi qo'ng'iroq (jiringlamoqda) — global CallCenter polling qiladi. */
export const GET = handler(async () => {
  const session = await requireSession();
  if (!isCallEnabled()) return ok({ incoming: null }, NO_STORE);
  const incoming = await getIncoming(session.sub);
  return ok({ incoming }, NO_STORE);
});

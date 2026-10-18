import { handler, ok, requireSession } from "@/lib/api";
import { unreadDmCount } from "@/lib/chat/dm";

/** GET — o'qilmagan DM xabarlar soni (PWA app badge va yon panel sinxroni uchun yengil so'rov) */
export const GET = handler(async () => {
  const session = await requireSession();
  return ok({ count: await unreadDmCount(session.sub) });
});

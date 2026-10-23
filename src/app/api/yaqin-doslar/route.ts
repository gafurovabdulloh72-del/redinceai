import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { listCloseFriends, toggleCloseFriend } from "@/lib/social/instagram";
import { enforceLimit } from "@/lib/security/rate-limit";

/** GET: yaqin do'stlar ro'yxati (faqat egasiga). POST {userId}: qo'shish / olib tashlash */
export const GET = handler(async () => {
  const session = await requireSession();
  return ok({ items: await listCloseFriends(session.sub) });
});

export const POST = handler(async (req) => {
  const session = await requireSession();
  const { userId } = await parseBody(req, z.object({ userId: z.string().min(1).max(64) }));
  await enforceLimit("social", session.sub);
  return ok(await toggleCloseFriend(session.sub, userId));
});

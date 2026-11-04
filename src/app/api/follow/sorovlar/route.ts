import { handler, ok, requireSession } from "@/lib/api";
import { listFollowRequests } from "@/lib/privacy/private-profile";

/** GET: menga kelgan obuna so'rovlari (yopiq profil) — Kabinet → Obunalar → So'rovlar */
export const GET = handler(async () => {
  const session = await requireSession();
  return ok({ items: await listFollowRequests(session.sub) });
});

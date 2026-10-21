import { handler, ok, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { searchTracks } from "@/lib/music/service";

/** GET /api/music?q= — musiqa kutubxonasi qidiruvi (kirgan foydalanuvchi; so'rovsiz — ommabop treklar) */
export const GET = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("mention", session.sub);
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return ok({ items: await searchTracks(q.slice(0, 60)) });
});

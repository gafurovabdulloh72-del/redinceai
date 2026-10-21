import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { listTracksAdmin, setTrackHidden } from "@/lib/music/service";

export const GET = handler(async () => {
  await requireSession(["admin"]);
  return ok({ items: await listTracksAdmin() });
});

/** PATCH { id, isHidden } — trekni kutubxonadan yashirish/qaytarish (mavjud story/postlarga tegmaydi) */
export const PATCH = handler(async (req) => {
  await requireSession(["admin"]);
  const input = await parseBody(req, z.object({ id: z.string().min(1).max(64), isHidden: z.boolean() }));
  await setTrackHidden(input.id, input.isHidden);
  return ok({ id: input.id, isHidden: input.isHidden });
});

import { z } from "zod";
import { handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { canSeeHighlightsOf, createHighlight, listHighlights } from "@/lib/social/instagram";
import { optionalViewer } from "@/app/api/groups/_lib";
import { enforceLimit } from "@/lib/security/rate-limit";

/** GET ?user=<id> — ommaviy Highlights ro'yxati. POST {title} — yangi to'plam */
export const GET = handler(async (req) => {
  const { user } = parseQuery(req.url, z.object({ user: z.string().max(64).optional() }));
  if (user) {
    const viewer = await optionalViewer();
    // Yopiq profil / blok / bloklangan hisob — bo'sh ro'yxat (mavjudligi ham bilinmaydi)
    return ok({ items: (await canSeeHighlightsOf(viewer, user)) ? await listHighlights(user) : [] });
  }
  const session = await requireSession();
  return ok({ items: await listHighlights(session.sub) });
});

export const POST = handler(async (req) => {
  const session = await requireSession();
  const { title } = await parseBody(req, z.object({ title: z.string().trim().min(1).max(40) }));
  await enforceLimit("social", session.sub);
  return ok(await createHighlight(session.sub, title), { status: 201 });
});

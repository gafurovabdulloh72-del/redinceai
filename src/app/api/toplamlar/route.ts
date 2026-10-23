import { z } from "zod";
import { handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { optionalViewer } from "@/app/api/groups/_lib";
import { COLLECTION_DESC_MAX, COLLECTION_TITLE_MAX, createCollection, listCollections } from "@/lib/social/library";
import { enforceLimit } from "@/lib/security/rate-limit";

const query = z.object({ user: z.string().max(64).optional() });
const createSchema = z.object({
  title: z.string().trim().min(1, "Nom kiriting").max(COLLECTION_TITLE_MAX),
  description: z.string().trim().max(COLLECTION_DESC_MAX).optional(),
  isPublic: z.boolean().optional(),
});

/** GET ?user=<id> — o'sha foydalanuvchining ommaviy to'plamlari; usersiz — o'zimniki (yopiqlari bilan) */
export const GET = handler(async (req) => {
  const { user } = parseQuery(req.url, query);
  const viewer = await optionalViewer();
  if (user) return ok({ items: await listCollections(user, viewer?.id !== user && viewer?.role !== "admin") });
  const session = await requireSession();
  return ok({ items: await listCollections(session.sub, false) });
});

/** POST: yangi to'plam (pleylist) */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, createSchema);
  await enforceLimit("social", session.sub);
  return ok(await createCollection(session.sub, input), { status: 201 });
});

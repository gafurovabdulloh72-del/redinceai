import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { listMutedAuthors, setAuthorMuted } from "@/lib/groups/posts-extra";
import { enforceLimit } from "@/lib/security/rate-limit";

const schema = z.object({ authorId: z.string().trim().min(1).max(64), muted: z.boolean().optional().default(true) });

/** GET: men lentadan yashirgan mualliflar (qisqa DTO) */
export const GET = handler(async () => {
  const session = await requireSession();
  return ok({ items: await listMutedAuthors(session.sub) });
});

/** POST { authorId, muted } — muallifni bosh sahifa lentasidan yashirish / qaytarish (obuna va blokka tegmaydi) */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, schema);
  await enforceLimit("feedActions", session.sub);
  return ok(await setAuthorMuted(session.sub, input.authorId, input.muted));
});

import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { createFolder, listFolders } from "@/lib/chat/dm";

/** GET — mening chat papkalarim (har birida nechta suhbat) */
export const GET = handler(async () => {
  const session = await requireSession();
  return ok({ items: await listFolders(session.sub) });
});

const schema = z.object({ name: z.string().trim().min(1).max(24) });

/** POST — yangi papka */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, schema);
  await enforceLimit("social", session.sub);
  return ok(await createFolder(session.sub, input.name));
});

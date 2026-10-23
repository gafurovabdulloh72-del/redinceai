import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { setFollowNotifyLevel } from "@/lib/groups/service";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ userId: string }> };

/** POST {level}: obuna qo'ng'irog'i — all (har post) | highlights (faqat efir/muhim) | off (jim) */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { userId } = await ctx.params;
  const { level } = await parseBody(req, z.object({ level: z.enum(["all", "highlights", "off"]) }));
  await enforceLimit("social", session.sub);
  return ok(await setFollowNotifyLevel(session.sub, userId, level));
});

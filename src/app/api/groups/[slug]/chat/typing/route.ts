import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { assertActiveMember, setGroupTyping } from "@/lib/groups/service";
import { enforceLimit } from "@/lib/security/rate-limit";
import { groupOr404 } from "../../../_lib";

const schema = z.object({ typing: z.boolean().default(true) });

/** POST { typing } — guruh chatida "yozmoqda…" signali (faqat faol a'zolar) */
export const POST = handler(async (req, ctx: { params: Promise<{ slug: string }> }) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  const input = await parseBody(req, schema);
  await enforceLimit("typing", session.sub);
  const group = await groupOr404(slug);
  await assertActiveMember(group, { id: session.sub, role: session.role });
  await setGroupTyping(group.id, session.sub, input.typing);
  return ok({ typing: input.typing });
});

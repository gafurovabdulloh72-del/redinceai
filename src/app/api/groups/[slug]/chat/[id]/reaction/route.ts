import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { DM_REACTIONS } from "@/lib/chat/constants";
import { assertActiveMember, reactGroupMessage } from "@/lib/groups/service";
import { enforceLimit } from "@/lib/security/rate-limit";
import { groupOr404 } from "../../../../_lib";

const schema = z.object({ emoji: z.enum(DM_REACTIONS).nullable() });

/** PUT { emoji | null } — guruh chati xabariga reaksiya qo'yish/almashtirish yoki olib tashlash (faqat faol a'zolar). Javob: xabar reaksiyalari yig'indisi */
export const PUT = handler(async (req, ctx: { params: Promise<{ slug: string; id: string }> }) => {
  const session = await requireSession();
  const { slug, id } = await ctx.params;
  const input = await parseBody(req, schema);
  const group = await groupOr404(slug);
  await assertActiveMember(group, { id: session.sub, role: session.role });
  await enforceLimit("social", session.sub);
  return ok({ id, reactions: await reactGroupMessage(group, session.sub, id, input.emoji) });
});

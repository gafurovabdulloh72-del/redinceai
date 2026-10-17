import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { assertActiveMember, setMuted } from "@/lib/groups/service";
import { groupOr404 } from "../../_lib";

type Ctx = { params: Promise<{ slug: string }> };

/** POST {muted}: jamoa bildirishnomalarini o'chirish/yoqish — a'zolik saqlanadi (rasmiy kanal uchun ham) */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  const { muted } = await parseBody(req, z.object({ muted: z.boolean() }));
  const group = await groupOr404(slug);
  await assertActiveMember(group, { id: session.sub, role: session.role });
  await setMuted(group, session.sub, muted);
  return ok({ muted });
});

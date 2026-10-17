import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { assertCanManage, ensureInviteCode } from "@/lib/groups/service";
import { audit } from "@/lib/security/audit";
import { groupOr404 } from "../../_lib";

type Ctx = { params: Promise<{ slug: string }> };

/** POST {rotate?}: taklif havolasi kodi (egasi/admin). rotate — eski havolani bekor qiladi */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  const { rotate } = await parseBody(req, z.object({ rotate: z.boolean().optional().default(false) }));
  const group = await groupOr404(slug);
  await assertCanManage(group, { id: session.sub, role: session.role });
  const code = await ensureInviteCode(group, rotate);
  if (rotate) await audit(session.sub, "group_invite_rotate", { targetType: "group", targetId: group.id }, req);
  return ok({ code, path: `/jamoalar/${group.slug}?invite=${code}` });
});

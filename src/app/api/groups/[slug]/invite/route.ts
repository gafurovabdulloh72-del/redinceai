import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { assertCanManage, ensureInviteCode } from "@/lib/groups/service";
import { INVITE_EXPIRY_OPTIONS } from "@/lib/groups/limits";
import { inviteSchema } from "@/lib/groups/validators";
import { audit } from "@/lib/security/audit";
import { groupOr404 } from "../../_lib";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * POST {rotate?, expiresIn?: 1d|7d|never, maxUses?: 10|50|null}: taklif havolasi (egasi/admin).
 * rotate — eski havolani bekor qiladi (hisob 0 dan); muddat/limit berilsa yangi qoida saqlanadi.
 */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  const input = await parseBody(req, inviteSchema);
  const group = await groupOr404(slug);
  await assertCanManage(group, { id: session.sub, role: session.role });
  const expiresInMs = input.expiresIn === undefined ? undefined : (INVITE_EXPIRY_OPTIONS.find((o) => o.key === input.expiresIn)?.ms ?? null);
  const info = await ensureInviteCode(group, input.rotate, { expiresInMs, maxUses: input.maxUses });
  if (input.rotate) await audit(session.sub, "group_invite_rotate", { targetType: "group", targetId: group.id }, req);
  return ok({ ...info, path: `/jamoalar/${group.slug}?invite=${info.code}` });
});

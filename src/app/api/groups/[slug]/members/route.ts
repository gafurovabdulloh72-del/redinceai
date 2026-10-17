import { z } from "zod";
import { handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { assertCanManage, assertCanView, listMembers, memberAction } from "@/lib/groups/service";
import { memberActionSchema } from "@/lib/groups/validators";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";
import { groupOr404, optionalViewer } from "../../_lib";

type Ctx = { params: Promise<{ slug: string }> };
const querySchema = z.object({ status: z.enum(["active", "pending"]).optional().default("active") });

/** GET: a'zolar (?status=pending — faqat egasi/admin uchun) */
export const GET = handler(async (req, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const { status } = parseQuery(req.url, querySchema);
  const group = await groupOr404(slug);
  const viewer = await optionalViewer();
  if (status === "pending") await assertCanManage(group, viewer);
  else await assertCanView(group, viewer);
  return ok({ items: await listMembers(group.id, status) });
});

/** PATCH: {userId, action: approve|reject|remove|promote|demote} — moderator amallari */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  const input = await parseBody(req, memberActionSchema);
  await enforceLimit("social", session.sub);
  const group = await groupOr404(slug);
  await memberAction(group, { id: session.sub, role: session.role }, input.userId, input.action);
  await audit(session.sub, "group_member", { targetType: "group", targetId: group.id, meta: { action: input.action, userId: input.userId } }, req);
  return ok({ done: true });
});

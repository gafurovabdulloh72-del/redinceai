import { ApiError, handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { approveAllPending, assertCanManage, assertCanView, isGroupOwner, listMembers, memberAction, membersCsv } from "@/lib/groups/service";
import { memberActionSchema, membersQuerySchema } from "@/lib/groups/validators";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";
import { groupOr404, optionalViewer } from "../../_lib";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * GET: a'zolar (?status=pending|banned — faqat egasi/admin); ?format=csv — faqat egasi (kontaktlarsiz: ism, taxallus, rol, sana).
 */
export const GET = handler(async (req, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const { status, format } = parseQuery(req.url, membersQuerySchema);
  const group = await groupOr404(slug);
  const viewer = await optionalViewer();
  if (format === "csv") {
    if (!isGroupOwner(group, viewer)) throw new ApiError(403, "Eksport faqat egasiga");
    const csv = await membersCsv(group.id);
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${group.slug}-azolar.csv"`, "cache-control": "private, no-store" } });
  }
  if (status !== "active") await assertCanManage(group, viewer);
  else await assertCanView(group, viewer);
  return ok({ items: await listMembers(group.id, status) });
});

/** PATCH: {userId, action: approve|reject|remove|promote|demote|unban} yoki {action: "approve_all"} — moderator amallari */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  const input = await parseBody(req, memberActionSchema);
  await enforceLimit("social", session.sub);
  const group = await groupOr404(slug);
  const actor = { id: session.sub, role: session.role };
  if (input.action === "approve_all") {
    const n = await approveAllPending(group, actor);
    await audit(session.sub, "group_member", { targetType: "group", targetId: group.id, meta: { action: "approve_all", count: n } }, req);
    return ok({ done: true, count: n });
  }
  await memberAction(group, actor, input.userId, input.action);
  await audit(session.sub, "group_member", { targetType: "group", targetId: group.id, meta: { action: input.action, userId: input.userId } }, req);
  return ok({ done: true });
});

import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { decideFollowRequest } from "@/lib/privacy/private-profile";

const schema = z.object({ action: z.enum(["approve", "reject"]) });

/** PATCH: obuna so'rovini tasdiqlash / rad etish — faqat so'rov egasi (toUserId = men); begona → 404 */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { action } = await parseBody(req, schema);
  await enforceLimit("social", session.sub);
  return ok(await decideFollowRequest(session.sub, id, action === "approve"));
});

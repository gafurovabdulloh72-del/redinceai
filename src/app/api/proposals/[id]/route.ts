import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceJobLimit } from "@/lib/jobs/server";
import { acceptProposal, reviewProposal, withdrawProposal } from "@/lib/jobs/service";
import { proposalActionSchema } from "@/lib/jobs/validators";

type Ctx = { params: Promise<{ id: string }> };

/**
 * { action: "shortlist" | "decline" | "accept" } — e'lon egasi; { action: "withdraw" } — taklif muallifi.
 * accept: buyurtma yaratiladi (narx = taklif summasi, to'lov kutilmoqda), qolgan takliflar rad etiladi, e'lon → hired.
 */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession(["client", "specialist"]);
  const { id } = await ctx.params;
  const { action, contactPhone } = await parseBody(req, proposalActionSchema);
  await enforceJobLimit("proposalAct", session.sub);
  switch (action) {
    case "withdraw":
      return ok(await withdrawProposal(session, id));
    case "accept":
      return ok(await acceptProposal(session, id, contactPhone || undefined, req));
    default:
      return ok(await reviewProposal(session, id, action));
  }
});

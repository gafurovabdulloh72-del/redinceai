import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceJobLimit } from "@/lib/jobs/server";
import { createProposal } from "@/lib/jobs/service";
import { proposalInputSchema } from "@/lib/jobs/validators";

/**
 * Mutaxassis e'longa taklif yuboradi: bitta e'longa bitta taklif, kuniga PROPOSAL_DAILY_LIMIT ta (server hisobi),
 * obuna faol bo'lishi shart (canReceiveOrders) — aks holda 403.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  if (session.role !== "specialist" && session.role !== "admin") throw new ApiError(403, "Taklifni faqat mutaxassislar yuboradi");
  const input = await parseBody(req, proposalInputSchema);
  await enforceJobLimit("proposals", session.sub);
  const result = await createProposal(session, input);
  return ok(result, { status: 201 });
});

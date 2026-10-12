import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceEditLimit, reorderPortfolio, reorderSchema } from "../_shared";

/** Portfolio tartibi: {ids} — egasining barcha ishlari yangi tartibda (birinchisi profil muqovasida) */
export const PUT = handler(async (req) => {
  const session = await requireSession(["specialist", "admin"]);
  const { ids } = await parseBody(req, reorderSchema);
  await enforceEditLimit(session.sub);
  return ok({ reordered: await reorderPortfolio(session.sub, ids) });
});

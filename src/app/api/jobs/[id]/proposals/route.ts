import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { getJobRow, listJobProposalsForOwner } from "@/lib/jobs/queries";

type Ctx = { params: Promise<{ id: string }> };

/** E'lon egasi uchun takliflar (mutaxassis — maskalangan ro'yxat DTO'si, toListItem) */
export const GET = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const job = await getJobRow(id);
  if (!job) throw new ApiError(404, "E'lon topilmadi");
  if (job.clientId !== session.sub) throw new ApiError(403, "Takliflarni faqat e'lon egasi ko'radi");
  const items = await listJobProposalsForOwner(id, { userId: session.sub, role: session.role });
  return ok({ items });
});

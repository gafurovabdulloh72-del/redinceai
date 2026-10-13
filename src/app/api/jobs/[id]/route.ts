import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { getJobRow, toJobPublic } from "@/lib/jobs/queries";
import { enforceJobLimit } from "@/lib/jobs/server";
import { editJob, setJobOpen } from "@/lib/jobs/service";
import { jobPatchSchema } from "@/lib/jobs/validators";

type Ctx = { params: Promise<{ id: string }> };

/** Bitta e'lon (ommaviy DTO). Bloklangan mijozniki — 404; isOwner — joriy foydalanuvchi egasimi */
export const GET = handler(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const job = await getJobRow(id);
  if (!job || job.client.isBanned) throw new ApiError(404, "E'lon topilmadi");
  const session = await getSession();
  return ok({ ...toJobPublic(job), isOwner: Boolean(session && session.sub === job.clientId) });
});

/**
 * Egasi: { action: "edit", ...maydonlar } | { action: "close" } | { action: "reopen" }.
 * Admin faqat yopa oladi (moderatsiya, audit yoziladi). Mutaxassis tanlangan (hired) e'lon o'zgarmaydi.
 */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession(["client", "admin"]);
  const { id } = await ctx.params;
  const patch = await parseBody(req, jobPatchSchema);
  await enforceJobLimit("jobEdit", session.sub);
  if (patch.action === "edit") {
    const { action: _action, ...input } = patch;
    void _action;
    return ok(await editJob(session, id, input));
  }
  return ok(await setJobOpen(session, id, patch.action === "reopen", req));
});

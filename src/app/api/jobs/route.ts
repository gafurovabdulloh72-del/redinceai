import { ApiError, handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { listJobs } from "@/lib/jobs/queries";
import { enforceJobLimit } from "@/lib/jobs/server";
import { createJob } from "@/lib/jobs/service";
import { jobFilterSchema, jobInputSchema } from "@/lib/jobs/validators";

/** Ochiq e'lonlar ro'yxati (ommaviy): q, category, region (slug | remote), min, max, sort, page, limit */
export const GET = handler(async (req) => {
  const filter = parseQuery(req.url, jobFilterSchema);
  const result = await listJobs(filter);
  return ok(result);
});

/** Mijoz yangi e'lon joylaydi (kuniga 10 ta); muddat — JOB_TTL_DAYS kun */
export const POST = handler(async (req) => {
  const session = await requireSession();
  if (session.role !== "client") throw new ApiError(403, "E'lonni faqat mijozlar joylaydi");
  const input = await parseBody(req, jobInputSchema);
  await enforceJobLimit("jobs", session.sub);
  const { id } = await createJob(session, input);
  return ok({ id, href: `/ishlar/${id}` }, { status: 201 });
});

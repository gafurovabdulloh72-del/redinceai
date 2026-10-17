import { handler, ok, parseQuery } from "@/lib/api";
import { listResumes } from "@/lib/vacancies/service";
import { resumeFilterSchema } from "@/lib/vacancies/validators";

/** GET: ommaviy rezyumelar katalogi (kontaktsiz — aloqa sayt ichidagi chat orqali) */
export const GET = handler(async (req) => {
  const filter = parseQuery(req.url, resumeFilterSchema);
  return ok(await listResumes(filter));
});

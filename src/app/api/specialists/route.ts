import { handler, ok, parseQuery } from "@/lib/api";
import { listSpecialists } from "@/lib/queries";
import { specialistFilterSchema } from "@/lib/validators";

export const GET = handler(async (req) => {
  const filter = parseQuery(req.url, specialistFilterSchema);
  const result = await listSpecialists(filter);
  return ok(result);
});

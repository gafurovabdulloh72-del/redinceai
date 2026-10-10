import { handler, ok, parseQuery } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { listSpecialists } from "@/lib/queries";
import { specialistFilterSchema } from "@/lib/validators";

/** Ro'yxat — elementlarda telefon/email/aloqa vositalari hech qachon bo'lmaydi */
export const GET = handler(async (req) => {
  const filter = parseQuery(req.url, specialistFilterSchema);
  const session = await getSession();
  const result = await listSpecialists(filter, { userId: session?.sub ?? null, role: session?.role ?? null });
  return ok(result);
});

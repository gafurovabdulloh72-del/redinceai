import { handler, ok, requireSession } from "@/lib/api";
import { listSavedCourses } from "@/lib/mentorship/service";

/** GET — mening saqlangan kurslarim */
export const GET = handler(async () => {
  const session = await requireSession();
  return ok({ items: await listSavedCourses(session.sub) });
});

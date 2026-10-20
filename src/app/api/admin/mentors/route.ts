import { handler, ok, requireSession } from "@/lib/api";
import { listPendingMentors } from "@/lib/mentorship/service";

/** GET — tasdiq kutayotgan mentor arizalari (admin) */
export const GET = handler(async () => {
  await requireSession(["admin"]);
  return ok({ items: await listPendingMentors() });
});

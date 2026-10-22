import { handler, ok, requireSession } from "@/lib/api";
import { myRefCode, referralStats } from "@/lib/mentorship/purchases";

/** GET — mening tavsiya kodim va kredit holatim */
export const GET = handler(async () => {
  const session = await requireSession();
  return ok({ code: await myRefCode(session.sub), ...(await referralStats(session.sub)) });
});

import { handler, ok, requireSession } from "@/lib/api";
import { quotaFor } from "@/lib/social/quota";

/** GET: mening post/story kvotam (premium bo'lsa limit null) — kompozitor ko'rsatkichi uchun */
export const GET = handler(async () => {
  const session = await requireSession();
  return ok(await quotaFor(session.sub));
});

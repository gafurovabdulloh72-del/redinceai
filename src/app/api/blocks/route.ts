import { handler, ok, requireSession } from "@/lib/api";
import { listBlocked } from "@/lib/privacy/blocks";

/** GET: men bloklagan foydalanuvchilar (faqat egasiga) */
export const GET = handler(async () => {
  const session = await requireSession();
  return ok({ items: await listBlocked(session.sub) });
});

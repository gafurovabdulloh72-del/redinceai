import { eq } from "drizzle-orm";
import { handler, ok, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * Telegram'dan uzish: telegramChatId null qilinadi (botda /stop bilan bir xil natija).
 * Bot sozlanmagan bo'lsa ham ishlaydi — eski bog'lanishni tozalash foydali.
 */
export const POST = handler(async () => {
  const session = await requireSession();
  await db.update(users).set({ telegramChatId: null }).where(eq(users.id, session.sub));
  return ok({ unlinked: true });
});

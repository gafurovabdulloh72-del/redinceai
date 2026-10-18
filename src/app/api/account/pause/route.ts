import { eq } from "drizzle-orm";
import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";

const schema = z.object({ paused: z.boolean() });

/** GET: hisob pauzadami */
export const GET = handler(async () => {
  const session = await requireSession();
  const u = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { isPaused: true } });
  return ok({ paused: u?.isPaused ?? false });
});

/**
 * PUT {paused}: hisobni vaqtincha pauza qilish — profil katalog/xarita/qidiruvda chiqmaydi (listableCondition `users.is_paused = 0`),
 * to'g'ridan-to'g'ri havola, mavjud buyurtmalar va chat ishlayveradi. Qaytarish — paused:false.
 */
export const PUT = handler(async (req) => {
  const session = await requireSession();
  const { paused } = await parseBody(req, schema);
  await enforceLimit("privacy", session.sub);
  await db.update(users).set({ isPaused: paused }).where(eq(users.id, session.sub));
  await audit(session.sub, "privacy_update", { targetType: "user", targetId: session.sub, meta: { paused } }, req);
  return ok({ paused });
});

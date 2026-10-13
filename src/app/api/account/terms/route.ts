import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { handler, ok, requireSession } from "@/lib/api";
import { TERMS_VERSION } from "@/lib/constants";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";

/** Yangilangan oferta va maxfiylik siyosatini qabul qilish (TermsBanner). Idempotent; rate limit: 20 / soat. */
export const POST = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("terms", session.sub);
  const user = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { termsVersion: true } });
  if (user?.termsVersion === TERMS_VERSION) return ok({ accepted: true, version: TERMS_VERSION, already: true });
  await db.update(users).set({ termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() }).where(eq(users.id, session.sub));
  await audit(session.sub, "terms_accepted", { targetType: "user", targetId: session.sub, meta: { version: TERMS_VERSION, previous: user?.termsVersion ?? null } }, req);
  return ok({ accepted: true, version: TERMS_VERSION });
});

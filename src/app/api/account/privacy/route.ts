import { eq } from "drizzle-orm";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";
import { privacySchema } from "@/lib/validators";

/** GET: maxfiylik sozlamalarim; PUT: yangilash (kim yozishi mumkin, kim izoh yozadi, onlayn holat) */
export const GET = handler(async () => {
  const session = await requireSession();
  const u = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { dmPolicy: true, commentPolicy: true, showOnline: true } });
  return ok(u ?? { dmPolicy: "all", commentPolicy: "all", showOnline: true });
});

export const PUT = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, privacySchema);
  await enforceLimit("blocks", session.sub);
  await db.update(users).set({ dmPolicy: input.dmPolicy, commentPolicy: input.commentPolicy, showOnline: input.showOnline }).where(eq(users.id, session.sub));
  await audit(session.sub, "privacy_update", { targetType: "user", targetId: session.sub, meta: input }, req);
  return ok(input);
});

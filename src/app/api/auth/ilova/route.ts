import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { DESKTOP_CHALLENGE_RE, createDesktopCode } from "@/lib/auth";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";

const schema = z.strictObject({ challenge: z.string().regex(DESKTOP_CHALLENGE_RE) });

/**
 * POST /api/auth/ilova — brauzerda kirgan foydalanuvchi kompyuter ilovasiga qaytish kodini oladi (`/ilova/ulash` tugmasi).
 * Kod faqat ilova yaratgan verifier bilan almashtiriladi (auth.ts `createDesktopCode` izohi).
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const { challenge } = await parseBody(req, schema);
  const user = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { id: true, sessionVersion: true } });
  if (!user) throw new ApiError(401, "Avval tizimga kiring");
  const code = await createDesktopCode(user, challenge);
  await audit(user.id, "desktop_link", { targetType: "user", targetId: user.id }, req);
  return ok({ url: `kasbegalari://auth?code=${encodeURIComponent(code)}` });
});

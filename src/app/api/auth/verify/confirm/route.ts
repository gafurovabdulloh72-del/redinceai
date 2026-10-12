import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";
import { consumeEmailVerification } from "@/lib/security/verify";

const schema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "6 xonali kodni kiriting") });

/**
 * Kodni tekshirib emailni tasdiqlash. Kod bir martalik; 10 urinish / 15 daqiqa (6 xonali kodni terib bo'lmasin).
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("verifyConfirm", session.sub);
  const input = await parseBody(req, schema);

  const user = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { id: true, emailVerified: true } });
  if (!user) throw new ApiError(401, "Foydalanuvchi topilmadi");
  if (user.emailVerified) return ok({ verified: true, already: true });

  const valid = await consumeEmailVerification(user.id, input.code);
  if (!valid) throw new ApiError(400, "Kod noto'g'ri yoki eskirgan. Yangi kod so'rang", { code: "Kod noto'g'ri yoki eskirgan" });

  await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));
  await audit(user.id, "email_verified", { targetType: "user", targetId: user.id }, req);
  return ok({ verified: true });
});

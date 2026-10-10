import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createSession } from "@/lib/auth";
import { ApiError, handler, ok, parseBody } from "@/lib/api";
import { registerSchema } from "@/lib/validators";
import { uid } from "@/lib/utils";
import { audit } from "@/lib/security/audit";
import { hashPassword } from "@/lib/security/password";
import { clientIp, enforceLimit } from "@/lib/security/rate-limit";

/**
 * Ro'yxatdan o'tish. Mutaxassis uchun bo'sh "placeholder" profil YARATILMAYDI —
 * profil kabinetda (PUT /api/profile) to'ldirilgach ommaviy ro'yxatda paydo bo'ladi.
 * Parol siyosati: 8+ belgi, harf + raqam (validators.strongPassword). Rate limit: 3 / soat / ip.
 */
export const POST = handler(async (req) => {
  await enforceLimit("register", clientIp(req));
  const input = await parseBody(req, registerSchema);

  const exists = await db.query.users.findFirst({ where: eq(users.email, input.email), columns: { id: true } });
  if (exists) throw new ApiError(409, "Bu email allaqachon ro'yxatdan o'tgan", { email: "Email band" });

  const id = uid();
  await db.insert(users).values({
    id,
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    gender: input.gender ?? null,
    passwordHash: await hashPassword(input.password),
    role: input.role,
    lastLoginAt: new Date(),
  });

  await audit(id, "register", { targetType: "user", targetId: id, meta: { role: input.role } }, req);
  await createSession({ id, role: input.role, name: input.name, sessionVersion: 1 }, { remember: true });
  return ok({ id, name: input.name, role: input.role }, { status: 201 });
});

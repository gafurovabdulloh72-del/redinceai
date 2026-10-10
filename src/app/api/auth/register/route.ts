import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createSession, hashPassword } from "@/lib/auth";
import { ApiError, handler, ok, parseBody } from "@/lib/api";
import { registerSchema } from "@/lib/validators";
import { uid } from "@/lib/utils";

/**
 * Ro'yxatdan o'tish. Mutaxassis uchun bo'sh "placeholder" profil YARATILMAYDI —
 * profil kabinetda (PUT /api/profile) to'ldirilgach ommaviy ro'yxatda paydo bo'ladi.
 */
export const POST = handler(async (req) => {
  const input = await parseBody(req, registerSchema);

  const exists = await db.query.users.findFirst({ where: eq(users.email, input.email), columns: { id: true } });
  if (exists) throw new ApiError(409, "Bu email allaqachon ro'yxatdan o'tgan", { email: "Email band" });

  const id = uid();
  await db.insert(users).values({
    id,
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    passwordHash: await hashPassword(input.password),
    role: input.role,
  });

  await createSession({ id, role: input.role, name: input.name });
  return ok({ id, name: input.name, role: input.role }, { status: 201 });
});

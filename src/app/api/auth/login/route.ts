import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createSession, verifyPassword } from "@/lib/auth";
import { ApiError, handler, ok, parseBody } from "@/lib/api";
import { loginSchema } from "@/lib/validators";

export const POST = handler(async (req) => {
  const input = await parseBody(req, loginSchema);
  const user = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new ApiError(401, "Email yoki parol noto'g'ri");
  }
  await createSession(user);
  return ok({ id: user.id, name: user.name, role: user.role });
});

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { specialists, users } from "@/lib/db/schema";
import { createSession, hashPassword } from "@/lib/auth";
import { ApiError, handler, ok, parseBody } from "@/lib/api";
import { registerSchema } from "@/lib/validators";
import { slugify, uid } from "@/lib/utils";
import { REGIONS } from "@/lib/constants";

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

  // Mutaxassis uchun bo'sh profil yaratamiz — keyin kabinetda to'ldiradi
  if (input.role === "specialist") {
    const base = slugify(input.name) || "mutaxassis";
    await db.insert(specialists).values({
      id: uid(),
      userId: id,
      slug: `${base}-${id.slice(0, 6)}`,
      title: `${input.name} — yangi mutaxassis`,
      category: "videograf",
      regionSlug: REGIONS[0].slug,
      city: REGIONS[0].capital,
      isAvailable: false,
    });
  }

  await createSession({ id, role: input.role, name: input.name });
  return ok({ id, name: input.name, role: input.role }, { status: 201 });
});

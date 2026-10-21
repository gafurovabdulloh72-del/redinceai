import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { joinOfficialChannels } from "@/lib/groups/service";
import { users } from "@/lib/db/schema";
import { createSession } from "@/lib/auth";
import { ApiError, handler, ok, parseBody } from "@/lib/api";
import { TERMS_VERSION } from "@/lib/constants";
import { registerSchema } from "@/lib/validators";
import { uid } from "@/lib/utils";
import { generateUsername } from "@/lib/chat/username";
import { audit } from "@/lib/security/audit";
import { hashPassword } from "@/lib/security/password";
import { clientIp, enforceLimit } from "@/lib/security/rate-limit";

/**
 * Ro'yxatdan o'tish. Mutaxassis uchun bo'sh "placeholder" profil YARATILMAYDI —
 * profil kabinetda (PUT /api/profile) to'ldirilgach ommaviy ro'yxatda paydo bo'ladi.
 * Parol siyosati: 8+ belgi, harf + raqam (validators.strongPassword). Rate limit: 5 / soat / ip.
 * Oferta va maxfiylik siyosatiga rozilik majburiy (acceptTerms: true) — versiya va vaqt saqlanadi (F84).
 * E15: band email tasdiqlanmaydi — neytral xabar + limit 5 / soat / ip (enumeratsiyaga qarshi).
 */
const schema = registerSchema.extend({
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Oferta va maxfiylik siyosatiga rozilik bering" }) }),
});

export const POST = handler(async (req) => {
  // Avval tekshiruv, keyin limit (#51): noto'g'ri to'ldirilgan forma (422) limitni yemasin;
  // band email (409) esa limitga kiradi — enumeratsiyaga qarshi himoya saqlanadi
  const input = await parseBody(req, schema);
  await enforceLimit("register", clientIp(req));

  // E15: email bandligi tasdiqlanmaydi (enumeratsiya) — bir xil neytral javob, qattiq limit (5/soat/IP) bilan birga
  const exists = await db.query.users.findFirst({ where: eq(users.email, input.email), columns: { id: true } });
  if (exists) {
    throw new ApiError(409, "Bu ma'lumotlar bilan ro'yxatdan o'tib bo'lmadi. Agar avval hisob ochgan bo'lsangiz — «Kirish» yoki «Parolni unutdingizmi?» dan foydalaning.");
  }

  const id = uid();
  await db.insert(users).values({
    id,
    username: await generateUsername(input.name),
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    gender: input.gender ?? null,
    passwordHash: await hashPassword(input.password),
    role: input.role,
    // Yangi ijodkorga standart — haftalik jamlama (sozlamalardan o'chiriladi); mijozga o'chiq
    digestFreq: input.role === "specialist" ? "weekly" : "off",
    lastLoginAt: new Date(),
    termsVersion: TERMS_VERSION,
    termsAcceptedAt: new Date(),
  });

  // Rasmiy kanal(lar)ga avtomatik a'zolik — xato ro'yxatdan o'tishni to'xtatmasin
  await joinOfficialChannels(id).catch(() => undefined);
  await audit(id, "register", { targetType: "user", targetId: id, meta: { role: input.role, termsVersion: TERMS_VERSION } }, req);
  await createSession({ id, role: input.role, name: input.name, sessionVersion: 1 }, { remember: true });
  return ok({ id, name: input.name, role: input.role }, { status: 201 });
});

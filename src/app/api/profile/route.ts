import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { specialists, users } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { accountSchema, specialistProfileSchema } from "@/lib/validators";
import { slugify, uid } from "@/lib/utils";
import { ensureShortCode } from "@/lib/queries";
import { enforceLimit } from "@/lib/security/rate-limit";
import { verifyPassword } from "@/lib/security/password";
import { sendMail } from "@/lib/security/mailer";
import { audit } from "@/lib/security/audit";

/**
 * Mutaxassis profilini yaratish/yangilash (faqat o'zining).
 * Rol tekshirilmaydi: mijoz ham shu yerda "Mutaxassis bo'lish" orqali profil ochadi —
 * egalik session.sub bilan ta'minlanadi.
 */
export const PUT = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, specialistProfileSchema);
  // Avval tekshiruv, keyin per-user limit (E21) — 422 javoblar limitni yemasin
  await enforceLimit("profile", session.sub);

  const user = await db.query.users.findFirst({ where: eq(users.id, session.sub), with: { specialist: true } });
  if (!user) throw new ApiError(401, "Foydalanuvchi topilmadi");

  // Slug faqat birinchi yaratilishda hisoblanadi — keyin o'zgarmaydi (ulashilgan havolalar buzilmasin)
  const makeSlug = async (currentId: string) => {
    const base = slugify(user.name) || "mutaxassis";
    const taken = await db.query.specialists.findFirst({
      where: and(eq(specialists.slug, base), ne(specialists.id, currentId)),
      columns: { id: true },
    });
    return taken ? `${base}-${currentId.slice(0, 6)}` : base;
  };

  const values = {
    ...input,
    priceTo: input.priceTo || null,
    telegram: input.telegram?.replace(/^@/, "") || null,
    instagram: input.instagram?.replace(/^@/, "") || null,
    youtube: input.youtube || null,
    website: input.website || null,
    coverUrl: input.coverUrl || null,
    updatedAt: new Date(),
  };

  // packages / certificates / workTypes / rates (F31, F64, F52, F70): berilmasa — undefined, drizzle ustunga tegmaydi
  if (user.specialist) {
    await db.update(specialists).set(values).where(eq(specialists.id, user.specialist.id));
    // Qisqa havola kodi (F66) — eski profillarda yo'q bo'lsa shu yerda yaratiladi
    const shortCode = user.specialist.shortCode ?? (await ensureShortCode(user.specialist.id));
    return ok({ id: user.specialist.id, slug: user.specialist.slug, shortCode });
  }

  const id = uid();
  const slug = await makeSlug(id);
  await db.insert(specialists).values({ id, userId: user.id, slug, ...values });
  const shortCode = await ensureShortCode(id);

  // Mijoz → mutaxassis: rolni yangilaymiz va cookie'ni qayta beramiz (JWT'da eski rol qolmasin)
  if (user.role === "client") {
    await db.update(users).set({ role: "specialist" }).where(eq(users.id, user.id));
    await createSession({ id: user.id, role: "specialist", name: user.name });
  }
  return ok({ id, slug, shortCode }, { status: 201 });
});

/** "ali@mail.uz" → "a***@mail.uz" (eski manzilga yuboriladigan ogohlantirishda yangi manzil to'liq ko'rsatilmaydi) */
function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}***@${domain ?? ""}`;
}

/**
 * Umumiy akkaunt ma'lumotlari (ism, telefon, avatar, jins, email bildirishnomalari).
 * Email o'zgarsa (E35): joriy parol majburiy, emailVerified=false bo'ladi va eski manzilga ogohlantirish ketadi.
 */
export const PATCH = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, accountSchema);
  await enforceLimit("profile", session.sub);

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.sub),
    columns: { id: true, name: true, email: true, passwordHash: true },
  });
  if (!user) throw new ApiError(401, "Foydalanuvchi topilmadi");

  const nextEmail = input.email && input.email !== user.email ? input.email : null;
  if (nextEmail) {
    // Parol tekshiruvi — parol o'zgartirish bilan bir xil qattiq limit (taxmin qilib bo'lmasin)
    await enforceLimit("password", session.sub);
    if (!input.currentPassword) {
      throw new ApiError(422, "Emailni o'zgartirish uchun joriy parolni kiriting", { currentPassword: "Joriy parolni kiriting" });
    }
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new ApiError(422, "Joriy parol noto'g'ri", { currentPassword: "Joriy parol noto'g'ri" });
    }
    const taken = await db.query.users.findFirst({ where: and(eq(users.email, nextEmail), ne(users.id, user.id)), columns: { id: true } });
    if (taken) throw new ApiError(409, "Bu emailni ishlatib bo'lmaydi", { email: "Bu emailni ishlatib bo'lmaydi — boshqasini kiriting" });
  }

  await db
    .update(users)
    .set({
      name: input.name,
      phone: input.phone || null,
      avatarUrl: input.avatarUrl || null,
      // Jins: kalit yuborilmasa — tegilmaydi; null yuborilsa — "ko'rsatilmagan"
      ...(input.gender !== undefined ? { gender: input.gender ?? null } : {}),
      ...(input.notifyEmail !== undefined ? { notifyEmail: input.notifyEmail } : {}),
      ...(nextEmail ? { email: nextEmail, emailVerified: false } : {}),
    })
    .where(eq(users.id, session.sub));

  if (nextEmail) {
    await audit(user.id, "email_changed", { targetType: "user", targetId: user.id, meta: { from: maskEmail(user.email), to: maskEmail(nextEmail) } }, req);
    // Akkaunt o'g'irlanganini sezish uchun — eski manzilga qisqa xabar (xato asosiy oqimni buzmaydi)
    const masked = maskEmail(nextEmail);
    void sendMail({
      to: user.email,
      subject: "Redince: email manzilingiz o'zgartirildi",
      text: `Salom, ${user.name}!\n\nRedince akkauntingiz emaili ${masked} ga o'zgartirildi. Agar buni siz qilmagan bo'lsangiz, darhol parolingizni tiklang va biz bilan bog'laning.`,
      html: `<p>Salom!</p><p>Redince akkauntingiz emaili <b>${masked.replace(/[<>&"']/g, "")}</b> ga o'zgartirildi.</p><p>Agar buni siz qilmagan bo'lsangiz, darhol parolingizni tiklang va biz bilan bog'laning.</p>`,
    }).catch(() => {});
  }
  return ok({ updated: true, emailChanged: Boolean(nextEmail) });
});

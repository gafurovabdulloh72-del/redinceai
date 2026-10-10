import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { specialists, users } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { accountSchema, specialistProfileSchema } from "@/lib/validators";
import { slugify, uid } from "@/lib/utils";

/**
 * Mutaxassis profilini yaratish/yangilash (faqat o'zining).
 * Rol tekshirilmaydi: mijoz ham shu yerda "Mutaxassis bo'lish" orqali profil ochadi —
 * egalik session.sub bilan ta'minlanadi.
 */
export const PUT = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, specialistProfileSchema);

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

  if (user.specialist) {
    await db.update(specialists).set(values).where(eq(specialists.id, user.specialist.id));
    return ok({ id: user.specialist.id, slug: user.specialist.slug });
  }

  const id = uid();
  const slug = await makeSlug(id);
  await db.insert(specialists).values({ id, userId: user.id, slug, ...values });

  // Mijoz → mutaxassis: rolni yangilaymiz va cookie'ni qayta beramiz (JWT'da eski rol qolmasin)
  if (user.role === "client") {
    await db.update(users).set({ role: "specialist" }).where(eq(users.id, user.id));
    await createSession({ id: user.id, role: "specialist", name: user.name });
  }
  return ok({ id, slug }, { status: 201 });
});

/** Umumiy akkaunt ma'lumotlari (ism, telefon, avatar) */
export const PATCH = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, accountSchema);
  await db
    .update(users)
    .set({ name: input.name, phone: input.phone || null, avatarUrl: input.avatarUrl || null })
    .where(eq(users.id, session.sub));
  return ok({ updated: true });
});

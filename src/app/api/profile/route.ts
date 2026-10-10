import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { specialists, users } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { specialistProfileSchema } from "@/lib/validators";
import { slugify, uid } from "@/lib/utils";
import { z } from "zod";

/** Mutaxassis profilini yaratish/yangilash (faqat o'zining) */
export const PUT = handler(async (req) => {
  const session = await requireSession(["specialist", "admin"]);
  const input = await parseBody(req, specialistProfileSchema);

  const user = await db.query.users.findFirst({ where: eq(users.id, session.sub), with: { specialist: true } });
  if (!user) throw new ApiError(401, "Foydalanuvchi topilmadi");

  // Slug: ism asosida, band bo'lsa qisqa id qo'shiladi
  const makeSlug = async (currentId?: string) => {
    const base = slugify(user.name) || "mutaxassis";
    const taken = await db.query.specialists.findFirst({
      where: currentId ? and(eq(specialists.slug, base), ne(specialists.id, currentId)) : eq(specialists.slug, base),
      columns: { id: true },
    });
    return taken ? `${base}-${(currentId ?? uid()).slice(0, 6)}` : base;
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
    const slug = user.specialist.slug.startsWith(slugify(user.name)) ? user.specialist.slug : await makeSlug(user.specialist.id);
    await db.update(specialists).set({ ...values, slug }).where(eq(specialists.id, user.specialist.id));
    return ok({ id: user.specialist.id, slug });
  }

  const id = uid();
  const slug = await makeSlug(id);
  await db.insert(specialists).values({ id, userId: user.id, slug, ...values });
  if (user.role === "client") await db.update(users).set({ role: "specialist" }).where(eq(users.id, user.id));
  return ok({ id, slug }, { status: 201 });
});

const accountSchema = z.object({
  name: z.string().trim().min(2).max(60),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  avatarUrl: z.string().trim().max(300).optional().or(z.literal("")),
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

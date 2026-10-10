import { ApiError, handler, ok } from "@/lib/api";
import { getSpecialistBySlug } from "@/lib/queries";

/** Ommaviy profil — ichki identifikatorlar (userId, authorId) tashqariga chiqarilmaydi */
export const GET = handler(async (_req, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const sp = await getSpecialistBySlug(slug);
  if (!sp) throw new ApiError(404, "Mutaxassis topilmadi");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { userId, user, reviews, ...rest } = sp;
  return ok({
    ...rest,
    user: { name: user.name, avatarUrl: user.avatarUrl, phone: user.phone, createdAt: user.createdAt },
    reviews: reviews.map(({ id, rating, text, createdAt, author }) => ({ id, rating, text, createdAt, author })),
  });
});

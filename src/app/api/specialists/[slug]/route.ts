import { ApiError, handler, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { filterSpecialistForViewer, resolveVisibility, type Viewer } from "@/lib/privacy";
import { getSpecialistBySlug, hasAcceptedOrderWith } from "@/lib/queries";

/**
 * Ommaviy profil DTO — ko'ruvchiga (cookie) qarab yashirin maydonlar server tomonda olib tashlanadi.
 * Ichki identifikatorlar (userId, authorId) tashqariga chiqarilmaydi.
 */
export const GET = handler(async (_req, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const sp = await getSpecialistBySlug(slug);
  if (!sp) throw new ApiError(404, "Mutaxassis topilmadi");

  const session = await getSession();
  const isOwner = Boolean(session && session.sub === sp.userId);
  const viewer: Viewer = {
    userId: session?.sub ?? null,
    role: session?.role ?? null,
    isOwner,
    hasOrder: session && !isOwner ? await hasAcceptedOrderWith(session.sub, sp.id) : false,
  };

  const filtered = filterSpecialistForViewer(sp, viewer);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { userId, user, reviews, ...rest } = filtered;
  return ok({
    ...rest,
    user: { name: user.name, avatarUrl: user.avatarUrl, phone: user.phone, email: user.email, gender: user.gender, createdAt: user.createdAt },
    reviews: reviews.map(({ id, rating, text, createdAt, author, reply, replyAt }) => ({ id, rating, text, createdAt, author, reply, replyAt })),
    // Sozlamalarning o'zi faqat egasiga
    ...(isOwner ? { visibility: resolveVisibility(sp.visibility) } : {}),
  });
});

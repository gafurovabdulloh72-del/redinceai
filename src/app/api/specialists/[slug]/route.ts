import { ApiError, handler, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/payments/settings";
import { filterSpecialistForViewer, resolveVisibility, type Viewer } from "@/lib/privacy";
import { getSpecialistBySlug, hasAcceptedOrderWith } from "@/lib/queries";
import { canReceiveOrders } from "@/lib/subscriptions/access";

/**
 * Ommaviy profil DTO — ko'ruvchiga (cookie) qarab yashirin maydonlar server tomonda olib tashlanadi.
 * Ichki identifikatorlar (userId, authorId) va obuna muddati (subscriptionUntil) tashqariga chiqarilmaydi.
 * Obunasi faol bo'lmagan mutaxassis: acceptingOrders=false, aloqa ma'lumotlari faqat egasi, admin va buyurtmasi borlarga.
 */
export const GET = handler(async (_req, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const sp = await getSpecialistBySlug(slug);
  if (!sp) throw new ApiError(404, "Mutaxassis topilmadi");

  const [session, settings] = await Promise.all([getSession(), getSettings()]);
  const isOwner = Boolean(session && session.sub === sp.userId);
  const viewer: Viewer = {
    userId: session?.sub ?? null,
    role: session?.role ?? null,
    isOwner,
    hasOrder: session && !isOwner ? await hasAcceptedOrderWith(session.sub, sp.id) : false,
  };
  const acceptingOrders = canReceiveOrders(sp, settings);
  const contactsLocked = !acceptingOrders && !isOwner && viewer.role !== "admin" && !viewer.hasOrder;

  const filtered = filterSpecialistForViewer(sp, viewer);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { userId, user, reviews, subscriptionUntil, ...rest } = filtered;
  return ok({
    ...rest,
    ...(contactsLocked ? { telegram: null, instagram: null, youtube: null, website: null, locked: {} } : {}),
    acceptingOrders,
    user: {
      name: user.name,
      avatarUrl: user.avatarUrl,
      phone: contactsLocked ? null : user.phone,
      email: contactsLocked ? null : user.email,
      gender: user.gender,
      createdAt: user.createdAt,
    },
    reviews: reviews.map(({ id, rating, text, createdAt, author, reply, replyAt }) => ({ id, rating, text, createdAt, author, reply, replyAt })),
    // Sozlamalarning o'zi faqat egasiga
    ...(isOwner ? { visibility: resolveVisibility(sp.visibility) } : {}),
  });
});

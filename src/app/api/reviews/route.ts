import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { reviews, specialists } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { reviewDeleteSchema, reviewSchema } from "@/lib/validators";
import { hasAcceptedOrderWith, recalcRating } from "@/lib/queries";
import { notify } from "@/lib/notifications";
import { enforceLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { uid } from "@/lib/utils";
import { IMAGE_URL_RE, MAX_REVIEW_MEDIA } from "@/components/chat/attachments";
import { assertOwnUploads } from "@/app/api/orders/_lib/attachments";

const star = z.coerce.number().int().min(1, "1 dan 5 gacha").max(5, "1 dan 5 gacha");

/**
 * Sharh v2 (F44/F45/F46): umumiy baho + 3 mezon (Sifat, Muddat, Muloqot), 4 tagacha rasm (/api/upload), «Tavsiya qilaman».
 * Umumiy baho berilmasa — mezonlar o'rtachasi (yaxlitlangan); ikkalasi ham bo'lmasa 422.
 * Tahrirda yuborilmagan (undefined) v2 maydonlari o'zgarmaydi — eski mijozlar ularni o'chirib yubormasin.
 */
const reviewV2Schema = reviewSchema
  .extend({
    rating: star.optional().nullable(),
    quality: star.optional().nullable(),
    timeliness: star.optional().nullable(),
    communication: star.optional().nullable(),
    media: z
      .array(z.string().trim().max(500).regex(IMAGE_URL_RE, "Rasm sayt orqali yuklanishi kerak"))
      .max(MAX_REVIEW_MEDIA, `Ko'pi bilan ${MAX_REVIEW_MEDIA} ta rasm`)
      .optional(),
    recommend: z.boolean().optional().nullable(),
  })
  .transform((v) => {
    const criteria = [v.quality, v.timeliness, v.communication].filter((n): n is number => typeof n === "number");
    const rating = v.rating ?? (criteria.length ? Math.round(criteria.reduce((a, b) => a + b, 0) / criteria.length) : null);
    return { ...v, rating, media: v.media ? [...new Set(v.media)] : undefined };
  })
  .refine((v) => v.rating != null, { message: "Bahoni tanlang (1–5 yulduz)", path: ["rating"] });

async function saveReview(req: Request, mode: "upsert" | "update") {
  const session = await requireSession();
  // Avval tekshiruv, keyin limit — 422 javoblar limitni yemasin (POST /api/orders bilan bir xil tartib)
  const input = await parseBody(req, reviewV2Schema);
  await enforceLimit("reviews", session.sub);
  const rating = input.rating ?? 5;

  const sp = await db.query.specialists.findFirst({
    where: eq(specialists.id, input.specialistId),
    columns: { id: true, userId: true, slug: true },
  });
  if (!sp) throw new ApiError(404, "Mutaxassis topilmadi");
  if (sp.userId === session.sub) throw new ApiError(400, "O'zingizga sharh yoza olmaysiz");

  const existing = await db.query.reviews.findFirst({
    where: and(eq(reviews.specialistId, sp.id), eq(reviews.authorId, session.sub)),
    columns: { id: true, media: true, quality: true, timeliness: true, communication: true, recommend: true },
  });
  if (mode === "update" && !existing) throw new ApiError(404, "Sharh topilmadi");

  // "Haqiqiy fikr" sharti: yangi sharh faqat shu mutaxassis bilan qabul qilingan/bajarilgan buyurtmasi borlardan;
  // avval qoldirilgan sharhni tahrirlash mumkin; admin — istisno (moderatsiya/test)
  if (!existing && session.role !== "admin" && !(await hasAcceptedOrderWith(session.sub, sp.id))) {
    throw new ApiError(403, "Sharh faqat shu mutaxassis bilan buyurtmangiz qabul qilingach qoldiriladi");
  }
  // Yangi rasmlar — faqat o'zi yuklaganlari (sharhda allaqachon borlari tekshirilmaydi)
  const media = input.media ?? existing?.media ?? [];
  await assertOwnUploads(session.sub, media, existing?.media ?? [], "media");

  const keep = <T,>(next: T | null | undefined, prev: T | null | undefined): T | null => (next === undefined ? (prev ?? null) : next);
  const values = {
    rating,
    text: input.text,
    quality: keep(input.quality, existing?.quality),
    timeliness: keep(input.timeliness, existing?.timeliness),
    communication: keep(input.communication, existing?.communication),
    media,
    recommend: keep(input.recommend, existing?.recommend),
  };
  let reviewId: string;
  if (existing) {
    reviewId = existing.id;
    await db.update(reviews).set(values).where(eq(reviews.id, existing.id));
  } else {
    reviewId = uid();
    await db.insert(reviews).values({ id: reviewId, specialistId: sp.id, authorId: session.sub, ...values });
  }
  await recalcRating(sp.id);
  await audit(session.sub, existing ? "review_updated" : "review_created", { targetType: "specialist", targetId: sp.id, meta: { rating, media: media.length || undefined, recommend: values.recommend ?? undefined } }, req);
  if (!existing) {
    await notify(sp.userId, "review_new", `Yangi sharh: ${rating} yulduz`, `${session.name}: ${input.text.length > 160 ? `${input.text.slice(0, 160)}…` : input.text}`, `/mutaxassislar/${sp.slug}#sharh-${reviewId}`);
  }
  return ok({ saved: true, updated: Boolean(existing), rating }, { status: existing ? 200 : 201 });
}

/** Sharh qoldirish yoki o'z sharhini yangilash (upsert) */
export const POST = handler(async (req) => saveReview(req, "upsert"));

/** Faqat mavjud sharhni tahrirlash */
export const PATCH = handler(async (req) => saveReview(req, "update"));

/** O'z sharhini o'chirish (?specialistId=); admin — &authorId= bilan boshqa muallifnikini ham (moderatsiya) */
export const DELETE = handler(async (req) => {
  const session = await requireSession();
  const { specialistId, authorId } = parseQuery(req.url, reviewDeleteSchema);
  if (authorId && authorId !== session.sub && session.role !== "admin") throw new ApiError(403, "Ruxsat yo'q");
  const target = authorId ?? session.sub;

  const row = await db.query.reviews.findFirst({
    where: and(eq(reviews.specialistId, specialistId), eq(reviews.authorId, target)),
    columns: { id: true },
  });
  if (!row) throw new ApiError(404, "Sharh topilmadi");

  await db.delete(reviews).where(eq(reviews.id, row.id));
  await recalcRating(specialistId);
  await audit(session.sub, "review_deleted", { targetType: "review", targetId: row.id, meta: { specialistId, authorId: target, byAdmin: target !== session.sub } }, req);
  return ok({ deleted: true });
});

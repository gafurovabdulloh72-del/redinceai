import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { portfolioItems } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { portfolioEditSchema } from "@/lib/validators";
import { youtubeId } from "@/lib/utils";
import { enforceEditLimit, renumberPortfolio } from "../_shared";

/** Tahrirlash: sarlavha, tavsif va muqova (video/havola uchun). Turi va manzili o'zgarmaydi — kerak bo'lsa yangi ish qo'shiladi */
const editSchema = portfolioEditSchema;

export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["specialist", "admin"]);
  const { id } = await ctx.params;
  const input = await parseBody(req, editSchema);

  const item = await db.query.portfolioItems.findFirst({
    where: eq(portfolioItems.id, id),
    with: { specialist: { columns: { userId: true } } },
  });
  if (!item) throw new ApiError(404, "Topilmadi");
  if (item.specialist.userId !== session.sub && session.role !== "admin") throw new ApiError(403, "Ruxsat yo'q");
  await enforceEditLimit(session.sub);

  // Muqova: rasm turida — rasmning o'zi; video — berilgani yoki YouTube muqovasi; havola — berilgani yoki yo'q
  let thumbnailUrl: string | null = item.thumbnailUrl;
  if (input.thumbnailUrl !== undefined) {
    const given = input.thumbnailUrl.trim();
    if (item.type === "image") thumbnailUrl = item.url;
    else if (given) thumbnailUrl = given;
    else if (item.type === "video") {
      const yt = youtubeId(item.url);
      thumbnailUrl = yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null;
    } else thumbnailUrl = null;
  }

  // Teglar (F61) va "oldin" rasmi (F63): kalit yuborilmasa — tegilmaydi; bo'sh satr — juftlik olib tashlanadi
  if (input.beforeUrl && item.type !== "image") throw new ApiError(422, "Oldin/keyin juftligi faqat rasm turidagi ish uchun", { beforeUrl: "Faqat rasm turidagi ish uchun" });
  const tags = input.tags ?? item.tags;
  // Tavsif kaliti yuborilmasa — tegilmaydi (faqat teg yoki "oldin" rasmini yangilash mavjud tavsifni o'chirib yubormasin)
  const description = input.description !== undefined ? input.description.trim() || null : item.description;
  const beforeUrl = input.beforeUrl !== undefined ? input.beforeUrl || null : item.beforeUrl;

  await db
    .update(portfolioItems)
    .set({ title: input.title, description, thumbnailUrl, tags, beforeUrl })
    .where(eq(portfolioItems.id, id));
  return ok({ id, title: input.title, description, thumbnailUrl, tags, beforeUrl });
});

export const DELETE = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["specialist", "admin"]);
  const { id } = await ctx.params;

  const item = await db.query.portfolioItems.findFirst({
    where: eq(portfolioItems.id, id),
    with: { specialist: { columns: { userId: true } } },
  });
  if (!item) throw new ApiError(404, "Topilmadi");
  if (item.specialist.userId !== session.sub && session.role !== "admin") throw new ApiError(403, "Ruxsat yo'q");

  await db.delete(portfolioItems).where(eq(portfolioItems.id, id));
  // Qolganlarni 0..n-1 qilib qayta raqamlash — keyingi qo'shishda tartib to'qnashmasin
  await renumberPortfolio(item.specialistId);
  return ok({ deleted: true });
});

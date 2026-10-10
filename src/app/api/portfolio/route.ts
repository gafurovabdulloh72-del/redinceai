import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { portfolioItems, specialists } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { portfolioItemSchema } from "@/lib/validators";
import { uid, youtubeId } from "@/lib/utils";

const MAX_ITEMS = 30;

export const POST = handler(async (req) => {
  const session = await requireSession(["specialist", "admin"]);
  const input = await parseBody(req, portfolioItemSchema);

  const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, session.sub), columns: { id: true } });
  if (!sp) throw new ApiError(400, "Avval mutaxassis profilini to'ldiring");

  const [{ n }] = await db.select({ n: count() }).from(portfolioItems).where(eq(portfolioItems.specialistId, sp.id));
  if (n >= MAX_ITEMS) throw new ApiError(400, `Portfolioda ko'pi bilan ${MAX_ITEMS} ta ish bo'lishi mumkin`);

  // YouTube video uchun thumbnail avtomatik
  let thumbnailUrl = input.thumbnailUrl || null;
  if (!thumbnailUrl && input.type === "video") {
    const yt = youtubeId(input.url);
    if (yt) thumbnailUrl = `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
  }
  if (!thumbnailUrl && input.type === "image") thumbnailUrl = input.url;

  const id = uid();
  await db.insert(portfolioItems).values({
    id,
    specialistId: sp.id,
    title: input.title,
    type: input.type,
    url: input.url,
    thumbnailUrl,
    description: input.description || null,
    sortOrder: n,
  });
  return ok({ id }, { status: 201 });
});

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessons } from "@/lib/db/schema";
import { ApiError, handler } from "@/lib/api";
import { getVerifiedSession } from "@/lib/auth";
import { streamProtectedMedia } from "@/lib/media-stream";
import { verifyMediaToken } from "@/lib/security/media-token";

type Ctx = { params: Promise<{ lessonId: string }> };

/**
 * Dars videosining HAQIQIY oqimi: faqat `/api/mentorlik/video/[id]` bergan 15 daqiqalik, shu foydalanuvchiga
 * bog'langan token bilan. Xom saqlash manzili hech qachon javobda ko'rinmaydi (server orqali oqimlanadi, Range bilan).
 * Token boshqa sessiyada, muddati o'tgach yoki boshqa darsga ishlamaydi.
 */
async function serve(req: Request, ctx: Ctx) {
  const { lessonId } = await ctx.params;
  const session = await getVerifiedSession();
  const token = new URL(req.url).searchParams.get("t");
  if (!verifyMediaToken(token, { kind: "lesson", id: lessonId, subject: session?.sub ?? null })) throw new ApiError(403, "Havola muddati o'tgan — sahifani yangilang");
  const l = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId), columns: { videoUrl: true } });
  if (!l?.videoUrl) throw new ApiError(404, "Video topilmadi");
  return streamProtectedMedia(l.videoUrl, req);
}

export const GET = handler(serve);
export const HEAD = handler(serve);

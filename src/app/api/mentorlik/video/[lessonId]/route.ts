import { NextResponse } from "next/server";
import { redirectTo } from "@/lib/http/redirect";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { courses, enrollments, lessons } from "@/lib/db/schema";
import { ApiError, handler } from "@/lib/api";
import { getVerifiedSession } from "@/lib/auth";
import { mintMediaToken } from "@/lib/security/media-token";

type Ctx = { params: Promise<{ lessonId: string }> };

/**
 * Dars videosiga himoyalangan kirish: xom saqlash URL'i mijozga BERILMAYDI —
 * pleyer shu manzilni so'raydi, server sessiya va kursga yozilganlikni tekshirib
 * tokenli /stream manziliga 302 qiladi (xom manzil chiqmaydi). Javob keshsiz (private) — havola
 * ulashilsa ham begona sessiyada 403 oladi. (Bepul namuna darslari mehmonga ham ochiq.)
 */
export const GET = handler(async (req, ctx: Ctx) => {
  const { lessonId } = await ctx.params;
  const session = await getVerifiedSession();

  const l = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId), columns: { id: true, courseId: true, videoUrl: true, isPreview: true } });
  if (!l?.videoUrl) throw new ApiError(404, "Video topilmadi");

  if (!l.isPreview) {
    if (!session) throw new ApiError(401, "Kirish talab qilinadi");
    const c = await db.query.courses.findFirst({ where: eq(courses.id, l.courseId), with: { mentor: { columns: { userId: true } } } });
    if (!c) throw new ApiError(404, "Kurs topilmadi");
    const isOwner = c.mentor.userId === session.sub;
    const isAdmin = session.role === "admin";
    const enrolled = isOwner || isAdmin ? true : Boolean(await db.query.enrollments.findFirst({ where: and(eq(enrollments.courseId, c.id), eq(enrollments.userId, session.sub)), columns: { id: true } }));
    if (!enrolled) throw new ApiError(403, "Bu darsni ko'rish uchun kursga yoziling");
  }

  // 4-audit: xom saqlash manziliga EMAS — shu foydalanuvchiga bog'langan 15 daqiqalik tokenli oqimga yo'naltiramiz
  // (Network panelida ham faqat /stream?t=… ko'rinadi; token boshqa sessiyada ishlamaydi)
  const token = mintMediaToken("lesson", l.id, session?.sub ?? null);
  return redirectTo(`/api/mentorlik/video/${encodeURIComponent(l.id)}/stream?t=${encodeURIComponent(token)}`, 302, { "Cache-Control": "private, no-store" });
});

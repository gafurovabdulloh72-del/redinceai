import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { courses, enrollments, lessons } from "@/lib/db/schema";
import { ApiError, handler } from "@/lib/api";
import { getVerifiedSession } from "@/lib/auth";

type Ctx = { params: Promise<{ lessonId: string }> };

/**
 * Dars videosiga himoyalangan kirish: xom saqlash URL'i mijozga BERILMAYDI —
 * pleyer shu manzilni so'raydi, server sessiya va kursga yozilganlikni tekshirib
 * haqiqiy faylga 302 qiladi. Javob keshsiz (private) — havola ulashilsa ham
 * begona sessiyada 403 oladi. (Bepul namuna darslari mehmonga ham ochiq.)
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

  // Lokal /uploads yo'llari uchun nisbiy URL ham ishlasin (redirect mutlaq URL talab qiladi)
  return NextResponse.redirect(new URL(l.videoUrl, req.url), { status: 302, headers: { "Cache-Control": "private, no-store" } });
});

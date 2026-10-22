import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { recordingToLesson } from "@/lib/live/service";

/** POST {courseId} — tayyor efir yozuvi shu kursning yangi darsiga aylanadi (ustoz/admin) */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, z.object({ courseId: z.string().min(1).max(64) }));
  return ok(await recordingToLesson(id, { id: session.sub, role: session.role }, input.courseId), { status: 201 });
});

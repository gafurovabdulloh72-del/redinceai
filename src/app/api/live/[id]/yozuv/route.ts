import { handler, ok, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { deleteRecording } from "@/lib/live/service";

export const runtime = "nodejs";

/** DELETE — tugagan efirni yozuvi bilan o'chirish (ustoz yoki admin; chipta sotilgan bo'lsa 409) */
export const DELETE = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  await enforceLimit("liveRecord", session.sub);
  const { id } = await ctx.params;
  return ok(await deleteRecording(id, { id: session.sub, role: session.role }));
});

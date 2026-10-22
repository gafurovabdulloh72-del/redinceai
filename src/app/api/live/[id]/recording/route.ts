import { handler, ok, requireSession } from "@/lib/api";
import { startRecording } from "@/lib/live/service";

export const runtime = "nodejs";

/** POST — efirni yozib olishni boshlash (faqat boshlovchi). Efir tugaganda yozuv o'zi to'xtaydi va mentor bo'limiga qo'shiladi */
export const POST = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await startRecording(id, { id: session.sub, role: session.role });
  return ok({ recording: true });
});

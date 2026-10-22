import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { endLive, updateRecording } from "@/lib/live/service";
import { assertOwnUploads } from "@/app/api/orders/_lib/attachments";

export const runtime = "nodejs";

const bodySchema = z.object({ peak: z.number().int().min(0).max(1_000_000).optional() });

/** DELETE — efirni tugatish (faqat boshlovchi/admin) */
export const DELETE = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, bodySchema).catch(() => ({ peak: undefined }));
  await endLive(id, { id: session.sub, role: session.role }, input.peak);
  return ok({ ended: true });
});

const patchSchema = z.object({ title: z.string().max(100).optional(), coverUrl: z.string().max(500).nullable().optional(), hidden: z.boolean().optional() });

/** PATCH — yozuv nomi / muqovasi / yashirish (ustoz yoki admin) */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, patchSchema);
  if (input.coverUrl) await assertOwnUploads(session.sub, [input.coverUrl], [], "coverUrl");
  await updateRecording(id, { id: session.sub, role: session.role }, input);
  return ok({ updated: true });
});

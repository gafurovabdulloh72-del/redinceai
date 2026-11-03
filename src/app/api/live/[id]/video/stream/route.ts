import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { liveStreams } from "@/lib/db/schema";
import { ApiError, handler } from "@/lib/api";
import { getVerifiedSession } from "@/lib/auth";
import { streamProtectedMedia } from "@/lib/media-stream";
import { verifyMediaToken } from "@/lib/security/media-token";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Efir yozuvining haqiqiy oqimi — faqat `/api/live/[id]/video` bergan token bilan (dars videosi bilan bir xil naqsh) */
async function serve(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await getVerifiedSession();
  const token = new URL(req.url).searchParams.get("t");
  if (!verifyMediaToken(token, { kind: "live", id, subject: session?.sub ?? null })) throw new ApiError(403, "Havola muddati o'tgan — sahifani yangilang");
  const s = await db.query.liveStreams.findFirst({ where: eq(liveStreams.id, id), columns: { recordingUrl: true, status: true } });
  if (!s?.recordingUrl || s.status !== "ended") throw new ApiError(404, "Yozuv topilmadi");
  return streamProtectedMedia(s.recordingUrl, req);
}

export const GET = handler(serve);
export const HEAD = handler(serve);

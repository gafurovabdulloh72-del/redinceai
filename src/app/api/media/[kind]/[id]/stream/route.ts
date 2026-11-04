import { ApiError, handler } from "@/lib/api";
import { getVerifiedSession } from "@/lib/auth";
import { resolvePrivateFile } from "@/lib/media/private-access";
import { isPrivateFileKind } from "@/lib/media/private-url";
import { streamProtectedMedia } from "@/lib/media-stream";
import { verifyMediaToken } from "@/lib/security/media-token";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ kind: string; id: string }> };

/**
 * Yopiq faylning HAQIQIY oqimi — faqat `/api/media/[kind]/[id]` bergan token bilan (sessiyaga bog'langan, 15 daqiqa).
 * Ruxsat qaytadan tekshiriladi (a'zolikdan chiqarilgan odam eski token bilan ham ololmaydi), fayl server orqali
 * Range bilan oqimlanadi: `Content-Disposition: inline`, `nosniff`, `Cache-Control: private, no-store`.
 */
async function serve(req: Request, ctx: Ctx) {
  const { kind, id } = await ctx.params;
  if (!isPrivateFileKind(kind)) throw new ApiError(404, "Fayl topilmadi");
  const session = await getVerifiedSession();
  if (!session) throw new ApiError(401, "Avval tizimga kiring");
  const token = new URL(req.url).searchParams.get("t");
  if (!verifyMediaToken(token, { kind, id, subject: session.sub })) throw new ApiError(403, "Havola muddati o'tgan — sahifani yangilang");
  const file = await resolvePrivateFile(kind, id, session);
  return streamProtectedMedia(file.url, req, { any: true, name: file.name });
}

export const GET = handler(serve);
export const HEAD = handler(serve);

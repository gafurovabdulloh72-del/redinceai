import { ApiError, handler, requireSession } from "@/lib/api";
import { resolvePrivateFile } from "@/lib/media/private-access";
import { isPrivateFileKind } from "@/lib/media/private-url";
import { mintMediaToken } from "@/lib/security/media-token";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ kind: string; id: string }> };

/**
 * Yopiq fayl (5-audit): chat biriktirmasi / ovozli xabar / buyurtma fayli / dars materiali / chek.
 * Mehmon → 401; ruxsat yo'q yoki fayl yo'q → 404; ruxsat bo'lsa shu foydalanuvchiga bog'langan 15 daqiqalik token bilan
 * `…/stream?t=` ga 302 (xom saqlash manzili hech qachon javobda ko'rinmaydi — dars videosi bilan bir xil naqsh).
 *
 * `Location` — NISBIY yo'l (RFC 7231 ruxsat beradi, brauzer joriy origin'ga nisbatan o'qiydi). Ilgari mutlaq manzil
 * `req.url` dan yasalardi: server o'zini `localhost:<port>` deb ko'rsa (reverse-proxy, Docker, 127.0.0.1 orqali kirish)
 * rasm boshqa origin'ga yo'naltirilib, CSP uni to'sar va chatdagi rasm bo'sh pufakcha bo'lib qolardi (QA A11).
 */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const { kind, id } = await ctx.params;
  const session = await requireSession();
  if (!isPrivateFileKind(kind) || id.length > 120) throw new ApiError(404, "Fayl topilmadi");
  await resolvePrivateFile(kind, id, session);
  const location = `/api/media/${kind}/${encodeURIComponent(id)}/stream?t=${encodeURIComponent(mintMediaToken(kind, id, session.sub))}`;
  return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "private, no-store" } });
});

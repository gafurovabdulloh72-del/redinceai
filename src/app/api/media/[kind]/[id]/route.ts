import { NextResponse } from "next/server";
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
 */
export const GET = handler(async (req: Request, ctx: Ctx) => {
  const { kind, id } = await ctx.params;
  const session = await requireSession();
  if (!isPrivateFileKind(kind) || id.length > 120) throw new ApiError(404, "Fayl topilmadi");
  await resolvePrivateFile(kind, id, session);
  const target = new URL(`/api/media/${kind}/${encodeURIComponent(id)}/stream`, req.url);
  target.searchParams.set("t", mintMediaToken(kind, id, session.sub));
  return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": "private, no-store" } });
});

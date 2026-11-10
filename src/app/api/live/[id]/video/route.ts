import { NextResponse } from "next/server";
import { redirectTo } from "@/lib/http/redirect";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { groups, liveStreams } from "@/lib/db/schema";
import { ApiError, handler } from "@/lib/api";
import { getVerifiedSession } from "@/lib/auth";
import { getMembership } from "@/lib/groups/service";
import { canWatchPaid } from "@/lib/mentorship/purchases";
import { mintMediaToken } from "@/lib/security/media-token";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Efir yozuvi (4-audit): xom R2 manzili o'rniga ruxsat tekshiruvi → 15 daqiqalik, foydalanuvchiga bog'langan token →
 * `/video/stream` server orqali oqimlaydi. Qoidalar `listRecordings` bilan bir xil:
 *  - yozuv tayyor va yashirilmagan (boshqaruvchi/admin yashirilganini ham ko'radi)
 *  - yopiq jamoada faqat faol a'zo
 *  - pullik efir — chipta/obuna (`canWatchPaid`) yoki boshqaruvchi
 */
export const GET = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const session = await getVerifiedSession();
  const s = await db.query.liveStreams.findFirst({ where: eq(liveStreams.id, id) });
  if (!s || s.status !== "ended" || !s.recordingUrl) throw new ApiError(404, "Yozuv topilmadi");
  const group = await db.query.groups.findFirst({ where: eq(groups.id, s.groupId), columns: { id: true, ownerId: true, isPrivate: true } });
  if (!group) throw new ApiError(404, "Yozuv topilmadi");

  const admin = session?.role === "admin";
  const m = await getMembership(group.id, session?.sub);
  const active = Boolean(m && m.status === "active");
  const manage = admin || group.ownerId === session?.sub || (active && (m!.role === "owner" || m!.role === "admin"));

  if (!manage) {
    if (s.recordingStatus !== "ready" || s.recordingHidden) throw new ApiError(404, "Yozuv topilmadi");
    if (group.isPrivate && !active) throw new ApiError(session ? 403 : 401, "Bu yopiq jamoa — yozuv faqat a'zolarga");
    if (s.priceSom > 0) {
      if (!session) throw new ApiError(401, "Kirish talab qilinadi");
      if (!(await canWatchPaid(session.sub, s, admin))) throw new ApiError(402, "Bu efir pullik — chipta oling yoki ustozga obuna bo'ling");
    }
  }

  return redirectTo(`/api/live/${encodeURIComponent(id)}/video/stream?t=${encodeURIComponent(mintMediaToken("live", id, session?.sub ?? null))}`, 302, { "Cache-Control": "private, no-store" });
});

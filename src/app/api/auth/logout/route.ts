import { NextResponse, type NextRequest } from "next/server";
import { redirectTo } from "@/lib/http/redirect";
import { SESSION_COOKIE, clearSession, getSession, getVerifiedSession, revokeSession } from "@/lib/auth";
import { handler, ok } from "@/lib/api";
import { safeInternalPath } from "@/lib/utils";
import { audit } from "@/lib/security/audit";

/** Chiqish: cookie o'chiriladi VA token bekor qilinadi (nusxasi muddati tugaguncha ham ishlamaydi) */
export const POST = handler(async (req) => {
  const session = await getSession();
  if (session) await revokeSession(session).catch((e) => console.error("[auth] revoke", e));
  await clearSession();
  if (session) await audit(session.sub, "logout", { targetType: "user", targetId: session.sub }, req);
  return ok({ loggedOut: true });
});

/**
 * GET: ESKIRGAN cookie'ni tozalab, kirish sahifasiga yo'naltiradi.
 * Eski (bazada yo'q, sessiya versiyasi o'zgargan yoki bekor qilingan) cookie bilan /kabinet ↔ /auth/kirish
 * cheksiz aylanib qolmasligi uchun himoyalangan sahifalar shu yerga yuboradi.
 * Amaldagi sessiya o'chirilMAYDI (begona sahifa <img src="/api/auth/logout"> bilan chiqarib yubora olmasin) —
 * foydalanuvchi shunchaki ?next (yoki kabinet) sahifasiga qaytariladi. Chiqish faqat POST orqali.
 */
export async function GET(req: NextRequest) {
  const next = safeInternalPath(req.nextUrl.searchParams.get("next"), req.nextUrl.origin);
  const session = await getVerifiedSession().catch(() => null);
  if (session) {
    const back = next && !next.startsWith("/auth/") && !next.startsWith("/api/") ? next : "/kabinet";
    return redirectTo(back);
  }
  const q = new URLSearchParams();
  if (next && !next.startsWith("/auth/")) q.set("next", next);
  q.set("reason", "expired");
  const res = redirectTo(`/auth/kirish?${q.toString()}`);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

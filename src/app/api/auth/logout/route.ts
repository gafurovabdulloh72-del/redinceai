import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, clearSession, getSession } from "@/lib/auth";
import { handler, ok } from "@/lib/api";
import { safeInternalPath } from "@/lib/utils";
import { audit } from "@/lib/security/audit";

export const POST = handler(async (req) => {
  const session = await getSession();
  await clearSession();
  if (session) await audit(session.sub, "logout", { targetType: "user", targetId: session.sub }, req);
  return ok({ loggedOut: true });
});

/**
 * GET: cookie'ni tozalab, kirish sahifasiga yo'naltiradi.
 * Eski (bazada yo'q yoki sessiya versiyasi o'zgargan) cookie bilan /kabinet ↔ /auth/kirish
 * cheksiz aylanib qolmasligi uchun himoyalangan sahifalar shu yerga yuboradi.
 */
export function GET(req: NextRequest) {
  const next = safeInternalPath(req.nextUrl.searchParams.get("next"), req.nextUrl.origin);
  const url = new URL("/auth/kirish", req.nextUrl.origin);
  if (next && !next.startsWith("/auth/")) url.searchParams.set("next", next);
  url.searchParams.set("reason", "expired");
  const res = NextResponse.redirect(url);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

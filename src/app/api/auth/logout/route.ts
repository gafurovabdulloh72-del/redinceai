import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, clearSession } from "@/lib/auth";
import { handler, ok } from "@/lib/api";
import { safeInternalPath } from "@/lib/utils";

export const POST = handler(async () => {
  await clearSession();
  return ok({ loggedOut: true });
});

/**
 * GET: cookie'ni tozalab, kirish sahifasiga yo'naltiradi.
 * Eski (bazada yo'q foydalanuvchiga tegishli) cookie bilan /kabinet ↔ /auth/kirish
 * cheksiz aylanib qolmasligi uchun himoyalangan sahifalar shu yerga yuboradi.
 */
export function GET(req: NextRequest) {
  const next = safeInternalPath(req.nextUrl.searchParams.get("next"), req.nextUrl.origin);
  const url = new URL("/auth/kirish", req.nextUrl.origin);
  if (next && !next.startsWith("/auth/")) url.searchParams.set("next", next);
  const res = NextResponse.redirect(url);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

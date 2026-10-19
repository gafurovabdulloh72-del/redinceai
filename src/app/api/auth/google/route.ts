import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { googleAuthUrl, isGoogleConfigured } from "@/lib/auth/google";
import { safeInternalPath } from "@/lib/utils";

const STATE_COOKIE = "g_oauth";

/**
 * GET /api/auth/google?next=... — «Google bilan kirish»ni boshlaydi.
 * CSRF himoyasi: tasodifiy `state` httpOnly cookie'ga yoziladi va callback'da tekshiriladi.
 * `next` ham o'sha cookie ichida saqlanadi (ochiq redirectdan himoya).
 */
export async function GET(req: NextRequest) {
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/auth/kirish?reason=google_off", req.nextUrl.origin));
  }
  const next = safeInternalPath(req.nextUrl.searchParams.get("next"), req.nextUrl.origin);
  const state = randomBytes(18).toString("base64url");
  const payload = JSON.stringify({ s: state, n: next && !next.startsWith("/auth/") && !next.startsWith("/api/") ? next : null });

  const res = NextResponse.redirect(googleAuthUrl(state));
  res.cookies.set(STATE_COOKIE, payload, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600, // 10 daqiqa
  });
  return res;
}

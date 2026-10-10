import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "redince_session";

function secret() {
  const s = process.env.AUTH_SECRET;
  return new TextEncoder().encode(s && s.length >= 16 ? s : "dev-only-insecure-secret-change-me-please-123456");
}

async function readRole(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return (payload.role as string) ?? "client";
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const role = await readRole(req);

  // Himoyalangan sahifalar
  if (pathname.startsWith("/kabinet") || pathname.startsWith("/admin") || pathname.startsWith("/buyurtma")) {
    if (!role) {
      const url = req.nextUrl.clone();
      url.pathname = "/auth/kirish";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
    if (pathname.startsWith("/admin") && role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/kabinet";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Kirgan foydalanuvchini auth sahifalaridan kabinetga yo'naltiramiz
  if (role && pathname.startsWith("/auth/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/kabinet";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/kabinet/:path*", "/admin/:path*", "/buyurtma/:path*", "/auth/:path*"],
};

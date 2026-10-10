import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "redince_session";
const ROLES = new Set(["client", "specialist", "admin"]);

function secret() {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return new TextEncoder().encode(s);
  // AUTH_SECRET berilmagan bo'lsa: Turso tokenidan barqaror, maxfiy kalit hosil qilamiz
  // (token maxfiy va deploylar orasida o'zgarmaydi — sessiyalar saqlanib qoladi)
  const derived = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
  if (derived && derived.length >= 16) return new TextEncoder().encode(`redince-session-v1:${derived}`);
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET o'rnatilmagan");
  return new TextEncoder().encode("dev-only-insecure-secret-change-me-please-123456");
}

/**
 * Faqat JWT imzosi va muddati tekshiriladi (edge'da baza yo'q). Sessiya versiyasi (sv)
 * sahifa/API darajasida getCurrentUser / requireSession orqali tekshiriladi.
 */
async function readRole(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const role = typeof payload.role === "string" && ROLES.has(payload.role) ? payload.role : "client";
    return role;
  } catch {
    return null;
  }
}

/** Faqat ichki yo'l ("/..." bilan boshlanadi, "//" yoki "\" emas, boshqa domenga olib ketmaydi) */
function safeNext(raw: string | null, origin: string): string | null {
  if (!raw || !raw.startsWith("/") || /[\\\u0000-\u001f]/.test(raw)) return null;
  try {
    const u = new URL(raw, origin);
    if (u.origin !== origin) return null;
    return u.pathname + u.search + u.hash;
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
    // Sahifa (getCurrentUser) eskirgan sessiyani aniqlasa, qayerga qaytishni bilishi uchun yo'lni uzatamiz.
    // Mijoz yuborgan qiymat e'tiborga olinmaydi (ustidan yoziladi).
    const reqHeaders = new Headers(req.headers);
    reqHeaders.set("x-pathname", pathname + search);
    return NextResponse.next({ request: { headers: reqHeaders } });
  }

  // Kirgan foydalanuvchini auth sahifalaridan kabinetga (yoki ?next= manzilga) yo'naltiramiz.
  // Parol tiklash sahifalari istisno: havola emaildan ochilganda sessiya bo'lishi ham mumkin.
  if (role && pathname.startsWith("/auth/") && !pathname.startsWith("/auth/parol-tiklash")) {
    const next = safeNext(req.nextUrl.searchParams.get("next"), req.nextUrl.origin);
    const url = new URL(next ?? "/kabinet", req.nextUrl.origin);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/kabinet/:path*", "/admin/:path*", "/buyurtma/:path*", "/auth/:path*"],
};

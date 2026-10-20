import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "redince_session";
const ROLES = new Set(["client", "specialist", "admin"]);
const IS_PROD = process.env.NODE_ENV === "production";

/** Namunaviy (.env.example / dev) qiymatlar — productionda kalit sifatida qabul qilinmaydi */
const PLACEHOLDER_SECRET = /^(change-me|dev-only)/i;
const MIN_SECRET_PROD = 32;
const warnFlag = globalThis as { __redinceSecretWarned?: boolean; __redinceEdgeKey?: Promise<Uint8Array> };
function warnOnce(msg: string) {
  if (warnFlag.__redinceSecretWarned) return;
  warnFlag.__redinceSecretWarned = true;
  console.warn(`[auth] ${msg}`);
}

/** Turso tokenidan HKDF-SHA256 (salt "redince", info "session-v1", 32 bayt) — src/lib/auth.ts hkdfSync bilan bir xil baytlar */
async function hkdf(token: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(token), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: enc.encode("redince"), info: enc.encode("session-v1") }, key, 256);
  return new Uint8Array(bits);
}

/** src/lib/auth.ts secret() bilan BIR XIL mantiq va baytlar (edge'da uni import qilib bo'lmaydi) — birga o'zgartiring */
function secret(): Promise<Uint8Array> {
  warnFlag.__redinceEdgeKey ??= computeSecret();
  return warnFlag.__redinceEdgeKey;
}

async function computeSecret(): Promise<Uint8Array> {
  const s = process.env.AUTH_SECRET;
  if (s) {
    if (IS_PROD) {
      // src/lib/auth.ts bilan bir xil: yaroqsiz kalit e'tiborga olinmaydi, Turso tokenidan hosil qilingan kalitga o'tiladi
      if (PLACEHOLDER_SECRET.test(s)) console.error("[auth] AUTH_SECRET namunaviy qiymat — e'tiborga olinmadi");
      else if (s.length < MIN_SECRET_PROD) console.error(`[auth] AUTH_SECRET juda qisqa (kamida ${MIN_SECRET_PROD} belgi) — e'tiborga olinmadi`);
      else return new TextEncoder().encode(s);
    } else if (s.length < 16) warnOnce("AUTH_SECRET juda qisqa (kamida 16 belgi) — e'tiborga olinmadi");
    else {
      if (PLACEHOLDER_SECRET.test(s)) warnOnce("AUTH_SECRET namunaviy qiymat — productionda rad etiladi. `openssl rand -base64 48` bilan yarating");
      return new TextEncoder().encode(s);
    }
  }
  const derived = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
  if (derived && derived.length >= 16) {
    warnOnce("AUTH_SECRET yo'q — sessiya kaliti Turso tokenidan (HKDF) hosil qilinmoqda; token almashsa barcha sessiyalar bekor bo'ladi");
    return hkdf(derived);
  }
  if (IS_PROD) throw new Error("AUTH_SECRET o'rnatilmagan — productionda majburiy (`openssl rand -base64 48`)");
  return new TextEncoder().encode("dev-only-insecure-secret-change-me-please-123456");
}

/**
 * Faqat JWT imzosi va muddati tekshiriladi (edge'da baza yo'q). Sessiya versiyasi (sv), bekor qilingan
 * tokenlar va bloklangan foydalanuvchi sahifa/API darajasida getCurrentUser / requireSession orqali tekshiriladi.
 */
async function readRole(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await secret(), { algorithms: ["HS256"] });
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

/* ------------------------------------------------------------------ */
/* Content-Security-Policy (har so'rovda yangi nonce)                   */
/* ------------------------------------------------------------------ */
/** To'lov tizimlari (Payme/Click) checkout sahifalari — iframe, form yuborish va connect uchun */
const PAYMENT_HOSTS = "https://checkout.paycom.uz https://checkout.test.paycom.uz https://my.click.uz";

/** Env'dagi URL'dan https origin (" https://host" ko'rinishida, CSP ro'yxatiga qo'shish uchun). Yo'q/noto'g'ri bo'lsa bo'sh — build sinmaydi. */
function envOrigin(value: string | undefined): string {
  try {
    if (value) {
      const u = new URL(value);
      if (u.protocol === "https:") return ` ${u.origin}`;
    }
  } catch {
    /* noto'g'ri URL — e'tiborsiz */
  }
  return "";
}
/** Cloudflare R2: ommaviy o'qish bazasi (rasm/video) va presigned PUT endpoint'i (brauzerdan yuklash) */
const R2_PUBLIC_ORIGIN = envOrigin(process.env.R2_PUBLIC_BASE);
const R2_ENDPOINT_ORIGIN = envOrigin(process.env.R2_ENDPOINT);

/** Video qo'ng'iroq (LiveKit): signal WebSocket (wss) + region/validate so'rovlari (https). LiveKit Cloud
 *  regional signal/media hostlari *.livekit.cloud ostida — shuning uchun butun domenga ruxsat beramiz. */
function liveKitConnect(): string {
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL;
  if (!url) return "";
  try {
    const host = new URL(url).hostname;
    return host.endsWith(".livekit.cloud") ? " https://*.livekit.cloud wss://*.livekit.cloud" : ` https://${host} wss://${host}`;
  } catch {
    return "";
  }
}
const LIVEKIT_CONNECT = liveKitConnect();

/** Rasm manbalari: o'zimiz, data/blob, YouTube muqovalari, Vercel Blob, R2, next.config images.remotePatterns hostlari */
const IMG_HOSTS = `https://i.ytimg.com https://*.public.blob.vercel-storage.com https://picsum.photos https://images.unsplash.com https://i.pravatar.cc${R2_PUBLIC_ORIGIN}`;

function nonceValue(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * Nonce asosidagi CSP: inline/yuklanadigan skriptlar faqat shu so'rovning nonce'i bilan ishlaydi ('strict-dynamic' —
 * Next'ning o'zi yuklaydigan chunklar ham ruxsatli). Next so'rov sarlavhasidagi CSP'dan nonce'ni o'qib, o'z
 * skriptlariga qo'yadi; layout.tsx tema skriptiga x-nonce orqali uzatiladi. Dev'da HMR uchun 'unsafe-eval' va ws:.
 * Ramkalar: YouTube (nocookie), Vimeo pleyeri va to'lov checkout'lari; service worker va manifest — faqat o'z domenimizdan.
 */
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${IS_PROD ? "" : " 'unsafe-eval' 'unsafe-inline'"}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${IMG_HOSTS}`,
    // Video/audio faqat o'z domenimizdan, Vercel Blob va R2'dan (chat videosi) — barcha https emas
    `media-src 'self' https://*.public.blob.vercel-storage.com${R2_PUBLIC_ORIGIN}`,
    `frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com ${PAYMENT_HOSTS}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    // Blob/R2 hostlari — chat videosi brauzerdan to'g'ridan-to'g'ri Vercel Blob yoki R2'ga (presigned PUT) yuklanadi
    `connect-src 'self' ${PAYMENT_HOSTS} https://blob.vercel-storage.com https://*.public.blob.vercel-storage.com${R2_ENDPOINT_ORIGIN}${R2_PUBLIC_ORIGIN}${LIVEKIT_CONNECT}${IS_PROD ? "" : " ws: wss:"}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    `form-action 'self' ${PAYMENT_HOSTS}`,
  ].join("; ");
}

/** Sahifa javobi: so'rov sarlavhalariga nonce + CSP (Next uchun), javobga CSP */
function pageResponse(req: NextRequest, extra?: (h: Headers) => void): NextResponse {
  const nonce = nonceValue();
  const csp = buildCsp(nonce);
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set("content-security-policy", csp);
  extra?.(reqHeaders);
  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

function withCsp(res: NextResponse): NextResponse {
  res.headers.set("Content-Security-Policy", buildCsp(nonceValue()));
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isProtected = pathname.startsWith("/kabinet") || pathname.startsWith("/admin") || pathname === "/buyurtma" || pathname.startsWith("/buyurtma/") || pathname.startsWith("/tolov");
  const isAuthPage = pathname.startsWith("/auth/");
  const role = isProtected || isAuthPage ? await readRole(req) : null;

  // Himoyalangan sahifalar
  if (isProtected) {
    if (!role) {
      const url = req.nextUrl.clone();
      url.pathname = "/auth/kirish";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return withCsp(NextResponse.redirect(url));
    }
    if (pathname.startsWith("/admin") && role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/kabinet";
      url.search = "";
      return withCsp(NextResponse.redirect(url));
    }
    // Sahifa (getCurrentUser) eskirgan sessiyani aniqlasa, qayerga qaytishni bilishi uchun yo'lni uzatamiz.
    // Mijoz yuborgan qiymat e'tiborga olinmaydi (ustidan yoziladi).
    return pageResponse(req, (h) => h.set("x-pathname", pathname + search));
  }

  // Kirgan foydalanuvchini auth sahifalaridan kabinetga (yoki ?next= manzilga) yo'naltiramiz.
  // Parol tiklash sahifalari istisno: havola emaildan ochilganda sessiya bo'lishi ham mumkin.
  if (role && isAuthPage && !pathname.startsWith("/auth/parol-tiklash")) {
    const next = safeNext(req.nextUrl.searchParams.get("next"), req.nextUrl.origin);
    const url = new URL(next ?? "/kabinet", req.nextUrl.origin);
    return withCsp(NextResponse.redirect(url));
  }

  return pageResponse(req);
}

export const config = {
  // Barcha sahifalar (nonce CSP). API (/api — next.config'dagi statik CSP), yuklangan fayllar, Next statik
  // resurslari va kengaytmali fayllar (rasm, shrift, manifest…) tashqarida qoladi — ularga nonce kerak emas.
  matcher: ["/((?!api/|_next/static|_next/image|uploads/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|txt|xml|webmanifest|js|css|map)$).*)"],
};

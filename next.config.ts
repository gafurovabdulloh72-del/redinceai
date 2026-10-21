import type { NextConfig } from "next";

/**
 * Dev rejimida ishga tushish vaqtida yoziladigan papkalar (SQLite bazasi, yuklangan rasmlar)
 * webpack kuzatuvidan chiqariladi. Aks holda har bir DB yozuvi (ko'rishlar hisobi, buyurtma,
 * sharh) qayta kompilyatsiya qo'zg'atadi, chunklar qayta yoziladi va brauzer yarim yozilgan
 * faylni olib "Invalid or unexpected token" xatosi bilan qoladi.
 */
const RUNTIME_WRITE_DIRS = ["data", "public/uploads"];

function withRuntimeDirsIgnored(prev: unknown): RegExp | string[] {
  const root = process.cwd().replace(/\\/g, "/").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const extraSource = `^${root}/(${RUNTIME_WRITE_DIRS.join("|")})(/|$)`;
  const extraGlobs = RUNTIME_WRITE_DIRS.map((d) => `**/${d}/**`);
  // Webpack sxemasi: RegExp YOKI string[] (aralash bo'lishi mumkin emas)
  if (prev instanceof RegExp) return new RegExp(`${prev.source}|${extraSource}`, prev.flags);
  if (Array.isArray(prev)) return [...prev.filter((p): p is string => typeof p === "string"), ...extraGlobs];
  if (typeof prev === "string") return [prev, ...extraGlobs];
  return extraGlobs;
}

/* ------------------------------------------------------------------ */
/* Xavfsizlik sarlavhalari                                             */
/* ------------------------------------------------------------------ */
const isProd = process.env.NODE_ENV === "production";

/**
 * Sahifalar uchun CSP (nonce bilan) src/middleware.ts'da har so'rovda tuziladi. Bu yerda faqat statik
 * sarlavhalar va API javoblari uchun qat'iy CSP (JSON — skript/ramka umuman kerak emas).
 */
const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

/**
 * Cloudflare R2 ommaviy bazasi (R2_PUBLIC_BASE) dan next/image uchun remotePattern — env'dan dinamik.
 * Env yo'q yoki noto'g'ri bo'lsa bo'sh ro'yxat qaytadi (build/start sinmaydi).
 */
function r2RemotePatterns(): { protocol: "https"; hostname: string }[] {
  try {
    const base = process.env.R2_PUBLIC_BASE;
    if (!base) return [];
    const u = new URL(base);
    if (u.protocol !== "https:") return [];
    return [{ protocol: "https", hostname: u.hostname }];
  } catch {
    return [];
  }
}

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // camera/microphone/display-capture=(self): video qo'ng'iroq (LiveKit) + ekran ulashish + ovozli xabar — faqat o'z sahifalarimizda, iframe/uchinchi tomonga yo'q
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), display-capture=(self), geolocation=(self)" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Dev'dagi "N" indikatori mobil tab-barni to'sib qo'yadi (skrinshot QA)
  devIndicators: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      ...r2RemotePatterns(),
    ],
  },
  async headers() {
    return [
      { source: "/(.*)", headers: SECURITY_HEADERS },
      { source: "/api/:path*", headers: [{ key: "Content-Security-Policy", value: API_CSP }] },
      // public/uploads static RASM fayllari (route handler ishlamaganda ham) brauzerda ochilsin.
      // Faqat rasm kengaytmalari — hujjat (PDF/DOC) va videoga tegmaydi, ular route handler'dagi
      // Content-Disposition qaroriga (hujjat = attachment) bo'ysunadi.
      { source: "/uploads/:name.:ext(jpg|jpeg|png|webp|gif)", headers: [{ key: "Content-Disposition", value: "inline" }] },
    ];
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = { ...config.watchOptions, ignored: withRuntimeDirsIgnored(config.watchOptions?.ignored) };
    }
    return config;
  },
};

export default nextConfig;

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

/** To'lov tizimlari (Payme/Click) checkout sahifalari — iframe va form yuborish uchun */
const PAYMENT_HOSTS = "https://checkout.paycom.uz https://checkout.test.paycom.uz https://my.click.uz";

const CSP = [
  "default-src 'self'",
  // Inline skript: tema init (<head>), Next runtime. 'unsafe-eval' faqat dev (HMR/source map)
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' https:",
  `frame-src https://www.youtube.com https://www.youtube-nocookie.com ${PAYMENT_HOSTS}`,
  // Dev'da HMR websocket
  `connect-src 'self' https:${isProd ? "" : " ws: wss:"}`,
  "font-src 'self' data:",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  `form-action 'self' ${PAYMENT_HOSTS}`,
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = { ...config.watchOptions, ignored: withRuntimeDirsIgnored(config.watchOptions?.ignored) };
    }
    return config;
  },
};

export default nextConfig;

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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = { ...config.watchOptions, ignored: withRuntimeDirsIgnored(config.watchOptions?.ignored) };
    }
    return config;
  },
};

export default nextConfig;

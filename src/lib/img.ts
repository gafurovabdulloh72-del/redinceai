/**
 * Rasm optimizatsiyasi (kamchilik #81): xom <img> saqlangan holda Next'ning o'z
 * optimizatoridan (`/_next/image` — resize + WebP/AVIF, Vercel'da CDN kesh) foydalanamiz.
 * next/image komponentiga ko'chirish shart emas — layout o'zgarmaydi, faqat `src/srcSet`
 * optimizator manziliga almashadi. Server va klientda bir xil ishlaydi (sof funksiya).
 *
 * QOIDA: faqat o'zimizning yo'llar (/uploads/...) va next.config `images.remotePatterns`da
 * OQ RO'YXATDAGI hostlar optimizatsiya qilinadi — aks holda optimizator 400 qaytarib,
 * SafeImage/AvatarImage «buzilgan» deb yashirib qo'yadi. Yangi host qo'shsangiz IKKI joyga
 * yozing: next.config.ts remotePatterns + shu fayldagi REMOTE_OK.
 * SVG/GIF (animatsiya) va data:/blob: manbalar o'zgarishsiz qoladi.
 */

/** Next standart ruxsat etilgan kengliklari (deviceSizes + imageSizes) — boshqa `w` 400 oladi */
const WIDTHS = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];

/** next.config.ts images.remotePatterns bilan SINXRON tutiladi */
const REMOTE_OK = ["public.blob.vercel-storage.com", "i.ytimg.com", "picsum.photos", "images.unsplash.com"];

const SKIP_RE = /\.(?:svg|gif)(?:[?#]|$)/i;

function hostAllowed(host: string): boolean {
  return REMOTE_OK.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Manba optimizatsiyaga yaroqlimi (lokal /uploads yoki oq ro'yxatdagi https host) */
export function canOptimizeImg(src: string): boolean {
  if (!src || SKIP_RE.test(src)) return false;
  if (src.startsWith("/")) return !src.startsWith("/_next") && !src.startsWith("//");
  if (src.startsWith("https://")) {
    try {
      return hostAllowed(new URL(src).hostname);
    } catch {
      return false;
    }
  }
  return false;
}

function nearestWidth(w: number): number {
  for (const x of WIDTHS) if (x >= w) return x;
  return WIDTHS[WIDTHS.length - 1];
}

function optUrl(src: string, w: number, q: number): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=${q}`;
}

export interface OptimizedImg {
  src: string;
  srcSet?: string;
}

/**
 * `cssWidth` — rasm EKRANDA egallaydigan taxminiy kenglik (px). Natija: 2x (retina) asosiy src
 * va 1x/2x srcSet. Yaroqsiz manba o'zgarishsiz qaytadi — chaqiruvchi tekshirmasa ham xavfsiz.
 */
export function optimizedImg(src: string | null | undefined, cssWidth: number, q = 75): OptimizedImg {
  if (!src || !canOptimizeImg(src)) return { src: src ?? "" };
  const w1 = nearestWidth(Math.max(16, Math.round(cssWidth)));
  const w2 = nearestWidth(w1 * 2);
  if (w1 === w2) return { src: optUrl(src, w2, q) };
  return { src: optUrl(src, w2, q), srcSet: `${optUrl(src, w1, q)} 1x, ${optUrl(src, w2, q)} 2x` };
}

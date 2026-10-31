/**
 * OG rasmlar uchun brend elementlari (satori JSX): «k» plitka belgisi + «kasb egalari» so'z belgisi.
 * Geometriya `components/layout/Logo.tsx` bilan bir xil. Shrift: Space Grotesk Bold (statik TTF —
 * satori woff2'ni o'qimaydi); yuklanmasa tizim sans bilan davom etadi (rasm buzilmaydi).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const BRAND_FONT = "Space Grotesk";

/** «k» glifi 64×64 viewBox koordinatalarida (satori `transform` atributini qo'llamaydi — oldindan hisoblangan) */
const K_PATH_64 = "M18.29 52.0V12.0H25.49V34.11H26.51L35.89 23.66H45.26L32.17 37.37L45.71 52.0H36.46L26.51 40.74H25.49V52.0Z";

let cache: Promise<ArrayBuffer | null> | null = null;
/** Brend shrifti (ArrayBuffer) — ImageResponse `fonts` uchun; xato bo'lsa null.
 *  `process.cwd()` + statik yo'l — Next output tracing faylni Vercel bundle'iga qo'shadi. */
export function loadBrandFont(): Promise<ArrayBuffer | null> {
  cache ??= readFile(join(process.cwd(), "src/fonts/SpaceGrotesk-Bold.ttf"))
    .then((b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
    .catch(() => null);
  return cache;
}

/** ImageResponse uchun `{ fonts }` — shrift yuklanmasa BO'SH obyekt (satori `fonts: []` ni qabul qilmaydi: standart shrift o'chadi) */
export async function brandFonts(): Promise<{ fonts?: { name: string; data: ArrayBuffer; weight: 700; style: "normal" }[] }> {
  const data = await loadBrandFont();
  return data ? { fonts: [{ name: BRAND_FONT, data, weight: 700, style: "normal" }] } : {};
}

/** Plitka belgisi: oq plitka + katta ink «k» (OG qorong'u fonda oq plitka ko'rinadi) */
export function OgMark({ size = 64, tile = "#ffffff", ink = "#121213" }: { size?: number; tile?: string; ink?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <rect width="64" height="64" rx="18" fill={tile} />
      <path d={K_PATH_64} fill={ink} />
    </svg>
  );
}

/** So'z belgisi: «kasb egalari» — «i» nuqtasi marjon doira */
export function OgWordmark({ fontSize = 40, color = "#ffffff" }: { fontSize?: number; color?: string }) {
  const dot = Math.round(fontSize * 0.22);
  return (
    <div style={{ display: "flex", fontFamily: `'${BRAND_FONT}', ui-sans-serif, system-ui, sans-serif`, fontSize, fontWeight: 700, letterSpacing: -fontSize * 0.045, color, lineHeight: 1 }}>
      kasb egalar
      <div style={{ display: "flex", position: "relative" }}>
        ı
        <div style={{ position: "absolute", left: "50%", top: fontSize * 0.08, width: dot, height: dot, marginLeft: -dot / 2, borderRadius: 9999, background: "#ff5a36" }} />
      </div>
    </div>
  );
}

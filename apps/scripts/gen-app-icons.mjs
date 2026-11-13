// Ilova ikonkalari (desktop + Android) — `src/app/icon.svg` bilan bir xil belgi (ink plitka + «k»).
// Ishlatish: node apps/scripts/gen-app-icons.mjs   (sharp — loyiha node_modules'idan)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const K = "M70 0V700H196V313H214L378 496H542L313 256L550 0H388L214 197H196V0Z";
const INK = "#1a1a1c";
const CREAM = "#f6f4ee";

/** Plitka: `pad` — chetdagi bo'shliq (0…0.5), `radius` — burchak (plitka kengligiga nisbatan) */
function tile({ pad = 0, radius = 0.28, bg = true } = {}) {
  const s = 1024;
  const inset = s * pad;
  const w = s - inset * 2;
  // «k» glifi plitka balandligining 62% i (Logo.tsx bilan bir xil nisbat)
  const gh = w * 0.62;
  const scale = gh / 700;
  const gw = 550 * scale;
  const x = inset + (w - gw) / 2;
  const y = inset + (w + gh) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
${bg ? `<rect x="${inset}" y="${inset}" width="${w}" height="${w}" rx="${w * radius}" fill="${INK}"/>` : ""}
<path d="${K}" transform="translate(${x} ${y}) scale(${scale} ${-scale})" fill="${CREAM}"/></svg>`;
}

async function png(svg, size, out, flatten) {
  mkdirSync(dirname(out), { recursive: true });
  let img = sharp(Buffer.from(svg)).resize(size, size);
  if (flatten) img = img.flatten({ background: flatten });
  writeFileSync(out, await img.png().toBuffer());
  console.log("✓", out.replace(root + "/", ""), size);
}

// Desktop: macOS uslubidagi bo'shliqli plitka (electron-builder .ico/.icns'ni shundan yasaydi)
await png(tile({ pad: 0.09, radius: 0.225 }), 1024, join(root, "apps/desktop/build/icon.png"));
await png(tile({ pad: 0.09, radius: 0.225 }), 256, join(root, "apps/desktop/assets/icon.png"));

// Android: eski launcher (to'liq plitka) + adaptiv old qatlam (108dp, xavfsiz zona 66dp)
const res = join(root, "apps/android/app/src/main/res");
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)) {
  await png(tile({ pad: 0.04, radius: 0.24 }), Math.round(48 * k), join(res, `mipmap-${d}/ic_launcher.png`));
  await png(tile({ pad: 0.31, bg: false }), Math.round(108 * k), join(res, `mipmap-${d}/ic_launcher_foreground.png`));
  // Bildirishnoma kichik ikonkasi — faqat oq siluet (Android rangni o'zi beradi)
  await png(tile({ pad: 0.1, bg: false }).replace(CREAM, "#ffffff"), Math.round(24 * k), join(res, `drawable-${d}/ic_notification_icon.png`));
}
// Ochilish ekrani (splash) rasmi
await png(tile({ pad: 0, radius: 0.24 }), 288, join(res, "drawable/splash.png"));

// Windows vazifalar paneli nishonlari (1…9, 9+) — nativeImage SVG o'qimaydi, shuning uchun tayyor PNG
for (const label of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "9+"]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="#d63f1a"/><text x="32" y="${label.length > 1 ? 42 : 44}" font-family="Arial, Helvetica, sans-serif" font-size="${label.length > 1 ? 28 : 34}" font-weight="700" fill="#fff" text-anchor="middle">${label}</text></svg>`;
  await png(svg, 32, join(root, `apps/desktop/assets/badge-${label === "9+" ? "10" : label}.png`));
}

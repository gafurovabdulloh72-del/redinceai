import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";

/**
 * PWA manifest (F97). theme_color — Paper fon; qorong'u rejim rangi root layout'dagi viewport.themeColor
 * (prefers-color-scheme media) orqali beriladi — brauzer manifestdan ustun qo'yadi.
 */
export default function manifest(): MetadataRoute.Manifest {
  const icon = [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }];
  return {
    id: "/",
    name: `${SITE.name} — ${SITE.tagline}`,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    // globals.css --bg (yorug') bilan bir xil — splash ekran va sahifa foni orasida rang sakrashi bo'lmasin
    background_color: "#fafaf8",
    theme_color: "#fafaf8",
    lang: "uz",
    dir: "ltr",
    categories: ["business", "photo", "productivity"],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Xarita", short_name: "Xarita", description: "Hudud bo'yicha ijodkorlarni xaritadan toping", url: "/xarita?source=pwa", icons: icon },
      { name: "Mutaxassislar", short_name: "Mutaxassislar", description: "Videograf, montajor, dizaynerlar ro'yxati", url: "/mutaxassislar?source=pwa", icons: icon },
      { name: "Jamoalar", short_name: "Jamoalar", description: "Kanallar, guruhlar va jonli efirlar", url: "/jamoalar?source=pwa", icons: icon },
      { name: "Vakansiyalar", short_name: "Vakansiyalar", description: "Onlayn kasblar bo'yicha ish o'rinlari", url: "/vakansiyalar?source=pwa", icons: icon },
      { name: "Ishlar", short_name: "Ishlar", description: "Mijozlar e'lonlari va takliflar", url: "/ishlar?source=pwa", icons: icon },
      { name: "Kabinet", short_name: "Kabinet", description: "Buyurtmalar, to'lovlar va bildirishnomalar", url: "/kabinet?source=pwa", icons: icon },
    ],
  };
}

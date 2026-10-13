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
    background_color: "#f6f4ee",
    theme_color: "#f6f4ee",
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
      { name: "Ishlar", short_name: "Ishlar", description: "Mijozlar e'lonlari va takliflar", url: "/ishlar?source=pwa", icons: icon },
      { name: "Kabinet", short_name: "Kabinet", description: "Buyurtmalar, to'lovlar va bildirishnomalar", url: "/kabinet?source=pwa", icons: icon },
    ],
  };
}

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  // /taqqoslash — ko'ruvchining tanlovi (noindex), /u/ — qisqa havola (profilga 308)
  // "/buyurtma/" — oxirida "/" muhim: prefiks sifatida /buyurtma-berish (sehrgar) ni ham yopib qo'ymasin
  // /chek/ (to'lov cheki), /yozish/ (shaxsiy chat), /tolov (checkout), /offline (SW zaxira sahifasi), /tg (Telegram Mini App darvozasi) — indekslanmaydi
  // "/backup/" va "/old-admin/" — YEM (tuzoq): saytda bunday bo'lim YO'Q. Halol botlar Disallow'ga amal qilib kirmaydi;
  // robots.txt'dan «yashirin joy» qidiradigan skaner esa aynan shu yerga borib tuzoqqa tushadi (security/trap-patterns.ts).
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/kabinet", "/admin", "/api", "/buyurtma/", "/auth", "/taqqoslash", "/u/", "/chek/", "/yozish/", "/tolov", "/offline", "/tg", "/backup/", "/old-admin/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

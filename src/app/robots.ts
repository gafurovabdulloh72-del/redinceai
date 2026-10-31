import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  // /taqqoslash — ko'ruvchining tanlovi (noindex), /u/ — qisqa havola (profilga 308)
  // "/buyurtma/" — oxirida "/" muhim: prefiks sifatida /buyurtma-berish (sehrgar) ni ham yopib qo'ymasin
  // /chek/ (to'lov cheki), /yozish/ (shaxsiy chat), /tolov (checkout), /offline (SW zaxira sahifasi), /tg (Telegram Mini App darvozasi) — indekslanmaydi
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/kabinet", "/admin", "/api", "/buyurtma/", "/auth", "/taqqoslash", "/u/", "/chek/", "/yozish/", "/tolov", "/offline", "/tg"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

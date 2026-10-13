import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    // /taqqoslash — ko'ruvchining tanlovi (noindex), /u/ — qisqa havola (profilga 308)
    rules: [{ userAgent: "*", allow: "/", disallow: ["/kabinet", "/admin", "/api", "/buyurtma", "/auth", "/taqqoslash", "/u/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}

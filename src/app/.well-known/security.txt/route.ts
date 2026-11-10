import { SITE } from "@/lib/constants";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/**
 * RFC 9116 `security.txt` — xavfsizlik tadqiqotchilari kamchilikni KIMGA va QANDAY xabar berishini shu yerdan topadi.
 * `Expires` har so'rovda bugundan 180 kun (majburiy maydon; eskirgan fayl ishonchsiz hisoblanadi).
 */
export function GET() {
  const expires = new Date(Date.now() + 180 * 86_400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const body = [
    "# Kasb Egalari — xavfsizlik bo'yicha aloqa. Iltimos, buzib kirmang: topganingizni bizga yozing :)",
    `Contact: ${SITE_URL}/xavfsizlik`,
    `Contact: ${SITE.supportTelegram}`,
    `Expires: ${expires}`,
    "Preferred-Languages: uz, ru, en",
    `Canonical: ${SITE_URL}/.well-known/security.txt`,
    `Policy: ${SITE_URL}/xavfsizlik`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

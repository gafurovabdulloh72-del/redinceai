import "server-only";
import { SITE_URL } from "@/lib/site-url";

/**
 * IndexNow (Yandex, Bing, Seznam, Naver — Google qo'llamaydi): yangi/yangilangan sahifalarni qidiruv
 * tizimiga DARHOL bildirish — sitemap'ni kutmasdan. Kalit `INDEXNOW_KEY` (8–128 ta [a-zA-Z0-9-]),
 * tasdiqlash fayli `/indexnow-key.txt` (app/indexnow-key.txt/route.ts) — `keyLocation` bilan beriladi.
 * Kalit yo'q bo'lsa jimgina o'tkaziladi (dev/preview). Bir so'rovda ≤10 000 URL — biz 1 000 taga bo'lib yuboramiz.
 */
const ENDPOINT = "https://api.indexnow.org/indexnow";
const CHUNK = 1000;

export function indexNowKey(): string | null {
  const k = process.env.INDEXNOW_KEY?.trim();
  return k && /^[a-zA-Z0-9-]{8,128}$/.test(k) ? k : null;
}

export async function pingIndexNow(urls: string[]): Promise<{ sent: number; skipped: boolean; status?: number; error?: string }> {
  const key = indexNowKey();
  const host = SITE_URL.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const list = [...new Set(urls)].filter((u) => u.startsWith(`${SITE_URL}/`) || u === SITE_URL || u === `${SITE_URL}/`);
  if (!key || !SITE_URL.startsWith("https://") || !list.length) return { sent: 0, skipped: true };
  let sent = 0;
  let last = 0;
  for (let i = 0; i < list.length; i += CHUNK) {
    const chunk = list.slice(i, i + CHUNK);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ host, key, keyLocation: `${SITE_URL}/indexnow-key.txt`, urlList: chunk }),
        signal: AbortSignal.timeout(15000),
      });
      last = res.status;
      // 200/202 — qabul qilindi; 4xx — kalit/host xatosi (logga)
      if (res.ok || res.status === 202) sent += chunk.length;
      else console.error("[indexnow]", res.status, (await res.text().catch(() => "")).slice(0, 200));
    } catch (e) {
      return { sent, skipped: false, status: last, error: e instanceof Error ? e.message : String(e) };
    }
  }
  return { sent, skipped: false, status: last };
}

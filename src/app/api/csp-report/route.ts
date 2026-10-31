import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const MAX_BYTES = 16 * 1024;
const PER_IP = 30; // bir nusxada IP bo'yicha soatiga
const WINDOW_MS = 60 * 60 * 1000;
const empty = (status = 204) => new Response(null, { status, headers: { "cache-control": "no-store" } });
const clip = (v: unknown, n: number) => String(v ?? "").replace(/[\r\n\t]/g, " ").slice(0, n);
/** Hujjat manzilidan so'rov/hash olib tashlanadi — token yoki shaxsiy parametr logga tushmasin */
const pathOnly = (v: unknown) => clip(v, 300).replace(/[?#].*$/, "");
/** Brauzer kengaytmalari sahifaga o'z skriptini qo'shadi — bu bizning xatomiz emas, logni to'ldirmasin */
const NOISE = /^(chrome|moz|safari|ms-browser|webkit-masked)-extension:|^(about|data|blob):?$/i;

/**
 * Xotiradagi limit (har serverless nusxasida alohida): hisobot faqat logga yoziladi, shuning uchun bazaga
 * har so'rovda yozib (rate_limits) uni qimmatlashtirish shart emas — kengaytmasi bor foydalanuvchi har sahifada
 * hisobot yuborishi mumkin.
 */
const hits = new Map<string, { n: number; reset: number }>();
function allow(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  const cur = hits.get(ip);
  if (!cur || cur.reset <= now) {
    hits.set(ip, { n: 1, reset: now + WINDOW_MS });
    return true;
  }
  cur.n += 1;
  return cur.n <= PER_IP;
}

/**
 * CSP buzilish hisobotlari (2026-10-31, xavfsizlik auditi): brauzer `report-uri` (application/csp-report) va
 * `report-to` (application/reports+json) orqali yuboradi. handler() ishlatilmaydi — brauzer bunday so'rovni
 * Origin/CSRF qoidalarisiz jo'natadi. Faqat ixcham yozuv Vercel loglariga («[csp]»), bazaga hech narsa yozilmaydi.
 * Himoya: IP bo'yicha limit, tana ≤16 KB, bir so'rovda ≤5 hisobot, maydonlar qisqartiriladi, kengaytma shovqini tashlanadi.
 */
export async function POST(req: NextRequest) {
  if (!allow(clientIp(req))) return empty(); // limitdan oshgan — jim (brauzer qayta urinmaydi)
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) return empty(413);
  const text = (await req.text().catch(() => "")).slice(0, MAX_BYTES);
  let items: Record<string, unknown>[] = [];
  try {
    const j = JSON.parse(text) as unknown;
    if (Array.isArray(j)) items = j.map((r) => ((r as { body?: unknown })?.body ?? r) as Record<string, unknown>);
    else if (j && typeof j === "object") items = [((j as Record<string, unknown>)["csp-report"] ?? j) as Record<string, unknown>];
  } catch {
    return empty(400);
  }
  for (const r of items.slice(0, 5)) {
    if (!r || typeof r !== "object") continue;
    const blocked = pathOnly(r["blocked-uri"] ?? r.blockedURL);
    const source = pathOnly(r["source-file"] ?? r.sourceFile);
    if (NOISE.test(blocked) || NOISE.test(source)) continue;
    console.warn(
      "[csp]",
      JSON.stringify({
        directive: clip(r["effective-directive"] ?? r.effectiveDirective ?? r["violated-directive"], 60),
        blocked,
        page: pathOnly(r["document-uri"] ?? r.documentURL),
        source,
        line: Number(r["line-number"] ?? r.lineNumber ?? 0) || undefined,
      }),
    );
  }
  return empty();
}

import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getVerifiedSession, type SessionPayload } from "./auth";
import { checkSameOrigin } from "./security/origin";
import { flattenErrors } from "./validators";
import { LOCALE_COOKIE, pickLocale, type Locale } from "./i18n";
import { ADMIN_2FA_MESSAGE, adminTwoFactorRequired } from "@/lib/security/admin-2fa";
import { attackSignature, isCanaryToken, trapClient } from "./security/trap-patterns";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
    /** Javobga qo'shiladigan sarlavhalar (masalan, Retry-After) */
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

/**
 * Muvaffaqiyatli JSON javob. API javoblari ko'ruvchiga bog'liq (cookie bo'yicha maskalanadi), shuning uchun
 * standart `Cache-Control: private, no-store` — umumiy kesh/CDN bir foydalanuvchining DTO'sini boshqasiga bermasin.
 * Haqiqatan ommaviy, statik ma'lumot uchun init.headers orqali o'z Cache-Control'ingizni bering.
 */
export function ok<T>(data: T, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("cache-control")) headers.set("cache-control", "private, no-store");
  return NextResponse.json({ ok: true, data }, { ...init, headers });
}

export function fail(status: number, message: string, fields?: Record<string, string>, headers?: Record<string, string>) {
  // Xato javobi ham shaxsiy (401/403/422 matnlari) — CDN/brauzer keshlamasin (prod-check shuni tekshiradi)
  return NextResponse.json({ ok: false, error: message, fields }, { status, headers: { "cache-control": "private, no-store", ...headers } });
}

export interface HandlerOptions {
  /**
   * CSRF (Origin/Referer) tekshiruvi — standart: yoqilgan. Faqat tashqi tizimlar (Payme/Click
   * webhook'lari) chaqiradigan route'larda `csrf: false` qo'ying va o'z imzosini tekshiring.
   */
  csrf?: boolean;
  /**
   * Asosiy tezlik chegarasi (2026-10-25 auditi, 9-band). Standart: HAR qanday mutatsiyada
   * (POST/PUT/PATCH/DELETE) foydalanuvchi yoki IP bo'yicha {@link BASE_MUTATION_LIMIT}.
   * Bu — «tubi»: route o'zining aniqroq `enforceLimit()`ini qo'shishi mumkin va qo'shishi kerak.
   * `limit: false` — faqat webhook'lar uchun (ular o'z imzosi bilan himoyalangan va tashqi
   * tizim tezligini biz boshqarmaymiz).
   */
  limit?: false;
}

/** Har mutatsiya route'i uchun asosiy chegara: bitta HISOB soatiga 300 ta o'zgartirish */
export const BASE_MUTATION_LIMIT = { limit: 300, windowMs: 60 * 60 * 1000 } as const;

/**
 * Mehmon uchun IP bo'yicha chegara ANIQ YUMSHOQ: O'zbekistonda mobil operatorlar NAT ortida
 * minglab odamni bitta IP'da ko'rsatadi — 300 ta qo'ysak, bir operator abonentlari birgalikda
 * ro'yxatdan o'ta olmay qoladi. Mehmon tega oladigan mutatsiyalar (kirish, ro'yxat, parol tiklash,
 * til, Telegram bilan kirish) allaqachon o'zining qattiq limitlariga ega — bu faqat qo'pol DoS to'sig'i.
 */
export const GUEST_MUTATION_LIMIT = { limit: 2000, windowMs: 60 * 60 * 1000 } as const;

/**
 * Asosiy chegara: mutatsiya usullarida hisob (yoki mehmonda IP) bo'yicha.
 * `rate-limit` moduli `ApiError`ni shu fayldan import qiladi — doiraviy importni oldini olish
 * uchun dinamik import (birinchi chaqiruvdan keyin keshlanadi).
 */
async function baseLimit(req: Request): Promise<void> {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  const [{ rateLimit }, { clientIp }] = await Promise.all([import("./security/rate-limit"), import("./security/request")]);
  const session = await getVerifiedSession();
  const { limit, windowMs } = session ? BASE_MUTATION_LIMIT : GUEST_MUTATION_LIMIT;
  const key = session ? `api:u:${session.sub}` : `api:ip:${clientIp(req)}`;
  await rateLimit(key, limit, windowMs);
}

/**
 * Bloklangan IP tekshiruvi (honeypot — tuzoqqa tushgan yoki qo'lda bloklangan): barcha usullarda, GET ham.
 * Kesh (60 s) tufayli arzon — odatda bazaga bormaydi. Dinamik import (aylanma import xavfini uzadi).
 */
async function blockGuard(req: Request): Promise<void> {
  try {
    const [{ ipBlockKind }, { clientIp }] = await Promise.all([import("./security/honeypot"), import("./security/request")]);
    const kind = await ipBlockKind(clientIp(req));
    if (!kind) return;
    // AVTOMATIK blok (tuzoq) faqat brauzer bo'lmagan mijozga: skaner bilan bitta NAT ortidagi haqiqiy odamlar (mobil operator —
    // minglab abonent bitta IP'da) saytdan foydalanaveradi. Aks holda hujumchi operator IP'larini birma-bir «tuzoqqa tushirib»,
    // saytni o'sha odamlarga yopib qo'ya olardi. Qo'lda (admin) blok — hamma mijozga.
    if (kind === "auto" && trapClient(req.headers, req.method) !== "tool") return;
    // Tiklanish yo'li: ALLAQACHON kirgan admin bloklangan IP'dan ham ishlay oladi — aks holda o'z IP'sini bloklab qo'ygan
    // admin blokni panel orqali yecha olmay, o'zi qulflanib qolardi.
    const s = await getVerifiedSession().catch(() => null);
    if (s?.role === "admin") return;
    throw new ApiError(403, "Kirish vaqtincha cheklangan: bu IP manzildan shubhali so'rovlar kelgan. Xato deb hisoblasangiz — t.me/kasb_egalari ga yozing");
  } catch (e) {
    if (e instanceof ApiError) throw e;
    // Kesh/baza xatosi — bloklamay o'tkazamiz (xavfsiz tomon: haqiqiy foydalanuvchi qulflanib qolmasin)
  }
}

/**
 * TUZOQ (API tomoni, 2026-11-10): middleware `/api/*` ni ko'rmaydi, shuning uchun shu yerda:
 *  - URL'da (yo'l + query) aniq hujum imzosi (XSS/SQLi/LFI/RCE) bo'lsa — so'rov route'ga YETMAYDI, 418 + hazil JSON;
 *  - soxta `.env`dagi CANARY kalit haqiqiy API'da ishlatilsa (Authorization / x-api-key / ?key|token|api_key) —
 *    aniq hujum: 30 kunlik blok (recordHoneypotHit "canary") + 403.
 * Faqat URL va sarlavhalar tekshiriladi (tana o'qilmaydi — arzon). Xato bo'lsa jim o'tadi (xizmat buzilmasin).
 * BLOKKA faqat brauzer bo'lmagan mijoz («tool») yoki SARLAVHADAGI canary kalit sanaladi (`trapClient` izohiga qarang):
 * brauzer so'rovini begona odam yuborgan bo'lishi mumkin (havola, rasm manzili) — u faqat «yumshoq» yoziladi,
 * begona saytdan kelgani esa umuman yozilmaydi.
 */
async function probeGuard(req: Request): Promise<Response | null> {
  try {
    const u = new URL(req.url);
    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const headerCanary = isCanaryToken(bearer) || isCanaryToken(req.headers.get("x-api-key"));
    const canary = headerCanary || isCanaryToken(u.searchParams.get("key")) || isCanaryToken(u.searchParams.get("token")) || isCanaryToken(u.searchParams.get("api_key"));
    const sig = canary ? null : attackSignature(u.pathname + u.search);
    if (!canary && !sig) return null;
    const client = headerCanary ? "tool" : trapClient(req.headers, req.method);
    const hard = client === "tool";
    // Yozuv: vosita — to'liq; brauzer (o'z saytimizdan yoki manzil qatoridan) va bot — yumshoq; begona saytdan — yo'q
    const record = hard || client === "nav" || client === "bot" || req.headers.get("sec-fetch-site") === "same-origin";
    if (record) {
      const [{ recordHoneypotHit }, { clientIp }, { after }] = await Promise.all([import("./security/honeypot"), import("./security/request"), import("next/server")]);
      // Kirgan foydalanuvchi bo'lsa — urinish uning HISOBIGA ham yoziladi (jurnalda kimligi ko'rinadi, ball to'planadi)
      const session = await getVerifiedSession().catch(() => null);
      if (session) {
        const { noteAbuse } = await import("./security/abuse");
        void noteAbuse({ id: session.sub, role: session.role }, canary && headerCanary ? "canary" : "probe", `${req.method} ${u.pathname}${u.search}`, clientIp(req));
      }
      const hit = { ip: clientIp(req), kind: canary ? ("canary" as const) : ("probe" as const), method: req.method, path: (u.pathname + u.search).slice(0, 300), userAgent: req.headers.get("user-agent") ?? "", note: `${canary ? "canary kalit haqiqiy API'da" : `imzo: ${sig}`}${session ? ` · hisob: ${session.sub}` : ""}`, soft: !hard };
      try {
        after(() => recordHoneypotHit(hit));
      } catch {
        void recordHoneypotHit(hit).catch(() => undefined);
      }
    }
    return NextResponse.json(
      {
        ok: false,
        // Himoya qanday ishlashi (nima soxta, nima bloklanadi) javobda AYTILMAYDI — faqat hazil
        error: "Salom, haker! Bu yerda bu ishlamaydi 🙂 Iltimos, buzib kirmang 🙏",
        report: "/xavfsizlik",
      },
      { status: canary ? 403 : 418, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return null;
  }
}

/** Muzlatilgan hisob (ko'p ruxsatsiz urinish — security/abuse.ts): chiqish va joriy holatni o'qishdan boshqa hamma so'rovga 429 */
async function abuseGuard(req: Request): Promise<void> {
  let frozen = false;
  try {
    const { anyAbuseFrozen, isAbuseFrozen } = await import("./security/abuse");
    // Odatiy holat — muzlatilgan hisob yo'q: sessiya ham o'qilmaydi (qo'shimcha so'rov yo'q)
    if (!(await anyAbuseFrozen())) return;
    const session = await getVerifiedSession();
    if (!session || session.role === "admin") return;
    frozen = await isAbuseFrozen(session.sub);
  } catch {
    return; // kesh/baza xatosi — cheklamaymiz
  }
  if (!frozen) return;
  const path = new URL(req.url).pathname;
  if (path === "/api/auth/logout" || path === "/api/auth/me") return;
  const { ABUSE_FROZEN_MESSAGE } = await import("./security/abuse");
  throw new ApiError(429, ABUSE_FROZEN_MESSAGE);
}

/**
 * Ruxsatsiz urinishni hisobga olish: faqat KIRGAN foydalanuvchi va faqat o'zi yuborgan so'rov (begona sayt yoki rasm/iframe
 * orqali «yubortirilgan» GET sanalmaydi — aks holda birovni havola bilan aldab, hisobini muzlatib qo'yish mumkin bo'lardi).
 * Admin yo'liga urinish og'irroq sanaladi. Xato tashlamaydi.
 */
async function noteDenied(req: Request, status: number): Promise<void> {
  try {
    const method = req.method.toUpperCase();
    const site = req.headers.get("sec-fetch-site");
    const dest = req.headers.get("sec-fetch-dest");
    if (site === "cross-site") return;
    if ((method === "GET" || method === "HEAD") && dest !== null && dest !== "empty") return;
    const session = await getVerifiedSession();
    if (!session) return;
    const u = new URL(req.url);
    const [{ noteAbuse }, { clientIp }] = await Promise.all([import("./security/abuse"), import("./security/request")]);
    const kind = status === 403 && u.pathname.startsWith("/api/admin") ? "admin" : "denied";
    await noteAbuse({ id: session.sub, role: session.role }, kind, `${method} ${u.pathname}${u.search}`, clientIp(req));
  } catch {
    /* hisob yuritish xatosi javobga ta'sir qilmaydi */
  }
}

/**
 * Route handlerlarni o'rab, ApiError va kutilmagan xatolarni JSON'ga aylantiradi.
 * GET/HEAD/OPTIONS'dan boshqa usullarda so'rov manbasi (Origin yoki Referer) o'z hostimizga
 * teng bo'lishi shart — aks holda 403. curl testlarida: -H "Origin: http://localhost:3000".
 */
export function handler<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<Response>, opts: HandlerOptions = {}) {
  return async (req: Request, ctx: Ctx) => {
    try {
      if (opts.csrf !== false) {
        const problem = checkSameOrigin(req);
        if (problem) throw new ApiError(403, `${problem}. Sahifani yangilab, qayta urinib ko'ring`);
      }
      // Imzo bilan himoyalangan tashqi webhook'lar (Payme/Click — `csrf: false`) tuzoq/blok tekshiruvidan o'tmaydi
      if (opts.csrf !== false) {
        await blockGuard(req);
        const trapped = await probeGuard(req);
        if (trapped) return trapped;
      }
      if (opts.limit !== false) await baseLimit(req);
      if (opts.csrf !== false) await abuseGuard(req);
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) {
        // Kirgan foydalanuvchining ruxsatsiz urinishlari hisobga olinadi (security/abuse.ts — «hisob tuzog'i»); javobni kutmaydi
        if (e.status === 403 || e.status === 404) void noteDenied(req, e.status);
        return fail(e.status, e.message, e.fields, e.headers);
      }
      console.error("[api]", e);
      return fail(500, "Serverda kutilmagan xatolik");
    }
  };
}

/**
 * Sessiya talab qilish. JWT'dagi "sv" (sessiya versiyasi) baza bilan solishtiriladi —
 * parol o'zgargan yoki "hamma qurilmadan chiqish" qilingan bo'lsa eski cookie ishlamaydi.
 * Rol ham bazadan olinadi (JWT'dagi eski rol emas).
 */
export async function requireSession(roles?: SessionPayload["role"][]) {
  const session = await getVerifiedSession();
  if (!session) throw new ApiError(401, "Avval tizimga kiring");
  if (roles && !roles.includes(session.role)) throw new ApiError(403, "Ruxsat yo'q");
  // ADMIN_REQUIRE_2FA=1: admin huquqi bilan ochiladigan route'lar 2FA'siz adminga yopiq (security/admin-2fa.ts)
  if (session.role === "admin" && roles?.includes("admin") && adminTwoFactorRequired() && !session.totp) throw new ApiError(403, ADMIN_2FA_MESSAGE);
  return session;
}

/** So'rov cookie'sidan til (`til=ru`) — 422 xabarlarini tilga moslash uchun; bo'lmasa uz (next/headers'siz — route'dan tashqarida ham ishlaydi) */
export function requestLocale(req: Request): Locale {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`));
  const v = m ? decodeURIComponent(m[1]) : "";
  // Ko'rinish tili (uz | uz_cyrl | ru | en) → lug'at tili: ru/en → ru, qolgani uz
  return v === "en" ? "ru" : pickLocale(v);
}

const INVALID_BODY: Record<Locale, string> = { uz: "Ma'lumotlarni tekshiring", ru: "Проверьте данные" };
const INVALID_QUERY: Record<Locale, string> = { uz: "So'rov parametrlari noto'g'ri", ru: "Неверные параметры запроса" };
const INVALID_JSON: Record<Locale, string> = { uz: "JSON noto'g'ri", ru: "Неверный JSON" };

/**
 * `onlyProvided` — QISMAN YANGILASH (PATCH) uchun MAJBURIY: natijada faqat so'rovda HAQIQATAN yuborilgan kalitlar qoladi.
 * Sabab (2026-11-10 topilgan xato): zod v4'da `schema.partial()` ichidagi `.default(...)` yo'q kalit uchun ham ishlaydi —
 * `PATCH {status:"closed"}` vakansiyaning kompaniya/talab/format/ko'nikmalarini standart qiymatga QAYTARIB yuborardi
 * (jamoada esa yopiq jamoa ochiqqa, kanal guruhga aylanishi mumkin edi). `.partial()` li sxemani bu bayroqsiz ishlatmang.
 */
export async function parseBody<S extends z.ZodTypeAny>(req: Request, schema: S, opts: { onlyProvided?: boolean } = {}): Promise<z.output<S>> {
  const til = requestLocale(req);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, INVALID_JSON[til]);
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new ApiError(422, INVALID_BODY[til], flattenErrors(result.error, til));
  if (opts.onlyProvided && raw && typeof raw === "object" && !Array.isArray(raw) && result.data && typeof result.data === "object") {
    const given = new Set(Object.keys(raw as Record<string, unknown>));
    const data = result.data as Record<string, unknown>;
    for (const k of Object.keys(data)) if (!given.has(k)) delete data[k];
  }
  return result.data;
}

export function parseQuery<S extends z.ZodTypeAny>(url: string, schema: S, req?: Request): z.output<S> {
  const til = req ? requestLocale(req) : "uz";
  const params = Object.fromEntries(new URL(url).searchParams.entries());
  const result = schema.safeParse(params);
  if (!result.success) throw new ApiError(422, INVALID_QUERY[til], flattenErrors(result.error, til));
  return result.data;
}

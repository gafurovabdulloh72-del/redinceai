import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getVerifiedSession, type SessionPayload } from "./auth";
import { checkSameOrigin } from "./security/origin";
import { flattenErrors } from "./validators";
import { ADMIN_2FA_MESSAGE, adminTwoFactorRequired } from "@/lib/security/admin-2fa";

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
  return NextResponse.json({ ok: false, error: message, fields }, { status, headers });
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
      if (opts.limit !== false) await baseLimit(req);
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return fail(e.status, e.message, e.fields, e.headers);
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

export async function parseBody<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "JSON noto'g'ri");
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new ApiError(422, "Ma'lumotlarni tekshiring", flattenErrors(result.error));
  return result.data;
}

export function parseQuery<S extends z.ZodTypeAny>(url: string, schema: S): z.output<S> {
  const params = Object.fromEntries(new URL(url).searchParams.entries());
  const result = schema.safeParse(params);
  if (!result.success) throw new ApiError(422, "So'rov parametrlari noto'g'ri", flattenErrors(result.error));
  return result.data;
}

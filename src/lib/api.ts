import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getVerifiedSession, type SessionPayload } from "./auth";
import { checkSameOrigin } from "./security/origin";
import { flattenErrors } from "./validators";

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

import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getSession, type SessionPayload } from "./auth";
import { flattenErrors } from "./validators";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(status: number, message: string, fields?: Record<string, string>) {
  return NextResponse.json({ ok: false, error: message, fields }, { status });
}

/** Route handlerlarni o'rab, ApiError va kutilmagan xatolarni JSON'ga aylantiradi */
export function handler<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return fail(e.status, e.message, e.fields);
      console.error("[api]", e);
      return fail(500, "Serverda kutilmagan xatolik");
    }
  };
}

export async function requireSession(roles?: SessionPayload["role"][]) {
  const session = await getSession();
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

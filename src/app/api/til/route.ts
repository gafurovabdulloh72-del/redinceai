import { NextResponse, type NextRequest } from "next/server";
import { DISPLAY_LOCALES, LOCALE_COOKIE, pickDisplayLocale } from "@/lib/i18n";
import { safeInternalPath } from "@/lib/utils";
import { clientIp, enforceLimit, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const YEAR = 60 * 60 * 24 * 365;

/** IP bo'yicha chegara (handler() bu route'da ishlatilmaydi — javob cookie/redirect) */
async function limited(req: NextRequest): Promise<boolean> {
  try {
    await enforceLimit("locale", clientIp(req));
    return false;
  } catch {
    return true;
  }
}

function setCookie(res: NextResponse, til: string) {
  res.cookies.set(LOCALE_COOKIE, til, { path: "/", maxAge: YEAR, sameSite: "lax" });
}

/** Tilni almashtirish: POST { til: "uz" | "uz_cyrl" | "ru" | "en" } — fetch + router.refresh() uchun */
export async function POST(req: NextRequest) {
  if (await limited(req)) return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  let til: unknown;
  try {
    til = ((await req.json()) as { til?: unknown })?.til;
  } catch {
    return NextResponse.json({ error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  if (!DISPLAY_LOCALES.includes(til as (typeof DISPLAY_LOCALES)[number])) {
    return NextResponse.json({ error: "Til noto'g'ri" }, { status: 400 });
  }
  const res = new NextResponse(null, { status: 204 });
  setCookie(res, pickDisplayLocale(til));
  return res;
}

/** JS'siz zaxira: GET /api/til?t=ru&next=/mutaxassislar — cookie + redirect (faqat ichki yo'l) */
export async function GET(req: NextRequest) {
  if (await limited(req)) return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  const til = pickDisplayLocale(req.nextUrl.searchParams.get("t"));
  // Ochiq redirect emas: faqat sayt ichidagi yo'l ("/\evil.com" kabi backslash variantlari ham rad etiladi)
  const next = safeInternalPath(req.nextUrl.searchParams.get("next"), req.nextUrl.origin) ?? "/";
  const res = NextResponse.redirect(new URL(next, req.nextUrl.origin), 303);
  setCookie(res, til);
  return res;
}

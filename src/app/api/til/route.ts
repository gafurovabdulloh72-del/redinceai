import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { baseOf, DISPLAY_LOCALES, LOCALE_COOKIE, pickDisplayLocale, type DisplayLocale } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
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

/** Kirgan foydalanuvchi tanlagan tilni `users.lang` ga yozamiz (email/jamlama shu tilda keladi); mehmon — faqat cookie. Xato tilni almashtirishga xalal bermaydi */
async function rememberLang(til: DisplayLocale): Promise<void> {
  try {
    const session = await getSession();
    if (!session) return;
    await db.update(users).set({ lang: baseOf(til) }).where(eq(users.id, session.sub));
  } catch (e) {
    console.error("[til] users.lang", e);
  }
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
  const picked = pickDisplayLocale(til);
  setCookie(res, picked);
  await rememberLang(picked);
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
  await rememberLang(til);
  return res;
}

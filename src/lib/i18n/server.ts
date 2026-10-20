import "server-only";
import { cookies, headers } from "next/headers";
import { DEFAULT_DISPLAY, DEFAULT_LOCALE, LOCALE_COOKIE, baseOf, pickDisplayLocale, type DisplayLocale, type Locale } from "./index";

/**
 * Joriy KO'RINISH tili (uz | uz_cyrl | ru | en) — switcher va CyrillicLayer uchun.
 * 1) "til" cookie; 2) cookie bo'lmasa — brauzer tili (Accept-Language: ru → ru); 3) aks holda "uz".
 */
export async function getDisplayLocale(): Promise<DisplayLocale> {
  try {
    const c = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (c) return pickDisplayLocale(c);
  } catch {
    return DEFAULT_DISPLAY;
  }
  try {
    return fromAcceptLanguage((await headers()).get("accept-language"));
  } catch {
    return DEFAULT_DISPLAY;
  }
}

/**
 * Joriy LUG'AT (BASE) tili — server komponent/route'larda `tr()` va lug'at uchun (uz | ru).
 * Ko'rinish tili BASE'ga xaritalaanadi (uz_cyrl→uz, en→ru). Komponentlar matni BASE bilan chiziladi,
 * «uz_cyrl» tanlanganda klientda avtomatik kirillga aylantiriladi.
 */
export async function getLocale(): Promise<Locale> {
  return baseOf(await getDisplayLocale());
}

/** "ru-RU,ru;q=0.9,en;q=0.8" → ru; "uz,ru;q=0.8" → uz; bo'sh/noma'lum → uz. Eng yuqori q qiymatli ma'lum til g'olib */
export function fromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  let best: { l: Locale; q: number } | null = null;
  for (const part of header.split(",")) {
    const [tagRaw, ...params] = part.trim().split(";");
    const tag = tagRaw.toLowerCase();
    const qParam = params.find((p) => p.trim().startsWith("q="));
    const q = qParam ? Number(qParam.trim().slice(2)) : 1;
    if (!Number.isFinite(q) || q <= 0) continue;
    const l: Locale | null = tag === "ru" || tag.startsWith("ru-") ? "ru" : tag === "uz" || tag.startsWith("uz-") ? "uz" : null;
    if (l && (!best || q > best.q)) best = { l, q };
  }
  return best?.l ?? DEFAULT_LOCALE;
}

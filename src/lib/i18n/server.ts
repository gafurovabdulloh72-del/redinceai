import "server-only";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, pickLocale, type Locale } from "./index";

/**
 * Joriy til — server komponent/route'larda.
 * 1) "til" cookie; 2) cookie bo'lmasa — birinchi tashrifda brauzer tili (Accept-Language: ru birinchi o'rinda bo'lsa ru);
 * 3) aks holda "uz". Cookie faqat foydalanuvchi almashtirganda (/api/til) o'rnatiladi — avtomatik aniqlash hech narsa yozmaydi.
 */
export async function getLocale(): Promise<Locale> {
  try {
    const c = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (c) return pickLocale(c);
  } catch {
    // cookies() kontekstdan tashqarida (masalan, statik render) — standart til
    return DEFAULT_LOCALE;
  }
  try {
    return fromAcceptLanguage((await headers()).get("accept-language"));
  } catch {
    return DEFAULT_LOCALE;
  }
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

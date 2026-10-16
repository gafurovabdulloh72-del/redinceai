import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, pickLocale, type Locale } from "./index";

/** Joriy til — server komponent/route'larda. Cookie bo'lmasa "uz". */
export async function getLocale(): Promise<Locale> {
  try {
    return pickLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  } catch {
    // cookies() kontekstdan tashqarida (masalan, statik render) — standart til
    return DEFAULT_LOCALE;
  }
}

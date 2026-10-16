"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

/**
 * Serverda aniqlangan tilni klient komponentlarga yetkazadi.
 * Klientda til hech qachon o'z-o'zidan o'zgarmaydi — almashtirish /api/til + router.refresh() orqali.
 */
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Ijtimoiy qobiq: lenta sahifalarida (bosh sahifa, video lenta), kabinet va adminda katta footer ko'rsatilmaydi — ilova hissi saqlanadi.
 * Footer yo'q joyda telefon pastki tab paneli uchun joy qoldiriladi (footer bo'lsa — uning o'z `pb-28`i bor, ikki marta bo'shliq bo'lmaydi).
 */
export function FooterGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Kirish/ro'yxat — bitta ekran: na footer, na tab paneli uchun bo'shliq (telefonda tab paneli ham yashirin)
  if (pathname.startsWith("/auth")) return null;
  if (pathname === "/" || pathname === "/lenta" || pathname.startsWith("/kabinet") || pathname.startsWith("/admin")) {
    return <div aria-hidden className="h-24 md:hidden" />;
  }
  return <>{children}</>;
}

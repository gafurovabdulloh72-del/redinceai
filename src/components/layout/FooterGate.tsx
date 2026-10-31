"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Ijtimoiy qobiq: lenta sahifalarida (bosh sahifa, video lenta), kabinet va adminda katta footer ko'rsatilmaydi — ilova hissi saqlanadi.
 * Footer yo'q joyda telefon pastki tab paneli uchun joy qoldiriladi (footer bo'lsa — uning o'z `pb-28`i bor, ikki marta bo'shliq bo'lmaydi).
 */
export function FooterGate({ children, guest = false }: { children: ReactNode; guest?: boolean }) {
  const pathname = usePathname();
  // Kirish/ro'yxat — bitta ekran: na footer, na tab paneli uchun bo'shliq (telefonda tab paneli ham yashirin)
  if (pathname.startsWith("/auth")) return null;
  // Telegram Mini App darvozasi (/tg) — bitta ekran: savol-javob ro'yxati, footer chalg'itmasin
  if (pathname === "/tg" || pathname.startsWith("/tg?")) return null;
  // Mehmon uchun bosh sahifa — ilova emas, SAYT: footer ko'rinadi. Qidiruv tizimlari ham aynan shu
  // ko'rinishni oladi, footerdagi yo'nalish havolalari esa landing sahifalarga yo'l ochadi.
  const feedShell = pathname === "/" ? !guest : pathname === "/lenta";
  if (feedShell || pathname.startsWith("/kabinet") || pathname.startsWith("/admin")) {
    return <div aria-hidden className="h-24 md:hidden" />;
  }
  return <>{children}</>;
}

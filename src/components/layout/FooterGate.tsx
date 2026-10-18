"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Ijtimoiy qobiq: lenta sahifalarida (bosh sahifa, video lenta) katta footer ko'rsatilmaydi — ilova hissi saqlanadi */
export function FooterGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/lenta" || pathname.startsWith("/kabinet") || pathname.startsWith("/admin")) return null;
  return <>{children}</>;
}

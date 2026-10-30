"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Telefon uchun pastki yopishqoq amal (sticky, fixed EMAS — sahifa o'tish transformi bilan ishlaydi).
 * `targetId` elementi (masalan, ariza formasi) ekranda ko'ringanda o'zi yashirinadi — forma ustida ikkinchi tugma turmaydi.
 * `data-sticky-cta` — BackToTop tugmasi buni ko'rib yuqoriroqqa ko'tariladi (ustma-ust tushmasin).
 */
export function StickyCta({ targetId, children, className }: { targetId: string; children: ReactNode; className?: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setHidden(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [targetId]);
  return (
    <div
      data-sticky-cta=""
      aria-hidden={hidden}
      className={cn("pointer-events-none sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom)+0.5rem)] z-20 -mx-4 mt-4 px-4 transition-[opacity,transform] duration-200 sm:hidden", hidden && "translate-y-3 opacity-0", className)}
    >
      <div className={cn(!hidden && "pointer-events-auto")}>{children}</div>
    </div>
  );
}

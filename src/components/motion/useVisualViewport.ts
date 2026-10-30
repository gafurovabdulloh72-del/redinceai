"use client";

import { useEffect, useState } from "react";

/**
 * Ekranda haqiqatan ko'rinadigan maydon (visualViewport): telefonda klaviatura ochilganda balandlik kichrayadi.
 * iOS Safari `100dvh`/`fixed` ni klaviaturaga moslamaydi — to'liq ekranli chat (DmChat) shu qiymat bilan
 * balandligini belgilaydi, shunda yozish maydoni klaviatura ustida qoladi (Telegram/Instagram kabi).
 * `null` — SSR yoki klaviatura yopiq (oddiy oqim ishlaydi).
 */
export function useVisualViewport(enabled = true): { height: number; offsetTop: number } | null {
  const [vv, setVv] = useState<{ height: number; offsetTop: number } | null>(null);
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.visualViewport) {
      setVv(null);
      return;
    }
    const v = window.visualViewport;
    const on = () => {
      // Klaviatura ochiq deb hisoblaymiz: ko'rinadigan balandlik oynadan 120px+ kichik bo'lsa
      const keyboard = window.innerHeight - v.height > 120;
      setVv(keyboard ? { height: Math.round(v.height), offsetTop: Math.round(v.offsetTop) } : null);
      // iOS fokusda sahifani o'zi surib yuboradi — qaytaramiz, aks holda yuqori panel ekrandan chiqib ketadi
      if (keyboard && window.scrollY !== 0) window.scrollTo(0, 0);
    };
    on();
    v.addEventListener("resize", on);
    v.addEventListener("scroll", on);
    return () => {
      v.removeEventListener("resize", on);
      v.removeEventListener("scroll", on);
    };
  }, [enabled]);
  return vv;
}

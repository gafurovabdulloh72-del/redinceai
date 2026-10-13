"use client";

import { useEffect } from "react";

/**
 * PWA service worker (public/sw.js) — faqat productionda ro'yxatdan o'tadi (dev'da HMR bilan to'qnashmasin).
 * Dev'da avval o'rnatilgan SW bo'lsa — o'chiriladi (eski kesh dev'ni chalg'itmasin). Footer ichida bir marta chiziladi.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => void r.unregister()))
        .catch(() => {});
      return;
    }
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* SW ixtiyoriy — xato sahifani buzmasin */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}

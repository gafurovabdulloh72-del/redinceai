"use client";

import { useEffect } from "react";
import { showToast } from "@/components/ui/toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";

/**
 * PWA service worker (public/sw.js) — faqat productionda ro'yxatdan o'tadi (dev'da HMR bilan to'qnashmasin).
 * Root layout'da bir marta (ilgari footer ichida edi — footer'siz sahifalarda umuman ro'yxatdan o'tmasdi).
 * Yangilanish: yangi SW `installed` (kutish) holatiga o'tganda «Yangi versiya tayyor» toast + «Yangilash» amali —
 * SW faqat shundan keyin skipWaiting qiladi (ochiq sahifa eski chunklarni yo'qotib qolmaydi), controllerchange → reload.
 */
export function ServiceWorkerRegister() {
  const til = useLocale();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => void r.unregister()))
        .catch(() => {});
      return;
    }
    let reloading = false;
    const onController = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    const offerUpdate = (worker: ServiceWorker) => {
      showToast(tr(til, SHELL.update.available), "info", {
        duration: 15000,
        action: {
          label: tr(til, SHELL.update.reload),
          onClick: () => {
            navigator.serviceWorker.addEventListener("controllerchange", onController, { once: true });
            worker.postMessage({ type: "SKIP_WAITING" });
          },
        },
      });
    };
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // Allaqachon kutayotgan yangi versiya bo'lsa
          if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
          reg.addEventListener("updatefound", () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener("statechange", () => {
              if (nw.state === "installed" && navigator.serviceWorker.controller) offerUpdate(nw);
            });
          });
          // Sahifa ko'ringanda yangilanishni tekshirish (uzoq ochiq qolgan tab)
          const onVisible = () => {
            if (document.visibilityState === "visible") reg.update().catch(() => {});
          };
          document.addEventListener("visibilitychange", onVisible);
        })
        .catch(() => {
          /* SW ixtiyoriy — xato sahifani buzmasin */
        });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, [til]);
  return null;
}

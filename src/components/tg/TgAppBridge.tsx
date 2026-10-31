"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Telegram Mini App ko'prigi (SDK'siz) — faqat `html[data-tg-app]` bo'lsa chiziladi (layout.tsx).
 *  · Telegram «Orqaga» tugmasi: bosh sahifadan boshqa joyda ko'rinadi, bosilsa tarix bo'yicha orqaga
 *  · Vertikal surish bilan ilovani yopishni o'chiradi (lenta scroll'ida tasodifan yopilmasin)
 *  · Sarlavha/fon rangi tema bilan bir xil
 * Hodisalar: Telegram → biz: veb (web.telegram.org) `message` orqali, native mijozlar `window.Telegram.WebView.receiveEvent`.
 */
type Receiver = (eventType: string, eventData?: unknown) => void;

function postEvent(eventType: string, eventData: Record<string, unknown> = {}) {
  const w = window as unknown as { TelegramWebviewProxy?: { postEvent: (t: string, d: string) => void }; external?: { notify?: (s: string) => void } };
  try {
    if (w.TelegramWebviewProxy?.postEvent) w.TelegramWebviewProxy.postEvent(eventType, JSON.stringify(eventData));
    else if (typeof w.external?.notify === "function") w.external.notify(JSON.stringify({ eventType, eventData }));
    else if (window.parent !== window) window.parent.postMessage(JSON.stringify({ eventType, eventData }), "https://web.telegram.org");
  } catch {
    /* Telegram tashqarisida */
  }
}

function themeColors() {
  const dark = document.documentElement.getAttribute("data-theme") === "dark" || (document.documentElement.getAttribute("data-theme") !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return dark ? "#0a0a0b" : "#ffffff";
}

export function TgAppBridge() {
  const pathname = usePathname();

  // Bir marta: hodisa qabul qiluvchi, surish/yopish xulqi
  useEffect(() => {
    const handlers = new Set<Receiver>();
    const receive: Receiver = (t, d) => handlers.forEach((h) => h(t, d));
    const w = window as unknown as { Telegram?: { WebView?: { receiveEvent?: Receiver; onEvent?: (t: string, h: Receiver) => void; offEvent?: (t: string, h: Receiver) => void } } };
    w.Telegram ??= {};
    w.Telegram.WebView ??= {};
    w.Telegram.WebView.receiveEvent = receive;
    const onMessage = (e: MessageEvent) => {
      if (typeof e.data !== "string") return;
      try {
        const m = JSON.parse(e.data) as { eventType?: string; eventData?: unknown };
        if (m.eventType) receive(m.eventType, m.eventData);
      } catch {
        /* begona xabar */
      }
    };
    window.addEventListener("message", onMessage);
    const onBack: Receiver = (t) => {
      if (t !== "back_button_pressed") return;
      if (window.history.length > 1) window.history.back();
      else window.location.assign("/");
    };
    handlers.add(onBack);
    postEvent("web_app_ready");
    postEvent("web_app_expand");
    postEvent("web_app_setup_swipe_behavior", { allow_vertical_swipe: false });
    const applyTheme = () => {
      const c = themeColors();
      postEvent("web_app_set_header_color", { color: c });
      postEvent("web_app_set_background_color", { color: c });
      postEvent("web_app_set_bottom_bar_color", { color: c });
    };
    applyTheme();
    const mo = new MutationObserver(applyTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      window.removeEventListener("message", onMessage);
      mo.disconnect();
      handlers.delete(onBack);
    };
  }, []);

  // Sahifa o'zgarganda: «Orqaga» tugmasi bosh sahifadan boshqa joyda
  useEffect(() => {
    postEvent("web_app_setup_back_button", { is_visible: pathname !== "/" && pathname !== "/tg" });
  }, [pathname]);

  return null;
}

"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { syncAutoTheme } from "@/components/layout/Appearance";
import { TG_ORIGIN_RE, tgPostEvent as postEvent } from "@/lib/telegram-webapp-client";

/**
 * Telegram Mini App ko'prigi (SDK'siz) — faqat `html[data-tg-app]` bo'lsa chiziladi (layout.tsx).
 *  · Telegram «Orqaga» tugmasi: bosh sahifadan boshqa joyda ko'rinadi, bosilsa tarix bo'yicha orqaga
 *  · «Sozlamalar» (Mini App ⋯ menyusida) → /kabinet/menyu
 *  · Vertikal surish bilan ilovani yopishni o'chiradi (lenta scroll'ida tasodifan yopilmasin)
 *  · Tema: «avto» rejimda Telegram ilovasining temasi (`data-tg-scheme`), sarlavha/fon rangi sayt temasi bilan bir xil
 *  · Tashqi havolalar: t.me → Telegram ichida (web_app_open_tg_link), yangi oynadagi boshqa sayt → brauzerda (web_app_open_link)
 * Hodisalar (Telegram → biz): native mijozlar `window.Telegram.WebView.receiveEvent` / `TelegramGameProxy.receiveEvent`
 * / `TelegramGameProxy_receiveEvent`; Telegram Web — `message` (faqat *.telegram.org manbasidan va ota-oynadan).
 */
type Receiver = (eventType: string, eventData?: unknown) => void;
type TgWindow = Window & {
  Telegram?: { WebView?: { receiveEvent?: Receiver } };
  TelegramGameProxy?: { receiveEvent?: Receiver };
  TelegramGameProxy_receiveEvent?: Receiver;
};

function themeColors() {
  const dark = document.documentElement.getAttribute("data-theme") === "dark" || (document.documentElement.getAttribute("data-theme") !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return dark ? "#0a0a0b" : "#ffffff";
}

/** Telegram tema fonidan (bg_color) yorug'/qorong'u — nisbiy yorqinlik */
function schemeOf(bg: unknown): "dark" | "light" | null {
  if (typeof bg !== "string" || !/^#[0-9a-f]{6}$/i.test(bg)) return null;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5 ? "dark" : "light";
}

function applyTelegramScheme(themeParams: unknown) {
  const s = schemeOf((themeParams as { bg_color?: unknown } | null)?.bg_color);
  if (!s) return;
  document.documentElement.dataset.tgScheme = s;
  syncAutoTheme();
}

/** Ishga tushirish vaqtidagi tema (darvoza sessionStorage'ga saqlagan yoki URL hash) */
function launchThemeParams(): unknown {
  try {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("tgWebAppThemeParams");
    const saved = JSON.parse(sessionStorage.getItem("ke_tg_init") ?? "null") as { tgWebAppThemeParams?: string } | null;
    const raw = hash ?? saved?.tgWebAppThemeParams;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function TgAppBridge() {
  const pathname = usePathname();
  const router = useRouter();

  // Bir marta: hodisa qabul qiluvchilar, surish/yopish xulqi, tema, havolalar
  useEffect(() => {
    const handlers = new Set<Receiver>();
    const receive: Receiver = (t, d) => handlers.forEach((h) => h(t, d));
    const w = window as TgWindow;
    w.Telegram ??= {};
    w.Telegram.WebView ??= {};
    w.Telegram.WebView.receiveEvent = receive;
    w.TelegramGameProxy = { ...(w.TelegramGameProxy ?? {}), receiveEvent: receive };
    w.TelegramGameProxy_receiveEvent = receive;
    const onMessage = (e: MessageEvent) => {
      // Faqat Telegram Web (ota-oyna, *.telegram.org) — boshqa oyna/sayt «orqaga» yoki tema hodisasini soxtalashtira olmasin
      if (e.source !== window.parent || !TG_ORIGIN_RE.test(e.origin) || typeof e.data !== "string") return;
      try {
        const m = JSON.parse(e.data) as { eventType?: unknown; eventData?: unknown };
        if (typeof m.eventType === "string") receive(m.eventType, m.eventData);
      } catch {
        /* begona xabar */
      }
    };
    window.addEventListener("message", onMessage);

    const onEvent: Receiver = (t, d) => {
      if (t === "back_button_pressed") {
        if (window.history.length > 1) window.history.back();
        else window.location.assign("/");
      } else if (t === "settings_button_pressed") {
        router.push("/kabinet/menyu");
      } else if (t === "theme_changed") {
        applyTelegramScheme((d as { theme_params?: unknown } | undefined)?.theme_params);
      }
    };
    handlers.add(onEvent);

    postEvent("web_app_ready");
    postEvent("web_app_expand");
    postEvent("web_app_setup_swipe_behavior", { allow_vertical_swipe: false });
    postEvent("web_app_setup_settings_button", { is_visible: true });
    applyTelegramScheme(launchThemeParams());
    postEvent("web_app_request_theme");

    const applyColors = () => {
      const c = themeColors();
      postEvent("web_app_set_header_color", { color: c });
      postEvent("web_app_set_background_color", { color: c });
      postEvent("web_app_set_bottom_bar_color", { color: c });
    };
    applyColors();
    const mo = new MutationObserver(applyColors);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    // Tashqi havolalar: webview ichida target=_blank ishlamaydi yoki Mini App'ni almashtirib yuboradi
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin === window.location.origin || !/^https?:$/.test(url.protocol)) return;
      const tgLink = /^(t\.me|telegram\.me)$/i.test(url.hostname);
      if (!tgLink && a.target !== "_blank") return; // shu oynadagi o'tish (masalan to'lov sahifasi) — tegilmaydi
      e.preventDefault();
      if (tgLink) postEvent("web_app_open_tg_link", { path_full: url.pathname + url.search });
      else postEvent("web_app_open_link", { url: url.toString() });
    };
    document.addEventListener("click", onClick, true);

    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("click", onClick, true);
      mo.disconnect();
      handlers.delete(onEvent);
    };
  }, [router]);

  // Sahifa o'zgarganda: «Orqaga» tugmasi bosh sahifadan boshqa joyda
  useEffect(() => {
    postEvent("web_app_setup_back_button", { is_visible: pathname !== "/" && pathname !== "/tg" });
  }, [pathname]);

  return null;
}

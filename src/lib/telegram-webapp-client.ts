/**
 * Telegram Mini App — mijoz tomoni yordamchilari (SDK'siz; brauzerda ishlaydi, serverda chaqirilmaydi).
 * TgAppGate (darvoza), TgRegister, TgAppBridge (ko'prik) va haptics.ts umumiy ishlatadi.
 *
 * Telegram mijozlari hodisani turlicha qabul qiladi:
 *  - iOS/Android/Desktop: `window.TelegramWebviewProxy.postEvent(type, json)`
 *  - eski Windows Phone/UWP: `window.external.notify(json)`
 *  - Telegram Web (web.telegram.org — ilova iframe ichida): `parent.postMessage(json, "https://web.telegram.org")`
 */
export const TG_WEB_ORIGIN = "https://web.telegram.org";
/** Telegram Web'dan keladigan xabarlar manbasi (postMessage origin tekshiruvi) */
export const TG_ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)*telegram\.org$/;

export function tgPostEvent(eventType: string, eventData: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { TelegramWebviewProxy?: { postEvent: (t: string, d: string) => void }; external?: { notify?: (s: string) => void } };
  try {
    if (w.TelegramWebviewProxy?.postEvent) w.TelegramWebviewProxy.postEvent(eventType, JSON.stringify(eventData));
    else if (typeof w.external?.notify === "function") w.external.notify(JSON.stringify({ eventType, eventData }));
    else if (window.parent !== window) window.parent.postMessage(JSON.stringify({ eventType, eventData }), TG_WEB_ORIGIN);
  } catch {
    /* Telegram tashqarisida — ahamiyatsiz */
  }
}

/** Sahifa iframe ichidami (Telegram Web). Boshqa domendagi ota-oynaga murojaat xato beradi — demak iframe */
export function inIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Mini App ichidamiz (layout.tsx `html[data-tg-app]` — `tgapp` cookie'dan) */
export function isTgApp(): boolean {
  return typeof document !== "undefined" && document.documentElement.hasAttribute("data-tg-app");
}

/**
 * `tgapp=1` belgisi (12 soat) — `html[data-tg-app]` (footer yashirin, Telegram ko'prigi yoqiladi).
 * Telegram Web iframe'ida Lax cookie saqlanmaydi — u yerda bo'lakli (Partitioned) variant.
 */
export function markTgAppCookie(): void {
  document.cookie = inIframe() ? "tgapp=1; path=/; max-age=43200; samesite=none; secure; partitioned" : "tgapp=1; path=/; max-age=43200; samesite=lax";
}

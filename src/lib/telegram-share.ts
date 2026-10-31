"use client";

import { tgAppShareLink } from "@/lib/tg-start-param";

/**
 * Klientda Telegram orqali ulashish havolasi. Bot username `<html data-tg-bot>` dan (layout.tsx, ommaviy qiymat).
 * Ichki yo'l bo'lsa havola Mini App'da ochiladi (`t.me/<bot>?startapp=…`) — qabul qiluvchi darhol kirgan holda ko'radi;
 * bo'lmasa oddiy `t.me/share/url`.
 */
export function telegramShareHref(url: string, text: string): string {
  const bot = typeof document !== "undefined" ? document.documentElement.dataset.tgBot || null : null;
  let path: string | null = null;
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "https://localhost");
    if (typeof window !== "undefined" && u.origin === window.location.origin) path = `${u.pathname}${u.search}`;
  } catch {
    path = null;
  }
  const deep = path ? tgAppShareLink(bot, path) : null;
  return `https://t.me/share/url?url=${encodeURIComponent(deep ?? url)}&text=${encodeURIComponent(text)}`;
}

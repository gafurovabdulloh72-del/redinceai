import "server-only";
import { siteUrl } from "@/lib/security/site";

/**
 * Mini App manzili (`/tg?to=…`) — Telegram `web_app` tugmalari faqat https qabul qiladi;
 * dev'da (http) null → tugma oddiy URL bo'lib qoladi. Alohida modul: notifications.ts ↔ ui.ts aylanma importi bo'lmasin.
 */
export function appUrl(to?: string): string | null {
  const s = siteUrl() ?? "";
  if (!s.startsWith("https://")) return null;
  return `${s}/tg${to ? `?to=${encodeURIComponent(to)}` : ""}`;
}

/** Mini App «akkauntni ulash» rejimi: saytga kirgach (Google/email) Telegram chat shu hisobga ulanadi */
export function appLinkUrl(to = "/kabinet"): string | null {
  const s = siteUrl() ?? "";
  if (!s.startsWith("https://")) return null;
  return `${s}/tg?link=1&to=${encodeURIComponent(to)}`;
}

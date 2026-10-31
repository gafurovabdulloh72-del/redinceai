/**
 * Haptic (titrash) yordamchisi — mobil PWA'da like, xato toast, tema almashuvi kabi qisqa tasdiq uchun.
 * navigator.vibrate bo'lmasa (iOS Safari, desktop) yoki foydalanuvchi harakatni kamaytirgan bo'lsa — hech narsa qilmaydi.
 *   haptic("light")   — 8 ms (bosish tasdig'i)
 *   haptic("medium")  — 16 ms (yoqish/o'chirish)
 *   haptic("success") — ikki qisqa impuls
 *   haptic("error")   — uch impuls
 */
import { isTgApp, tgPostEvent } from "@/lib/telegram-webapp-client";

export type HapticKind = "light" | "medium" | "success" | "error";

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 16,
  success: [10, 40, 10],
  error: [14, 50, 14, 50, 14],
};

/** Telegram Mini App ichida — Telegram'ning o'z haptikasi (iOS'da navigator.vibrate yo'q) */
const TG_HAPTIC: Record<HapticKind, Record<string, string>> = {
  light: { type: "impact", impact_style: "light" },
  medium: { type: "impact", impact_style: "medium" },
  success: { type: "notification", notification_type: "success" },
  error: { type: "notification", notification_type: "error" },
};

export function haptic(kind: HapticKind = "light"): void {
  if (typeof window === "undefined" || prefersReducedMotion()) return;
  if (isTgApp()) {
    tgPostEvent("web_app_trigger_haptic_feedback", TG_HAPTIC[kind]);
    return;
  }
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* ba'zi brauzerlar foydalanuvchi ishorasisiz rad etadi — e'tiborsiz */
  }
}

/** OS sozlamasi YOKI foydalanuvchi tugmasi (html[data-motion="reduce"]) — ikkalasi ham "kamaytirilgan" hisoblanadi */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.dataset.motion === "reduce") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

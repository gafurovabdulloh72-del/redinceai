/**
 * Haptic (titrash) yordamchisi — mobil PWA'da like, xato toast, tema almashuvi kabi qisqa tasdiq uchun.
 * navigator.vibrate bo'lmasa (iOS Safari, desktop) yoki foydalanuvchi harakatni kamaytirgan bo'lsa — hech narsa qilmaydi.
 *   haptic("light")   — 8 ms (bosish tasdig'i)
 *   haptic("medium")  — 16 ms (yoqish/o'chirish)
 *   haptic("success") — ikki qisqa impuls
 *   haptic("error")   — uch impuls
 */
export type HapticKind = "light" | "medium" | "success" | "error";

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 16,
  success: [10, 40, 10],
  error: [14, 50, 14, 50, 14],
};

export function haptic(kind: HapticKind = "light"): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (prefersReducedMotion()) return;
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

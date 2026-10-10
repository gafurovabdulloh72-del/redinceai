"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal/menu ichida fokusni ushlab turadi:
 * - ochilganda birinchi boshqaruv elementiga fokus beradi (yoki `initial` ref'ga)
 * - Tab/Shift+Tab doira bo'ylab aylanadi, orqadagi sahifaga chiqib ketmaydi
 * - yopilganda fokus avvalgi elementga qaytadi
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, initial?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const restore = document.activeElement as HTMLElement | null;

    const focusables = () => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);

    const t = window.setTimeout(() => {
      const target = initial?.current ?? focusables()[0] ?? root;
      target.focus({ preventScroll: true });
    }, 20);

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (current === first || !root.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !root.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      restore?.focus?.({ preventScroll: true });
    };
  }, [ref, active, initial]);
}

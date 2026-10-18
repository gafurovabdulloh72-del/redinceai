"use client";

import { useEffect } from "react";

const EDITABLE = /^(INPUT|TEXTAREA|SELECT)$/;

/**
 * Qidiruv sahifasi klaviaturasi (hech narsa chizmaydi):
 * - «/» — qidiruv maydoniga fokus ([data-search-input]) — matn maydonida bo'lmasa
 * - ↓ / ↑ — natijalar ([data-result]) bo'ylab fokusni ko'chiradi; maydonda ↓ bosilsa birinchi natijaga o'tadi
 * - Esc — natijadan qidiruv maydoniga qaytadi
 */
export function ResultsKeyNav() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const input = document.querySelector<HTMLInputElement>("[data-search-input]");
      const inField = Boolean(el && (EDITABLE.test(el.tagName) || el.isContentEditable));
      if (e.key === "/" && !inField) {
        if (!input) return;
        e.preventDefault();
        input.focus();
        input.select();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Escape") return;
      const items = Array.from(document.querySelectorAll<HTMLElement>("[data-result]")).filter((x) => x.offsetParent !== null);
      if (!items.length) return;
      const idx = el ? items.indexOf(el) : -1;
      if (e.key === "Escape") {
        if (idx >= 0 && input) {
          e.preventDefault();
          input.focus();
        }
        return;
      }
      if (inField && el !== input) return;
      if (idx === -1 && !(el === input && e.key === "ArrowDown")) return;
      e.preventDefault();
      const next = idx === -1 ? 0 : Math.min(items.length - 1, Math.max(0, idx + (e.key === "ArrowDown" ? 1 : -1)));
      if (idx === 0 && e.key === "ArrowUp" && input) {
        input.focus();
        return;
      }
      items[next]?.focus();
      items[next]?.scrollIntoView({ block: "nearest" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}

"use client";

import { useEffect } from "react";

/**
 * Fon scroll qulfi — hisoblagichli: bir vaqtda bir nechta modal/sheet ochilsa, oxirgisi yopilgandagina body tiklanadi
 * (ilgari har modal o'z `prev` qiymatini saqlab, ichma-ich ochilganda `overflow: hidden` qolib ketardi).
 * Scrollbar kengligi padding-right bilan kompensatsiya qilinadi (kontent sakramaydi).
 * html[data-scroll-lock] — CSS uchun belgi (masalan, "Yuqoriga" tugmasi modal ochiq paytda yashirinadi).
 *
 *   useScrollLock(open);            // hook
 *   const release = lockScroll();   // imperativ; release() chaqiring
 */
let locks = 0;
let saved: { overflow: string; paddingRight: string } | null = null;

export function lockScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  if (locks === 0) {
    const body = document.body;
    saved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    document.documentElement.dataset.scrollLock = "true";
  }
  locks++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) {
      const body = document.body;
      body.style.overflow = saved?.overflow ?? "";
      body.style.paddingRight = saved?.paddingRight ?? "";
      saved = null;
      delete document.documentElement.dataset.scrollLock;
    }
  };
}

export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return lockScroll();
  }, [active]);
}

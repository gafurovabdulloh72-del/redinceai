"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Ochilish/yopilish uchun "mavjudlik" (presence): `open` false bo'lganda element darhol o'chirilmaydi —
 * `exitMs` davomida DOM'da qoladi va `closing=true` bo'ladi, shunda chiqish animatsiyasi o'ynaydi.
 * Reduced-motion yoqilgan bo'lsa kechikishsiz yopiladi.
 *
 *   const { mounted, closing } = usePresence(open, 200);
 *   {mounted && <div className={closing ? "pop-out" : "pop-in"} />}
 */
export function usePresence(open: boolean, exitMs = 200): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const mountedRef = useRef(open);
  mountedRef.current = mounted;

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mountedRef.current) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || exitMs <= 0) {
      setMounted(false);
      setClosing(false);
      return;
    }
    setClosing(true);
    const t = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, exitMs);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);

  return { mounted, closing };
}

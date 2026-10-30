"use client";

import { useEffect, useRef, useState } from "react";

const THRESHOLD = 72;
const MAX = 110;

/**
 * Telefon «tortib yangilash» (Instagram/Telegram odati): sahifa eng tepada turganda pastga tortilsa
 * ko'rsatkich chiqadi, 72px dan oshsa `onRefresh` chaqiriladi. Faqat sensorli ekranlarda (touch hodisalari).
 * Qaytaradi: tortilgan masofa (px) va yangilanish jarayoni bayrog'i — ko'rsatkichni chizish uchun.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown> | void, enabled = true) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const cb = useRef(onRefresh);
  cb.current = onRefresh;
  const busy = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const onStart = (e: TouchEvent) => {
      if (busy.current || window.scrollY > 0 || document.documentElement.hasAttribute("data-chat-open")) return;
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) {
        setPull(0);
        return;
      }
      // Rezina effekt: masofa oshgani sari sekinlashadi
      setPull(Math.min(MAX, dy * 0.55));
    };
    const onEnd = async () => {
      if (startY.current === null) return;
      startY.current = null;
      setPull((p) => {
        if (p >= THRESHOLD && !busy.current) {
          busy.current = true;
          setRefreshing(true);
          Promise.resolve(cb.current()).finally(() => {
            window.setTimeout(() => {
              busy.current = false;
              setRefreshing(false);
              setPull(0);
            }, 350);
          });
          return THRESHOLD * 0.8;
        }
        return 0;
      });
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled]);

  return { pull, refreshing, armed: pull >= THRESHOLD };
}

"use client";

import { useEffect, type RefObject } from "react";

/**
 * «Pastga yopishib turish» (QA A12): foydalanuvchi ro'yxat oxirida turgan bo'lsa, kontent balandligi O'ZGARGANDA ham
 * (rasmlar yuklanib bo'ldi, qadalgan xabar paneli chiqdi, klaviatura ochildi) ro'yxat oxirida qoladi. Ilgari pastga
 * tushirish faqat xabarlar ro'yxati almashganda bajarilardi — rasmli suhbat 130–400 px yuqorida ochilardi.
 *
 * `stick.current` — hozir pastga yopishganmi (komponentning scroll ishlovchisi yangilaydi); `scroller` — aylanadigan
 * konteyner; uning BIRINCHI bolasi kontent o'rami bo'lishi kerak (balandligi kuzatiladi).
 */
export function useStickyBottom(scroller: RefObject<HTMLElement | null>, stick: RefObject<boolean>, enabled = true, rev: unknown = 0) {
  useEffect(() => {
    const el = scroller.current;
    if (!enabled || !el || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const settle = () => {
      if (!stick.current) return;
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        if (stick.current) el.scrollTop = el.scrollHeight;
      });
    };
    const ro = new ResizeObserver(settle);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    // Rasm/video o'lchami ma'lum bo'lganda (load hodisasi ko'tarilmaydi — capture bilan ushlaymiz)
    el.addEventListener("load", settle, true);
    el.addEventListener("loadedmetadata", settle, true);
    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("load", settle, true);
      el.removeEventListener("loadedmetadata", settle, true);
    };
    // rev: kontent o'rami qayta yaratilganda (suhbat almashdi / skeletondan ro'yxatga o'tdi) kuzatuvchi qayta ulanadi
  }, [scroller, stick, enabled, rev]);
}

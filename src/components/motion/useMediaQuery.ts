"use client";

import { useEffect, useState } from "react";

/**
 * Media so'rovi hook'i. Serverda va birinchi chizishda `initial` qaytadi (hydration mos keladi),
 * keyin brauzer qiymati — shuning uchun faqat foydalanuvchi harakatidan keyingi tarmoqlanish uchun ishlating.
 */
export function useMediaQuery(query: string, initial = false): boolean {
  const [matches, setMatches] = useState(initial);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** Telefon (<640px, Tailwind `sm` dan kichik) */
export function useIsPhone(): boolean {
  return useMediaQuery("(max-width: 639px)");
}

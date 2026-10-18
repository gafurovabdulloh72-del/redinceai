"use client";

import { useEffect } from "react";

const PREFIX_RE = /^\(\d+\+?\)\s/;

/**
 * Brauzer sarlavhasida o'qilmaganlar soni: «(3) Kabinet · Kasb Egalari». Next har navigatsiyada <title>ni yangilaydi —
 * <head> o'zgarishlari kuzatilib, prefiks qayta qo'yiladi. 0 bo'lsa prefiks olib tashlanadi. Server DOM'iga tegmaydi.
 */
export function TitleUnread({ count }: { count: number }) {
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(PREFIX_RE, "");
      const want = count > 0 ? `(${count > 99 ? "99+" : count}) ${base}` : base;
      if (document.title !== want) document.title = want;
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      mo.disconnect();
      document.title = document.title.replace(PREFIX_RE, "");
    };
  }, [count]);
  return null;
}

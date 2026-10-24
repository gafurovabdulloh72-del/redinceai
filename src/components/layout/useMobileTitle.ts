"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SITE } from "@/lib/constants";

/**
 * Telefon yuqori panelidagi sahifa nomi.
 * Har sahifa `metadata.title` beradi va layout uni `%s · Kasb Egalari` qolipiga soladi —
 * shuning uchun qo'shimcha ulanishsiz `document.title`dan o'qiymiz (navigatsiyada MutationObserver yangilaydi).
 * Qolip qo'llanmagan (ya'ni standart) sarlavha — sahifa nomi yo'q degani: panelda logo qoladi.
 */
export function useMobileTitle(): string | null {
  const pathname = usePathname();
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      // Sahifa qisqa nom bersa (metadata.other["m-title"]) — panelda o'sha ko'rinadi
      const short = document.querySelector('meta[name="m-title"]')?.getAttribute("content")?.trim();
      if (short) return setTitle(short);
      const t = document.title;
      const suffix = ` · ${SITE.name}`;
      if (!t.endsWith(suffix)) return setTitle(null);
      // Ba'zi sahifalar sarlavhaga o'qilmagan sonini qo'shadi («(99+) Xabarlar») — panelda kerak emas
      setTitle(t.slice(0, -suffix.length).replace(/^\(\d+\+?\)\s*/, "").trim() || null);
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.head, { childList: true, characterData: true, subtree: true });
    return () => obs.disconnect();
  }, [pathname]);

  return title;
}

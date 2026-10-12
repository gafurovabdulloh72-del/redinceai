"use client";

import { useEffect, useRef, useState } from "react";
import { CoverPattern } from "@/components/ui/CoverPattern";

/**
 * Profil muqovasi: rasm muvaffaqiyatli yuklangandagina ko'rinadi va ustiga
 * o'qilishi uchun qoraytiruvchi gradient qo'yiladi. Rasm yo'q/buzilgan bo'lsa —
 * `category` berilgan bo'lsa yo'nalish naqshi (CoverPattern), aks holda hech narsa (ostidagi tinch yuza); gradient chiqmaydi.
 */
export function CoverImage({ src, category, seed }: { src: string | null; category?: string; seed?: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "broken">("loading");

  useEffect(() => {
    setState("loading");
    const el = ref.current;
    if (!el) return;
    if (el.complete) setState(el.naturalWidth > 0 ? "ok" : "broken");
  }, [src]);

  if (!src || state === "broken") return category ? <CoverPattern category={category} seed={seed} /> : null;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt=""
        onLoad={() => setState("ok")}
        onError={() => setState("broken")}
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
        style={{ opacity: state === "ok" ? 1 : 0 }}
      />
      {state === "ok" && <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />}
    </>
  );
}

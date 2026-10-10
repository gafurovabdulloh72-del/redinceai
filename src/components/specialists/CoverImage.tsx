"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Profil muqovasi: rasm muvaffaqiyatli yuklangandagina ko'rinadi va ustiga
 * o'qilishi uchun qoraytiruvchi gradient qo'yiladi. Rasm yo'q/buzilgan bo'lsa —
 * hech narsa chizilmaydi (ostidagi tinch yuza ko'rinadi), gradient ham chiqmaydi.
 */
export function CoverImage({ src }: { src: string | null }) {
  const ref = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "broken">("loading");

  useEffect(() => {
    setState("loading");
    const el = ref.current;
    if (!el) return;
    if (el.complete) setState(el.naturalWidth > 0 ? "ok" : "broken");
  }, [src]);

  if (!src || state === "broken") return null;
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

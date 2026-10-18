"use client";

import { useEffect, useRef, useState } from "react";
import { CoverPattern } from "@/components/ui/CoverPattern";

/**
 * Profil muqovasi: rasm darhol ko'rinadi (LCP'ni onLoad kutib bloklamaymiz) — placeholder fon
 * ustida qisqa CSS fade-in bilan paydo bo'ladi. Rasm yo'q/buzilgan bo'lsa —
 * `category` berilgan bo'lsa yo'nalish naqshi (CoverPattern), aks holda hech narsa (ostidagi tinch yuza); gradient chiqmaydi.
 * `priority` — birinchi ekrandagi (hero) muqova uchun: eager + fetchPriority="high"; standart — lazy.
 */
export function CoverImage({ src, category, seed, priority = false }: { src: string | null; category?: string; seed?: string; priority?: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
    const el = ref.current;
    // SSR'dan keyin hidratsiyagacha xato bergan rasm ham aniqlanadi
    if (el && el.complete && el.naturalWidth === 0) setBroken(true);
  }, [src]);

  if (!src || broken) return category ? <CoverPattern category={category} seed={seed} /> : null;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt=""
        width={1600}
        height={600}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        onError={() => setBroken(true)}
        /* Qisqa fade — `animate-fade-in` tokeni (xom keyframes emas; reduced-motion'da o'chadi); rasm ko'rinishi onLoad'ga bog'lanmaydi */
        className="animate-fade-in absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" aria-hidden="true" />
    </>
  );
}

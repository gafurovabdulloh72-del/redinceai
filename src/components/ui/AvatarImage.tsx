"use client";

import { useEffect, useRef, useState } from "react";
import { optimizedImg } from "@/lib/img";

/**
 * Avatar rasmi: yuklanmasa umuman chizilmaydi (buzilgan-rasm belgisi chiqmaydi),
 * ostidagi bosh harflar / neytral fon ko'rinadi. SSR'dan keyin ham tekshiradi.
 * width/height har doim beriladi (CLS yo'q); `priority` — birinchi ekrandagi avatar uchun eager + fetchPriority="high".
 */
export function AvatarImage({ src, size, className, priority = false }: { src: string; size: number; className?: string; priority?: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  const [broken, setBroken] = useState(false);
  // Optimizator xato bersa asl manzilga qaytamiz (avatar yo'qolib qolmasin)
  const [deopt, setDeopt] = useState(false);

  useEffect(() => {
    setBroken(false);
    setDeopt(false);
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setBroken(true);
  }, [src]);

  if (broken) return null;
  // Kamchilik #81: to'liq o'lchamli yuklangan foto o'rniga avatar o'lchamiga resize + WebP (/_next/image)
  const opt = deopt ? { src, srcSet: undefined } : optimizedImg(src, size);
  const optimized = opt.src !== src;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={opt.src}
      srcSet={opt.srcSet}
      alt=""
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      onError={() => (optimized ? setDeopt(true) : setBroken(true))}
      className={className ?? "absolute inset-0 h-full w-full object-cover"}
    />
  );
}

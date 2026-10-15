"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Avatar rasmi: yuklanmasa umuman chizilmaydi (buzilgan-rasm belgisi chiqmaydi),
 * ostidagi bosh harflar / neytral fon ko'rinadi. SSR'dan keyin ham tekshiradi.
 * width/height har doim beriladi (CLS yo'q); `priority` — birinchi ekrandagi avatar uchun eager + fetchPriority="high".
 */
export function AvatarImage({ src, size, className, priority = false }: { src: string; size: number; className?: string; priority?: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setBroken(true);
  }, [src]);

  if (broken) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt=""
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      onError={() => setBroken(true)}
      className={className ?? "absolute inset-0 h-full w-full object-cover"}
    />
  );
}

"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes, type ReactNode } from "react";

/**
 * Yuklanmagan rasm o'rniga `fallback` ko'rsatadi (yoki hech narsa).
 * SSR'dan keyin hidratsiyagacha xato bergan rasmlarni ham aniqlaydi
 * (img.complete && naturalWidth === 0), shuning uchun onError o'tkazib yuborilmaydi.
 */
export function SafeImage({
  fallback = null,
  alt,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { alt: string; fallback?: ReactNode }) {
  const ref = useRef<HTMLImageElement>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setBroken(true);
  }, [props.src]);

  if (broken || !props.src) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} alt={alt} onError={() => setBroken(true)} {...props} />;
}

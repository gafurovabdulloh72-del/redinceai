"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes, type ReactNode } from "react";

/**
 * Yuklanmagan rasm o'rniga `fallback` ko'rsatadi (yoki hech narsa).
 * SSR'dan keyin hidratsiyagacha xato bergan rasmlarni ham aniqlaydi
 * (img.complete && naturalWidth === 0), shuning uchun onError o'tkazib yuborilmaydi.
 * `overlayClassName` — faqat rasm bor paytda uning ustiga qo'yiladigan qatlam (masalan qoraytiruvchi gradient; fallback ustida emas).
 */
export function SafeImage({
  fallback = null,
  overlayClassName,
  alt,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { alt: string; fallback?: ReactNode; overlayClassName?: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setBroken(true);
  }, [props.src]);

  if (broken || !props.src) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img ref={ref} alt={alt} onError={() => setBroken(true)} {...props} />;
  if (!overlayClassName) return img;
  return (
    <>
      {img}
      <div className={overlayClassName} aria-hidden="true" />
    </>
  );
}

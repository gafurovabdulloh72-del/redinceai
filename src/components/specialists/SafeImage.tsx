"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes, type ReactNode } from "react";

/**
 * Yuklanmagan rasm o'rniga `fallback` ko'rsatadi (yoki hech narsa).
 * SSR'dan keyin hidratsiyagacha xato bergan rasmlarni ham aniqlaydi
 * (img.complete && naturalWidth === 0), shuning uchun onError o'tkazib yuborilmaydi.
 * `overlayClassName` — faqat rasm bor paytda uning ustiga qo'yiladigan qatlam (masalan qoraytiruvchi gradient; fallback ustida emas).
 * Standart: loading="lazy"; birinchi ekrandagi (LCP) rasm uchun `priority` — eager + fetchPriority="high".
 * CLS oldini olish uchun o'lchami ma'lum joylarda width/height berib yuboring (props orqali o'tadi).
 */
export function SafeImage({
  fallback = null,
  overlayClassName,
  alt,
  priority = false,
  loading,
  fetchPriority,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { alt: string; fallback?: ReactNode; overlayClassName?: string; priority?: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setBroken(true);
  }, [props.src]);

  if (broken || !props.src) return <>{fallback}</>;
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      alt={alt}
      loading={loading ?? (priority ? "eager" : "lazy")}
      fetchPriority={fetchPriority ?? (priority ? "high" : undefined)}
      decoding="async"
      onError={() => setBroken(true)}
      {...props}
    />
  );
  if (!overlayClassName) return img;
  return (
    <>
      {img}
      <div className={overlayClassName} aria-hidden="true" />
    </>
  );
}

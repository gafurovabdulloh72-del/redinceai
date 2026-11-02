"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { optimizedImg } from "@/lib/img";

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
  optimize,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & {
  alt: string;
  fallback?: ReactNode;
  overlayClassName?: string;
  priority?: boolean;
  /** Kamchilik #81: rasm ekranda egallaydigan taxminiy kenglik (px) — /_next/image orqali resize+WebP (1x/2x srcSet) */
  optimize?: number;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [broken, setBroken] = useState(false);
  // Optimizator (/_next/image) xato bersa (masalan, host oq ro'yxatda emas) — asl manzilga qaytib bir urinib ko'ramiz
  const [deopt, setDeopt] = useState(false);

  useEffect(() => {
    setBroken(false);
    setDeopt(false);
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setBroken(true);
  }, [props.src]);

  if (broken || !props.src) return <>{fallback}</>;
  // optimize berilgan va chaqiruvchi o'z srcSet'ini bermagan bo'lsa — optimizator manzillari
  const optimized = Boolean(optimize) && !deopt && typeof props.src === "string" && !props.srcSet;
  if (optimized && optimize) {
    const opt = optimizedImg(props.src as string, optimize);
    props = { ...props, src: opt.src, srcSet: opt.srcSet };
  }
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      alt={alt}
      loading={loading ?? (priority ? "eager" : "lazy")}
      fetchPriority={fetchPriority ?? (priority ? "high" : undefined)}
      decoding="async"
      onError={() => (optimized ? setDeopt(true) : setBroken(true))}
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

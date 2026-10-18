"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { prefersReducedMotion } from "./haptics";

/**
 * Raqam sanash (count-up): 0 → value, ease-out, ~900 ms; element ko'rinish maydoniga kirganda boshlanadi.
 * Reduced-motion (OS yoki foydalanuvchi tugmasi) — darhol yakuniy qiymat. SSR'da ham yakuniy qiymat chiziladi
 * (hydration mos), sanash faqat klientda, montajdan keyin boshlanadi.
 *
 *   const { ref, display } = useCountUp(1250, { format: formatNumber });
 *   <span ref={ref}>{display}</span>
 */
export function useCountUp(
  value: number,
  opts: { duration?: number; format?: (n: number) => string; decimals?: number } = {},
): { ref: (el: HTMLElement | null) => void; display: string } {
  const { duration = 900, format, decimals = 0 } = opts;
  const [shown, setShown] = useState(value);
  const elRef = useRef<HTMLElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el || started.current) return;
    if (prefersReducedMotion() || value === 0) {
      setShown(value);
      return;
    }
    let raf = 0;
    const run = () => {
      started.current = true;
      const t0 = performance.now();
      const from = 0;
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        const e = 1 - Math.pow(1 - p, 3); // ease-out cubic
        const cur = from + (value - from) * e;
        setShown(decimals ? Number(cur.toFixed(decimals)) : Math.round(cur));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      setShown(0);
      raf = requestAnimationFrame(tick);
    };
    if (typeof IntersectionObserver === "undefined") {
      run();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((x) => x.isIntersecting)) {
          io.disconnect();
          run();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration, decimals]);

  // Qiymat tashqaridan o'zgarsa (polling) — sanashsiz yangilanadi
  useEffect(() => {
    if (started.current) setShown(value);
  }, [value]);

  return { ref: (el) => (elRef.current = el), display: format ? format(shown) : String(shown) };
}

/** Tayyor komponent: <CountUp value={1250} format={formatNumber} suffix=" ta" /> */
export function CountUp({ value, format, suffix, prefix, className, duration }: { value: number; format?: (n: number) => string; suffix?: ReactNode; prefix?: ReactNode; className?: string; duration?: number }) {
  const { ref, display } = useCountUp(value, { format, duration });
  return (
    <span ref={ref} className={className} suppressHydrationWarning>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

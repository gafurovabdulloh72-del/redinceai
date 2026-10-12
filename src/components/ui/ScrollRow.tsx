"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Gorizontal aylanadigan qator (pill/chip lentalari):
 * - chetlarda so'nish faqat o'sha tomonda yana kontent bo'lsa (--fade-l / --fade-r)
 * - ko'rinadigan strelka-ishora (mobilda ham): bosilganda ~70% kenglikka suradi; sichqonchasiz qurilmada ham ko'rinadi
 * - snap: bolalarga `snap-start` bering (scroll-fade-x scroll-snap-type beradi)
 * Strelkalar Tab tartibida emas (tabIndex=-1) — klaviaturada pill'larning o'zi fokus bilan ko'rinishga suriladi.
 */
export function ScrollRow({
  children,
  label,
  className,
  rowClassName,
  rowStyle,
}: {
  children: ReactNode;
  /** role="group" uchun aria-label */
  label: string;
  className?: string;
  /** Ichki aylanuvchi element sinflari (masalan "flex gap-1.5" yoki "grid grid-flow-col grid-rows-2 auto-cols-max gap-1.5") */
  rowClassName?: string;
  rowStyle?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ l: false, r: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const l = el.scrollLeft > 4;
      const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
      setEdges((p) => (p.l === l && p.r === r ? p : { l, r }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const c of Array.from(el.children)) ro.observe(c);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  const nudge = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.7), behavior: "smooth" });
  };

  return (
    <div className={cn("relative min-w-0", className)}>
      <div
        ref={ref}
        role="group"
        aria-label={label}
        className={cn("scroll-fade-x overflow-x-auto no-scrollbar", rowClassName)}
        style={{ ...rowStyle, ["--fade-l" as string]: edges.l ? "28px" : "0px", ["--fade-r" as string]: edges.r ? "48px" : "0px" }}
      >
        {children}
      </div>
      {edges.l && (
        <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => nudge(-1)} className="scroll-hint-btn left-0">
          <ChevronLeft size={16} />
        </button>
      )}
      {edges.r && (
        <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => nudge(1)} className="scroll-hint-btn scroll-hint-nudge right-0">
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

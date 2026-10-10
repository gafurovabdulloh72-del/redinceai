"use client";

import { useEffect } from "react";

/**
 * Sichqoncha harakatiga qarab eng yaqin .glass elementdagi yorug'lik aksini (--mx/--my)
 * va specular burchagini siljitadi. Bitta delegatsiya qilingan listener — arzon.
 */
export function GlassPointer() {
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return; // sensorli ekranlarda kerak emas

    let raf = 0;
    let target: HTMLElement | null = null;
    let x = 0;
    let y = 0;

    const apply = () => {
      raf = 0;
      if (!target) return;
      const r = target.getBoundingClientRect();
      const px = ((x - r.left) / Math.max(1, r.width)) * 100;
      const py = ((y - r.top) / Math.max(1, r.height)) * 100;
      target.style.setProperty("--mx", `${px.toFixed(1)}%`);
      target.style.setProperty("--my", `${py.toFixed(1)}%`);
      // Specular halqa burchagi: yorug'lik manbai sichqoncha tomonda
      const angle = (Math.atan2(py - 50, px - 50) * 180) / Math.PI + 90;
      target.style.setProperty("--specular-angle", `${angle.toFixed(0)}deg`);
    };

    const onMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(".glass, .glass-strong, .glass-weak") as HTMLElement | null;
      if (el !== target) {
        target?.style.removeProperty("--mx");
        target?.style.removeProperty("--my");
        target?.style.removeProperty("--specular-angle");
        target = el;
      }
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}

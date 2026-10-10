"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false, loading: () => null });

function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** 3D sahnani faqat brauzerda, WebGL bo'lsa yuklaydi; aks holda CSS shisha shakllar */
export function Hero3D({ className }: { className?: string }) {
  const [ready, setReady] = useState<null | boolean>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReady(!reduce && supportsWebGL());
    const html = document.documentElement;
    const update = () => setDark(html.dataset.theme === "dark");
    update();
    const obs = new MutationObserver(update);
    obs.observe(html, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  return (
    <div className={className} aria-hidden>
      {ready ? (
        <HeroScene dark={dark} />
      ) : (
        <div className="relative h-full w-full">
          <div className="glass-strong absolute left-[12%] top-[18%] h-28 w-28 !rounded-[32px] animate-float" />
          <div className="glass absolute left-[42%] top-[30%] h-44 w-44 !rounded-full animate-float-slow" />
          <div className="glass-weak absolute right-[12%] top-[55%] h-24 w-40 !rounded-full animate-float" />
        </div>
      )}
    </div>
  );
}

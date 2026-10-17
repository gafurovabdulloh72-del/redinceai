"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Sahifa almashinuvida tepada ingichka accent progress chizig'i (Safari/YouTube uslubi).
 * Ichki havola bosilganda boshlanadi, yangi marshrut render bo'lgach tugaydi. Tashqi/yangi oyna havolalari e'tiborga olinmaydi.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      if (url.hash && url.pathname === location.pathname) return;
      setState("loading");
      if (timer.current) window.clearTimeout(timer.current);
      // Xavfsizlik: 8 soniyadan keyin baribir yashirinadi (prefetch bo'lsa navigatsiya darhol tugaydi)
      timer.current = window.setTimeout(() => setState("idle"), 8000);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Marshrut o'zgardi — tugatish animatsiyasi
  const key = `${pathname}?${search?.toString() ?? ""}`;
  useEffect(() => {
    setState((s) => (s === "loading" ? "done" : s));
    const t = window.setTimeout(() => setState("idle"), 420);
    return () => window.clearTimeout(t);
  }, [key]);

  if (state === "idle") return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-[2px]">
      <div className={state === "loading" ? "nav-progress nav-progress-loading" : "nav-progress nav-progress-done"} />
    </div>
  );
}

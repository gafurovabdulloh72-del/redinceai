"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Sahifa almashinuvida tepada ingichka accent progress chizig'i.
 * Ichki havola bosilganda (bubble bosqichida — React handler preventDefault qilgan bo'lsa boshlanmaydi) va
 * orqaga/oldinga (popstate) boshlanadi, yangi marshrut render bo'lgach tugaydi. Tashqi/yangi oyna havolalari e'tiborga olinmaydi.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const start = () => {
      setState("loading");
      if (timer.current) window.clearTimeout(timer.current);
      // Xavfsizlik: 8 soniyadan keyin baribir yashirinadi
      timer.current = window.setTimeout(() => setState("idle"), 8000);
    };
    const onClick = (e: MouseEvent) => {
      // Bubble bosqichi: React'ning onClick'i allaqachon ishlagan — preventDefault bo'lsa navigatsiya bo'lmaydi
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      if (url.hash && url.pathname === location.pathname) return;
      start();
    };
    const onPop = () => start();
    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPop);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  // Marshrut o'zgardi — tugatish animatsiyasi
  const key = `${pathname}?${search?.toString() ?? ""}`;
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setState((s) => (s === "loading" ? "done" : s));
    const t = window.setTimeout(() => setState("idle"), 420);
    return () => window.clearTimeout(t);
  }, [key]);

  if (state === "idle") return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[150] h-[2px]">
      <div className={state === "loading" ? "nav-progress nav-progress-loading" : "nav-progress nav-progress-done"} />
    </div>
  );
}

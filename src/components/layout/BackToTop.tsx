"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** Uzun sahifalarda "Yuqoriga" tugmasi — mobil tab-bar ustida, desktopda pastki o'ng burchakda */
export function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setShow(window.scrollY > 900));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Sahifa boshiga qaytish"
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      className={cn(
        "card-elevated fixed right-4 z-40 flex h-11 w-11 items-center justify-center !rounded-full text-fg-2 transition-all duration-300 hover:text-fg sm:right-6",
        "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <ArrowUp size={18} />
    </button>
  );
}

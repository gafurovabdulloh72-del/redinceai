"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";
import { cn } from "@/lib/utils";

/**
 * Uzun sahifalarda «Yuqoriga» tugmasi — mobil tab-bar ustida (tab-bar 76px + 12px bo'shliq), desktopda pastki o'ng burchakda.
 * Sahifada pastki yopishqoq CTA paneli (`data-sticky-cta`) bo'lsa, tugma uning ustiga ko'tariladi.
 * Modal/sheet ochiq paytda (html[data-scroll-lock]) yashirinadi — varaq ustida qolib ketmasin.
 */
export function BackToTop() {
  const til = useLocale();
  const [show, setShow] = useState(false);
  const [aboveCta, setAboveCta] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setShow(window.scrollY > 900);
        setAboveCta(document.querySelector("[data-sticky-cta]") !== null);
      });
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
      aria-label={tr(til, SHELL.common.toTop)}
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      data-print-hide
      className={cn(
        "card-elevated fixed right-4 z-40 flex h-11 w-11 items-center justify-center !rounded-full text-fg-2 transition-all duration-300 hover:text-fg sm:right-6 [:root[data-scroll-lock]_&]:pointer-events-none [:root[data-scroll-lock]_&]:opacity-0",
        aboveCta ? "bottom-[calc(9.75rem+env(safe-area-inset-bottom))] md:bottom-24 lg:bottom-6" : "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <ArrowUp size={18} />
    </button>
  );
}

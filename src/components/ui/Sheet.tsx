"use client";

import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { usePresence } from "@/components/motion/usePresence";
import { useScrollLock } from "@/components/motion/useScrollLock";
import { useFocusTrap } from "@/components/motion/useFocusTrap";
import { prefersReducedMotion } from "@/components/motion/haptics";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";
import { cn } from "@/lib/utils";

/**
 * Umumiy pastki varaq (Sheet): telefonda pastdan chiqadi (tutqich, pastga surib yopish), sm+ da markazdagi oyna
 * (`desktop="sheet"` bo'lsa hamma joyda pastki varaq). Portal (body), kirish/chiqish animatsiyasi (usePresence),
 * fokus tuzog'i + fokus qaytishi, fon scroll qulfi (hisoblagichli), Escape va fon bosilganda yopiladi.
 *
 *   <Sheet open={open} onClose={() => setOpen(false)} title="Yaratish">…</Sheet>
 */
export function Sheet({
  open,
  onClose,
  title,
  label,
  children,
  footer,
  className,
  desktop = "center",
  size = "md",
  hideClose = false,
}: {
  open: boolean;
  onClose: () => void;
  /** Sarlavha (h2); berilmasa `label` majburiy (aria-label) */
  title?: ReactNode;
  label?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** sm+ da: markazdagi oyna (standart) yoki baribir pastki varaq */
  desktop?: "center" | "sheet";
  size?: "sm" | "md" | "lg";
  hideClose?: boolean;
}) {
  const til = useLocale();
  const { mounted, closing } = usePresence(open, 240);
  const [ready, setReady] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => setReady(true), []);
  useScrollLock(open);
  // Tuzoq panel DOM'da bo'lgandagina (mounted — usePresence bir kadr keyin true bo'ladi)
  useFocusTrap(panelRef, open && mounted && ready);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /* ---- Pastga surib yopish (faqat telefon varaq rejimida) ---- */
  const drag = useRef<{ y0: number; t0: number; dy: number; active: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const isSheetMode = useCallback(() => desktop === "sheet" || !window.matchMedia("(min-width: 640px)").matches, [desktop]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!isSheetMode()) return;
    // Ichki aylantirilgan ro'yxat tepasida bo'lmasa — bu scroll, surish emas
    let el = e.target as HTMLElement | null;
    const panel = panelRef.current;
    while (el && el !== panel) {
      if (el.scrollHeight > el.clientHeight + 1 && el.scrollTop > 0 && getComputedStyle(el).overflowY !== "visible") return;
      el = el.parentElement;
    }
    drag.current = { y0: e.clientY, t0: performance.now(), dy: 0, active: false };
    const onMove = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dy = Math.max(0, ev.clientY - d.y0);
      if (!d.active && dy > 8) {
        d.active = true;
        setDragging(true);
      }
      if (!d.active) return;
      d.dy = dy;
      if (panel) panel.style.translate = `0 ${dy}px`;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      const d = drag.current;
      drag.current = null;
      setDragging(false);
      if (!d || !d.active) return;
      const v = d.dy / Math.max(1, performance.now() - d.t0); // px/ms
      if (panel) panel.style.translate = "";
      if (d.dy > 90 || v > 0.5) onClose();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };
  // Surishdan keyin bosish (click) hodisasi tugmalarga yetib bormasin
  const onClickCapture = (e: React.MouseEvent) => {
    if (dragging) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  if (!mounted || !ready) return null;
  const center = desktop === "center";
  const maxW = size === "sm" ? "sm:max-w-sm" : size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md";

  return createPortal(
    <div
      className={cn("fixed inset-0 z-[120] flex items-end justify-center bg-ink/55", center && "sm:items-center sm:p-6", closing ? "overlay-out" : "overlay-in")}
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? label : undefined}
        tabIndex={-1}
        data-dragging={dragging || undefined}
        onClick={(e) => e.stopPropagation()}
        onClickCapture={onClickCapture}
        onPointerDown={onPointerDown}
        className={cn(
          "sheet-drag card-elevated flex w-full max-h-[min(90dvh,calc(100dvh-0.5rem))] flex-col !rounded-b-none !rounded-t-card-lg outline-none",
          center ? cn(maxW, "sm:!rounded-card-lg") : "sm:max-w-lg",
          closing ? (center ? "sheet-out sm:animate-modal-out" : "sheet-out") : center ? "sheet-in sm:animate-modal-in" : "sheet-in",
          !prefersReducedMotion() && !dragging && "transition-[translate] duration-200",
          className,
        )}
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className={cn("sheet-handle mt-2.5 shrink-0", center && "sm:hidden")} aria-hidden />
        {(title || !hideClose) && (
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-3">
            {title ? (
              <h2 id={titleId} className="min-w-0 truncate font-display text-[17px] font-semibold text-fg">
                {title}
              </h2>
            ) : (
              <span />
            )}
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={tr(til, SHELL.common.close)}
                data-autofocus-skip
                className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3">{children}</div>
        {footer && <div className="shrink-0 px-5 pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

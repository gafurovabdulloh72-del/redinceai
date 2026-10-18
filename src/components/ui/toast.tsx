"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { haptic } from "@/components/motion/haptics";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info";
export interface ToastOptions {
  /** ms; standart 2800 (amal tugmasi bo'lsa 6000) */
  duration?: number;
  /** Toast ichidagi amal («Bekor qilish», «Yangilash») — bosilganda toast yopiladi */
  action?: { label: string; onClick: () => void };
}
interface ToastItem {
  id: number;
  text: string;
  tone: Tone;
  action?: ToastOptions["action"];
  duration: number;
  leaving?: boolean;
  at: number;
}
interface ToastApi {
  toast: (text: string, tone?: Tone, opts?: ToastOptions) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

/**
 * Qisqa tasdiq xabarlari (HUD): pastdan chiqadi, 2.8 s turadi (hover/fokusda pauza), bosilsa yoki surilsa yopiladi.
 * Har toast o'z jonli hududi: muvaffaqiyat/ma'lumot — role="status" (polite), xato — role="alert" (assertive) + haptic.
 * Bir xil matn 1 s ichida qayta kelsa — dublikat emas, vaqti yangilanadi. Eng ko'pi 3 ta.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, number>());
  // Dublikat nazorati holatdan tashqarida (state updater toza qoladi — StrictMode'da ikki marta chaqirilsa ham to'g'ri)
  const recent = useRef(new Map<string, { id: number; at: number }>());

  const clearTimer = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t);
    timers.current.delete(id);
  }, []);
  const dismiss = useCallback(
    (id: number) => {
      clearTimer(id);
      setItems((p) => p.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      window.setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 260);
    },
    [clearTimer],
  );
  const arm = useCallback(
    (id: number, ms: number) => {
      clearTimer(id);
      timers.current.set(id, window.setTimeout(() => dismiss(id), ms));
    },
    [clearTimer, dismiss],
  );
  const toast = useCallback<ToastApi["toast"]>(
    (text, tone = "success", opts = {}) => {
      const duration = opts.duration ?? (opts.action ? 6000 : 2800);
      const now = Date.now();
      const key = `${tone}\u0000${text}`;
      const r = recent.current.get(key);
      if (r && now - r.at < 1000 && timers.current.has(r.id)) {
        // Bir xil xabar 1 s ichida — yangi toast emas, vaqti yangilanadi
        r.at = now;
        arm(r.id, duration);
        return;
      }
      const id = ++seq.current;
      recent.current.set(key, { id, at: now });
      // Eng ko'pi 3 ta: eskisi chiqarib yuboriladi (uning taymeri bo'sh ro'yxatda ishlaydi — zararsiz)
      setItems((p) => [...p.slice(-2), { id, text, tone, action: opts.action, duration, at: now }]);
      arm(id, duration);
      if (tone === "error") haptic("error");
    },
    [arm],
  );
  const api = useMemo(() => ({ toast }), [toast]);

  // Boshqa modullar hook'siz ham chaqira olsin: window.dispatchEvent(new CustomEvent("toast", {detail:{text,tone,action,duration}}))
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ text: string; tone?: Tone } & ToastOptions>).detail;
      if (d?.text) toast(d.text, d.tone, { duration: d.duration, action: d.action });
    };
    window.addEventListener("toast", on);
    return () => window.removeEventListener("toast", on);
  }, [toast]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[140] flex flex-col items-center px-4 md:bottom-6">
        {items.map((t) => (
          <ToastView key={t.id} item={t} onDismiss={() => dismiss(t.id)} onPause={() => clearTimer(t.id)} onResume={() => arm(t.id, Math.min(t.duration, 1800))} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastView({ item: t, onDismiss, onPause, onResume }: { item: ToastItem; onDismiss: () => void; onPause: () => void; onResume: () => void }) {
  const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? CircleAlert : Info;
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x0: number; y0: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Swipe: yon tomonga 80px yoki pastga 60px — yopiladi; aks holda joyiga qaytadi
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    drag.current = { x0: e.clientX, y0: e.clientY, moved: false };
    onPause();
    const el = ref.current;
    const onMove = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d || !el) return;
      const dx = ev.clientX - d.x0;
      const dy = Math.max(0, ev.clientY - d.y0);
      if (!d.moved && Math.hypot(dx, dy) > 6) {
        d.moved = true;
        setDragging(true);
      }
      if (!d.moved) return;
      el.style.translate = `${dx}px ${dy}px`;
      el.style.opacity = String(Math.max(0.3, 1 - Math.max(Math.abs(dx), dy) / 160));
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      const d = drag.current;
      drag.current = null;
      setDragging(false);
      if (!el) return;
      const dx = ev.clientX - (d?.x0 ?? ev.clientX);
      const dy = ev.clientY - (d?.y0 ?? ev.clientY);
      if (d?.moved && (Math.abs(dx) > 80 || dy > 60)) {
        el.style.translate = `${dx * 2}px ${Math.max(0, dy) * 2}px`;
        el.style.opacity = "0";
        onDismiss();
        return;
      }
      el.style.translate = "";
      el.style.opacity = "";
      onResume();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const colorCls = t.tone === "success" ? "text-success" : t.tone === "error" ? "text-danger" : "text-info";
  return (
    <div className="toast-cell w-full justify-items-center" data-leaving={t.leaving || undefined}>
      <div className="pb-2">
        <div
          ref={ref}
          role={t.tone === "error" ? "alert" : "status"}
          data-dragging={dragging || undefined}
          onPointerDown={onPointerDown}
          onPointerEnter={onPause}
          onPointerLeave={onResume}
          onFocus={onPause}
          onBlur={onResume}
          className={cn(
            "toast-swipe card-floating pointer-events-auto flex max-w-[min(92vw,440px)] items-center gap-2.5 !rounded-full py-2 pl-3.5 pr-1.5 text-left text-[14px] font-semibold text-fg",
            t.leaving ? "animate-toast-out" : "animate-toast-in",
          )}
        >
          <Icon size={18} className={cn("shrink-0", colorCls)} aria-hidden />
          <span className="min-w-0 flex-1 py-0.5">{t.text}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action?.onClick();
                onDismiss();
              }}
              className="press ml-0.5 h-8 shrink-0 rounded-full px-2.5 text-[13px] font-bold text-accent-text transition hover:bg-accent-soft"
            >
              {t.action.label}
            </button>
          )}
          <button type="button" onClick={onDismiss} aria-label="×" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-4 transition hover:bg-fg/6 hover:text-fg">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  return ctx ?? { toast: (text, tone, opts) => window.dispatchEvent(new CustomEvent("toast", { detail: { text, tone, ...opts } })) };
}

/** Hook'siz chaqiruv (server action'lardan keyin klientda, yoki oddiy funksiyalarda) */
export function showToast(text: string, tone: Tone = "success", opts?: ToastOptions) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("toast", { detail: { text, tone, ...opts } }));
}

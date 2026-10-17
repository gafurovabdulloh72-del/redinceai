"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  text: string;
  tone: Tone;
  leaving?: boolean;
}
interface ToastApi {
  toast: (text: string, tone?: Tone) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

/** Qisqa tasdiq xabarlari (Apple "HUD" uslubi): pastdan chiqadi, 2.8 s turadi, bosilsa yopiladi */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => {
    setItems((p) => p.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 260);
  }, []);
  const toast = useCallback(
    (text: string, tone: Tone = "success") => {
      const id = ++seq.current;
      setItems((p) => [...p.slice(-2), { id, text, tone }]);
      window.setTimeout(() => dismiss(id), 2800);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ toast }), [toast]);
  // Boshqa modullar hook'siz ham chaqira olsin: window.dispatchEvent(new CustomEvent("toast", {detail:{text,tone}}))
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ text: string; tone?: Tone }>).detail;
      if (d?.text) toast(d.text, d.tone);
    };
    window.addEventListener("toast", on);
    return () => window.removeEventListener("toast", on);
  }, [toast]);
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-24 z-[110] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {items.map((t) => {
          const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? CircleAlert : Info;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => dismiss(t.id)}
              className={cn(
                "card-floating pointer-events-auto flex max-w-[min(92vw,420px)] items-center gap-2.5 !rounded-full py-2.5 pl-3.5 pr-3 text-left text-[13.5px] font-semibold text-fg",
                t.leaving ? "animate-toast-out" : "animate-toast-in",
              )}
            >
              <Icon size={17} className={t.tone === "success" ? "text-success" : t.tone === "error" ? "text-danger" : "text-info"} />
              <span className="min-w-0 flex-1">{t.text}</span>
              <X size={14} className="shrink-0 text-fg-4" />
            </button>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  return ctx ?? { toast: (text, tone) => window.dispatchEvent(new CustomEvent("toast", { detail: { text, tone } })) };
}

/** Hook'siz chaqiruv (server action'lardan keyin klientda, yoki oddiy funksiyalarda) */
export function showToast(text: string, tone: Tone = "success") {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("toast", { detail: { text, tone } }));
}

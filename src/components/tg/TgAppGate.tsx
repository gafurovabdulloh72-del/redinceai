"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { LogoMark, Wordmark } from "@/components/layout/Logo";

/** Telegram WebApp SDK'ning bizga kerakli qismi */
interface TgWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
  colorScheme?: "light" | "dark";
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
}
declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

type Phase = "loading" | "auth" | "outside" | "error";

/**
 * Mini App darvozasi: SDK → initData → POST /api/tg/auth → yo'naltirish.
 * SDK 4 s ichida kelmasa yoki initData bo'sh bo'lsa — «Telegram ichida oching» ekrani.
 */
export function TgAppGate({ to, botLink, nonce }: { to: string; botLink: string | null; nonce?: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const tryStart = () => {
      const wa = window.Telegram?.WebApp;
      if (!wa || started.current) return Boolean(wa);
      started.current = true;
      if (!wa.initData) {
        setPhase("outside");
        return true;
      }
      setPhase("auth");
      try {
        wa.ready();
        wa.expand();
        const dark = wa.colorScheme === "dark";
        wa.setHeaderColor?.(dark ? "#0a0a0b" : "#ffffff");
        wa.setBackgroundColor?.(dark ? "#0a0a0b" : "#ffffff");
      } catch {
        /* eski mijoz — ixtiyoriy */
      }
      void (async () => {
        try {
          const r = await fetch("/api/tg/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData: wa.initData, to }) });
          const j = (await r.json()) as { ok: boolean; data?: { next: string }; error?: string };
          if (cancelled) return;
          if (!r.ok || !j.ok) throw new Error(j.error || "Kirib bo'lmadi");
          document.cookie = "tgapp=1; path=/; max-age=43200; samesite=lax";
          window.location.replace(j.data?.next || "/");
        } catch (e) {
          if (!cancelled) {
            setErr(e instanceof Error ? e.message : "Kirib bo'lmadi");
            setPhase("error");
          }
        }
      })();
      return true;
    };
    if (tryStart()) return;
    const iv = window.setInterval(() => {
      if (tryStart()) window.clearInterval(iv);
    }, 150);
    const to4s = window.setTimeout(() => {
      window.clearInterval(iv);
      if (!started.current) setPhase("outside");
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
      window.clearTimeout(to4s);
    };
  }, [to]);

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js?58" strategy="afterInteractive" nonce={nonce} />
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <LogoMark size={72} />
        <Wordmark className="mt-4 text-[26px]" />
        {phase === "loading" || phase === "auth" ? (
          <>
            <span aria-hidden className="mt-8 h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-fg" />
            <p className="mt-4 text-[14px] text-fg-3">{phase === "auth" ? "Hisobingizga kirilmoqda…" : "Ilova yuklanmoqda…"}</p>
          </>
        ) : phase === "outside" ? (
          <>
            <p className="mt-7 text-[15px] leading-relaxed text-fg-2">Bu ilova Telegram ichida ochiladi. Botga kirib, pastdagi «Ilova» tugmasini bosing.</p>
            {botLink && (
              <a href={botLink} className="btn-ink mt-5 inline-flex h-11 items-center rounded-full px-6 text-[14px] font-semibold">
                Botni ochish
              </a>
            )}
            <a href="/" className="mt-3 text-[13px] font-semibold text-fg-3 underline-offset-4 hover:underline">
              Saytga o'tish
            </a>
          </>
        ) : (
          <>
            <p className="mt-7 text-[15px] leading-relaxed text-danger-text">{err}</p>
            <button type="button" onClick={() => window.location.reload()} className="btn-ink mt-5 inline-flex h-11 items-center rounded-full px-6 text-[14px] font-semibold">
              Qayta urinish
            </button>
          </>
        )}
      </div>
    </>
  );
}

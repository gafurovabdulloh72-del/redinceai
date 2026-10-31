"use client";

import { useEffect, useRef, useState } from "react";
import { LogoMark, Wordmark } from "@/components/layout/Logo";

/**
 * Mini App darvozasi — Telegram SDK'SIZ (tashqi skript CSP/tarmoqqa bog'liq bo'lmasin):
 * Telegram ilovani ochganda ishga tushirish ma'lumotlarini URL hash'ida beradi
 * (`#tgWebAppData=<initData>&tgWebAppVersion=…&tgWebAppPlatform=…`), SDK ham aynan shuni o'qiydi.
 * Biz hash'dan `tgWebAppData`ni olamiz → POST /api/tg/auth → sessiya → yo'naltirish.
 * Telegram'ga `web_app_ready`/`web_app_expand` hodisalari SDK usulida (TelegramWebviewProxy / external.notify / postMessage) yuboriladi.
 */
type Phase = "auth" | "outside" | "error";

function postEvent(eventType: string, eventData: Record<string, unknown> = {}) {
  const w = window as unknown as { TelegramWebviewProxy?: { postEvent: (t: string, d: string) => void }; external?: { notify?: (s: string) => void } };
  try {
    if (w.TelegramWebviewProxy?.postEvent) w.TelegramWebviewProxy.postEvent(eventType, JSON.stringify(eventData));
    else if (typeof w.external?.notify === "function") w.external.notify(JSON.stringify({ eventType, eventData }));
    else if (window.parent !== window) window.parent.postMessage(JSON.stringify({ eventType, eventData }), "https://web.telegram.org");
  } catch {
    /* Telegram tashqarisida — ahamiyatsiz */
  }
}

/** Hash yoki sessionStorage'dan initData (Telegram SDK ham `__telegram__initParams`ga shunday saqlaydi) */
function readInitData(): { initData: string; dark: boolean } | null {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  let initData = params.get("tgWebAppData") ?? "";
  let theme = params.get("tgWebAppThemeParams") ?? "";
  if (!initData) {
    try {
      const saved = JSON.parse(sessionStorage.getItem("__telegram__initParams") ?? "null") as Record<string, string> | null;
      initData = saved?.tgWebAppData ?? "";
      theme = saved?.tgWebAppThemeParams ?? theme;
    } catch {
      /* yo'q */
    }
  }
  if (!initData) return null;
  let dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  try {
    const t = JSON.parse(theme) as { bg_color?: string };
    if (t.bg_color) dark = parseInt(t.bg_color.slice(1, 3), 16) < 128;
  } catch {
    /* tema berilmagan */
  }
  return { initData, dark };
}

export function TgAppGate({ to, botLink }: { to: string; botLink: string | null }) {
  const [phase, setPhase] = useState<Phase>("auth");
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const launch = readInitData();
    if (!launch) {
      setPhase("outside");
      return;
    }
    const bg = launch.dark ? "#0a0a0b" : "#ffffff";
    postEvent("web_app_ready");
    postEvent("web_app_expand");
    postEvent("web_app_set_header_color", { color: bg });
    postEvent("web_app_set_background_color", { color: bg });
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/tg/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData: launch.initData, to }) });
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
    return () => {
      cancelled = true;
    };
  }, [to]);

  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <LogoMark size={72} />
      <Wordmark className="mt-4 text-[26px]" />
      {phase === "auth" ? (
        <>
          <span aria-hidden className="mt-8 h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-fg" />
          <p className="mt-4 text-[14px] text-fg-3">Hisobingizga kirilmoqda…</p>
        </>
      ) : phase === "outside" ? (
        <>
          <p className="mt-7 text-[15px] leading-relaxed text-fg-2">Bu ilova Telegram ichida ochiladi. Botga kirib, «Ilova» tugmasini bosing.</p>
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
  );
}

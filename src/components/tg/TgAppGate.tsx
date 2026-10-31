"use client";

import { useEffect, useRef, useState } from "react";
import { LogoMark, Wordmark } from "@/components/layout/Logo";
import { decodeStartParam } from "@/lib/tg-start-param";

/**
 * Mini App darvozasi — Telegram SDK'SIZ (tashqi skript CSP/tarmoqqa bog'liq bo'lmasin):
 * Telegram ilovani ochganda ishga tushirish ma'lumotlarini URL hash'ida beradi
 * (`#tgWebAppData=<initData>&tgWebAppVersion=…&tgWebAppPlatform=…`), SDK ham aynan shuni o'qiydi.
 * Biz hash'dan `tgWebAppData`ni olamiz → POST /api/tg/auth → sessiya → yo'naltirish.
 * Hisob YO'Q bo'lsa (2026-10-31): avtomatik hisob ochilmaydi — «Botda ro'yxatdan o'tish» (savol-javob, `/start reg`)
 * yoki «Hisobim bor — kirish» (sayt login sahifasi → `/tg?link=1` → chat hisobga ulanadi).
 * Telegram'ga `web_app_ready`/`web_app_expand` hodisalari SDK usulida (TelegramWebviewProxy / external.notify / postMessage) yuboriladi.
 */
type Phase = "auth" | "outside" | "error" | "register";
const INIT_KEY = "ke_tg_init";

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

/** Hash yoki sessionStorage'dan initData (hash'dagisi keyingi sahifalar uchun saqlab qo'yiladi — login'dan qaytganda kerak) */
function readInitData(): { initData: string; dark: boolean; startPath: string | null } | null {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  let initData = params.get("tgWebAppData") ?? "";
  let theme = params.get("tgWebAppThemeParams") ?? "";
  // Ulashilgan havola (`t.me/<bot>?startapp=…`) — qaysi sahifaga ochish: hash yoki query'da keladi
  const startPath = decodeStartParam(params.get("tgWebAppStartParam") ?? new URLSearchParams(window.location.search).get("tgWebAppStartParam"));
  if (initData) {
    try {
      sessionStorage.setItem(INIT_KEY, JSON.stringify({ tgWebAppData: initData, tgWebAppThemeParams: theme }));
    } catch {
      /* saqlanmasa ham davom etadi */
    }
  } else {
    try {
      const saved = JSON.parse(sessionStorage.getItem(INIT_KEY) ?? sessionStorage.getItem("__telegram__initParams") ?? "null") as Record<string, string> | null;
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
  return { initData, dark, startPath };
}

export function TgAppGate({ to, bot, link = false }: { to: string; bot: string | null; link?: boolean }) {
  const [phase, setPhase] = useState<Phase>("auth");
  const [err, setErr] = useState<string | null>(null);
  const [tgName, setTgName] = useState("");
  const started = useRef(false);
  const botLink = bot ? `https://t.me/${bot}` : null;

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
        const r = await fetch("/api/tg/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData: launch.initData, to: launch.startPath ?? to, ...(link ? { link: true } : {}) }) });
        const j = (await r.json()) as { ok: boolean; data?: { status?: string; next?: string; name?: string }; error?: string };
        if (cancelled) return;
        if (!r.ok || !j.ok) throw new Error(j.error || "Kirib bo'lmadi");
        if (j.data?.status === "register") {
          setTgName(j.data.name ?? "");
          setPhase("register");
          return;
        }
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
  }, [to, link]);

  /** Botdagi ro'yxatdan o'tish: Telegram ichida bot chati ochiladi (`/start reg`), ilova yopiladi */
  function openBotRegister() {
    if (!bot) return;
    postEvent("web_app_open_tg_link", { path_full: `/${bot}?start=reg` });
    window.setTimeout(() => postEvent("web_app_close"), 400);
    // Telegram tashqarisida yoki hodisa yetib bormasa — oddiy havola
    window.setTimeout(() => {
      window.location.href = `https://t.me/${bot}?start=reg`;
    }, 900);
  }
  const loginHref = `/auth/kirish?next=${encodeURIComponent(`/tg?link=1&to=${encodeURIComponent(to)}`)}`;

  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <LogoMark size={72} />
      <Wordmark className="mt-4 text-[26px]" />
      {phase === "auth" ? (
        <>
          <span aria-hidden className="mt-8 h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-fg" />
          <p className="mt-4 text-[14px] text-fg-3">{link ? "Telegram hisobga ulanmoqda…" : "Hisobingizga kirilmoqda…"}</p>
        </>
      ) : phase === "register" ? (
        <>
          <p className="mt-7 text-[16px] font-semibold text-fg">{tgName ? `Salom, ${tgName}!` : "Salom!"}</p>
          <p className="mt-2 text-[14.5px] leading-relaxed text-fg-2">Bu Telegram hali hisobga ulanmagan. Yangi hisobni botning o&apos;zida bir daqiqada ochasiz — yoki saytdagi hisobingiz bilan kiring.</p>
          <button type="button" onClick={openBotRegister} className="btn-accent mt-6 inline-flex h-12 w-full items-center justify-center rounded-full text-[15px] font-semibold">
            📝 Botda ro&apos;yxatdan o&apos;tish
          </button>
          <a href={loginHref} className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full border border-line-2 text-[15px] font-semibold text-fg">
            Hisobim bor — kirish
          </a>
          <p className="mt-4 text-[12px] leading-snug text-fg-4">Ro&apos;yxatdan o&apos;tgach botdagi «📱 Ilovani ochish» tugmasini bosing — hisobingizga avtomatik kirasiz.</p>
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
            Saytga o&apos;tish
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

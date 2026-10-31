"use client";

import { useEffect, useRef, useState } from "react";
import { LogoMark, Wordmark } from "@/components/layout/Logo";
import { TgRegister } from "@/components/tg/TgRegister";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { decodeStartParam } from "@/lib/tg-start-param";
import { inIframe, markTgAppCookie, tgPostEvent as postEvent } from "@/lib/telegram-webapp-client";

/**
 * Mini App darvozasi — Telegram SDK'SIZ (tashqi skript CSP/tarmoqqa bog'liq bo'lmasin):
 * Telegram ilovani ochganda ishga tushirish ma'lumotlarini URL hash'ida beradi
 * (`#tgWebAppData=<initData>&tgWebAppVersion=…&tgWebAppPlatform=…`), SDK ham aynan shuni o'qiydi.
 * Biz hash'dan `tgWebAppData`ni olamiz → POST /api/tg/auth → sessiya → yo'naltirish.
 * Hisob YO'Q bo'lsa (2026-10-31): avtomatik hisob ochilmaydi — «Kasb Egalari'da akkauntingiz bormi?»
 *   Yo'q → savollar ketma-ket shu yerda (`TgRegister`) → hisob + sessiya;
 *   Ha  → akkauntni ulash: Google yoki email bilan saytga kirish → `/tg?link=1` → chat hisobga ulanadi.
 * Telegram'ga `web_app_ready`/`web_app_expand` hodisalari SDK usulida (TelegramWebviewProxy / external.notify / postMessage) yuboriladi.
 */
type Phase = "auth" | "outside" | "error" | "ask" | "login" | "register";
type Lang = "uz" | "ru";
const INIT_KEY = "ke_tg_init";

/** initData ichidagi `user.language_code` — Telegram tili ruscha bo'lsa darvoza va ro'yxat ustasi ruscha (server /api/tg/auth ham `til` cookie qo'yadi) */
function langOf(initData: string): Lang {
  try {
    const u = JSON.parse(new URLSearchParams(initData).get("user") ?? "{}") as { language_code?: string };
    return (u.language_code ?? "").toLowerCase().startsWith("ru") ? "ru" : "uz";
  } catch {
    return "uz";
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

export function TgAppGate({ to, bot, link = false, googleEnabled = false }: { to: string; bot: string | null; link?: boolean; googleEnabled?: boolean }) {
  const [phase, setPhase] = useState<Phase>("auth");
  const [err, setErr] = useState<string | null>(null);
  const [tgName, setTgName] = useState("");
  const [initData, setInitData] = useState("");
  const [lang, setLang] = useState<Lang>("uz");
  // Telegram Web (iframe): Google OAuth ramka ichida ochilmaydi — faqat email/parol bilan ulash
  const [framed, setFramed] = useState(false);
  const t = (uz: string, ru: string) => (lang === "ru" ? ru : uz);
  const [target, setTarget] = useState(to);
  const started = useRef(false);
  const botLink = bot ? `https://t.me/${bot}` : null;
  // Saytga kirgach qaytish manzili: shu Mini App, ulash rejimida
  const returnPath = `/tg?link=1&to=${encodeURIComponent(target)}`;
  const loginHref = `/auth/kirish?next=${encodeURIComponent(returnPath)}`;
  const googleHref = `/api/auth/google?next=${encodeURIComponent(returnPath)}`;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const launch = readInitData();
    if (!launch) {
      setPhase("outside");
      return;
    }
    const dest = launch.startPath ?? to;
    setTarget(dest);
    setInitData(launch.initData);
    setLang(langOf(launch.initData));
    setFramed(inIframe());
    const bg = launch.dark ? "#0a0a0b" : "#ffffff";
    postEvent("web_app_ready");
    postEvent("web_app_expand");
    postEvent("web_app_set_header_color", { color: bg });
    postEvent("web_app_set_background_color", { color: bg });
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/tg/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData: launch.initData, to: dest, embedded: inIframe(), ...(link ? { link: true } : {}) }) });
        const j = (await r.json()) as { ok: boolean; data?: { status?: string; next?: string; name?: string; ticket?: string }; error?: string };
        if (cancelled) return;
        // Ulash rejimi, lekin saytga hali kirilmagan — login sahifasiga (Google yoki email), keyin shu yerga qaytadi
        if (link && r.status === 401) {
          window.location.replace(`/auth/kirish?next=${encodeURIComponent(`/tg?link=1&to=${encodeURIComponent(dest)}`)}`);
          return;
        }
        if (!r.ok || !j.ok) throw new Error(j.error || (langOf(launch.initData) === "ru" ? "Не удалось войти" : "Kirib bo'lmadi"));
        // 2FA yoqilgan hisob: kirish sahifasidagi kod bosqichiga (chipta URL fragmentida, iframe rejimi chiptada saqlangan)
        if (j.data?.status === "2fa" && j.data.ticket) {
          markTgAppCookie();
          window.location.replace(`/auth/kirish?next=${encodeURIComponent(j.data.next || dest)}#t2=${j.data.ticket}`);
          return;
        }
        if (j.data?.status === "register") {
          setTgName(j.data.name ?? "");
          setPhase("ask");
          return;
        }
        markTgAppCookie();
        window.location.replace(j.data?.next || "/");
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : langOf(launch.initData) === "ru" ? "Не удалось войти" : "Kirib bo'lmadi");
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [to, link]);

  const wide = phase === "register";
  return (
    <div className={wide ? "w-full max-w-md" : "flex w-full max-w-sm flex-col items-center text-center"}>
      {!wide && (
        <>
          <LogoMark size={72} />
          <Wordmark className="mt-4 text-[26px]" />
        </>
      )}
      {phase === "auth" ? (
        <>
          <span aria-hidden className="mt-8 h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-fg" />
          <p className="mt-4 text-[14px] text-fg-3">{link ? t("Telegram hisobga ulanmoqda…", "Привязываем Telegram к аккаунту…") : t("Hisobingizga kirilmoqda…", "Входим в ваш аккаунт…")}</p>
        </>
      ) : phase === "ask" ? (
        <>
          <p className="mt-7 text-[16px] font-semibold text-fg">{tgName ? t(`Salom, ${tgName}!`, `Привет, ${tgName}!`) : t("Salom!", "Привет!")}</p>
          <p className="mt-2 text-[15px] leading-relaxed text-fg-2">{t("Kasb Egalari'da akkauntingiz bormi?", "У вас есть аккаунт в Kasb Egalari?")}</p>
          <button type="button" onClick={() => setPhase("register")} className="btn-accent mt-6 inline-flex h-12 w-full items-center justify-center rounded-full text-[15px] font-semibold">
            {t("Yo'q, ro'yxatdan o'taman", "Нет, зарегистрируюсь")}
          </button>
          <button type="button" onClick={() => setPhase("login")} className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full border border-line-2 text-[15px] font-semibold text-fg">
            {t("Ha, akkauntim bor", "Да, у меня есть аккаунт")}
          </button>
        </>
      ) : phase === "login" ? (
        <>
          <p className="mt-7 text-[16px] font-semibold text-fg">{t("Akkauntni ulash", "Привязать аккаунт")}</p>
          <p className="mt-2 text-[14.5px] leading-relaxed text-fg-2">{t("Saytdagi hisobingiz bilan kiring — Telegram shu hisobga avtomatik ulanadi.", "Войдите под аккаунтом сайта — Telegram привяжется к нему автоматически.")}</p>
          {googleEnabled && !framed && (
            <a href={googleHref} className="btn-ink mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold">
              <GoogleG /> {t("Google bilan kirish", "Войти через Google")}
            </a>
          )}
          <a href={loginHref} className={`${googleEnabled && !framed ? "mt-3 border border-line-2 text-fg" : "btn-accent mt-6"} inline-flex h-12 w-full items-center justify-center rounded-full text-[15px] font-semibold`}>
            {t("Email va parol bilan kirish", "Войти по email и паролю")}
          </a>
          <button type="button" onClick={() => setPhase("ask")} className="mt-4 text-[13px] font-semibold text-fg-3 underline-offset-4 hover:underline">
            {t("Orqaga", "Назад")}
          </button>
        </>
      ) : phase === "register" ? (
        <LocaleProvider locale={lang}>
          <TgRegister tgName={tgName} initData={initData} to={target} onBack={() => setPhase("ask")} />
        </LocaleProvider>
      ) : phase === "outside" ? (
        <>
          <p className="mt-7 text-[15px] leading-relaxed text-fg-2">{t("Bu ilova Telegram ichida ochiladi. Botga kirib, «Ilova» tugmasini bosing.", "Это приложение открывается внутри Telegram. Откройте бота и нажмите кнопку «Приложение».")}</p>
          {botLink && (
            <a href={botLink} className="btn-ink mt-5 inline-flex h-11 items-center rounded-full px-6 text-[14px] font-semibold">
              {t("Botni ochish", "Открыть бота")}
            </a>
          )}
          <a href="/" className="mt-3 text-[13px] font-semibold text-fg-3 underline-offset-4 hover:underline">
            {t("Saytga o'tish", "Перейти на сайт")}
          </a>
        </>
      ) : (
        <>
          <p className="mt-7 text-[15px] leading-relaxed text-danger-text">{err}</p>
          <button type="button" onClick={() => window.location.reload()} className="btn-ink mt-5 inline-flex h-11 items-center rounded-full px-6 text-[14px] font-semibold">
            {t("Qayta urinish", "Попробовать снова")}
          </button>
        </>
      )}
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C40.9 35.4 44 30.2 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

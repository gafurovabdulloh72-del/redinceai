"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr, type Locale } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * Lenta uchun umumiy mayda qismlar (bosh sahifa, jamoa lentasi, profil): kirish talabi, «Yana» tugmasi,
 * skelet, nisbiy vaqt (hydration'siz, uz/ru), so'rov satri birlashtirgich. Ikki komponentda takrorlangan kod shu yerga yig'ildi.
 */

/** `base` so'rov satri bo'lsa `&`, bo'lmasa `?` bilan qo'shadi (kabinet/postlar: `/api/profil/postlar?user=` bugi) */
export function withQuery(base: string, params: Record<string, string | number | null | undefined>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  if (!q) return base;
  return `${base}${base.includes("?") ? "&" : "?"}${q}`;
}

/** Kirmagan foydalanuvchini kirish sahifasiga (qaytish manzili bilan) yo'naltiradi; kirgan bo'lsa true */
export function useRequireLogin(loggedIn: boolean): () => boolean {
  const router = useRouter();
  return useCallback(() => {
    if (loggedIn) return true;
    router.push(`/auth/kirish?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    return false;
  }, [loggedIn, router]);
}

/** Har daqiqada yangilanadigan «hozir» (nisbiy vaqtlar eskirib qolmasin); server va birinchi render'da 0 — hydration mos keladi */
export function useNow(stepMs = 60_000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), stepMs);
    return () => window.clearInterval(t);
  }, [stepMs]);
  return now;
}

/** Nisbiy vaqt matni (uz/ru ko'plik bilan). `now` 0 bo'lsa — Date.now() */
export function relativeTime(til: Locale, at: number, now = 0): string {
  const diff = Math.max(0, (now || Date.now()) - at);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return tr(til, FEED.justNow);
  if (m < 60) return FEED.minutesAgo[til](m);
  const h = Math.floor(m / 60);
  if (h < 24) return FEED.hoursAgo[til](h);
  const d = Math.floor(h / 24);
  if (d < 30) return FEED.daysAgo[til](d);
  const mo = Math.floor(d / 30);
  if (mo < 12) return FEED.monthsAgo[til](mo);
  return FEED.yearsAgo[til](Math.floor(mo / 12));
}

/** Kelajakdagi vaqtgacha («N daqiqadan keyin») */
export function untilTime(til: Locale, at: number, now = 0): string {
  const m = Math.max(1, Math.round((at - (now || Date.now())) / 60_000));
  if (m < 60) return FEED.inMinutes[til](m);
  const h = Math.round(m / 60);
  if (h < 48) return FEED.inHours[til](h);
  return FEED.inDays[til](Math.round(h / 24));
}

/**
 * Nisbiy vaqt elementi: `<time dateTime>` + aniq sana title'da; serverda ham, klientda ham bir xil matn chiqadi,
 * daqiqa chegarasidagi farq uchun suppressHydrationWarning, keyin har daqiqa yangilanadi.
 */
export function RelativeTime({ at, className }: { at: number; className?: string }) {
  const til = useLocale();
  const now = useNow();
  return (
    <time dateTime={new Date(at).toISOString()} title={formatDateTime(at)} className={className} suppressHydrationWarning>
      {relativeTime(til, at, now)}
    </time>
  );
}

/** «Yana» tugmasi + xato holati (role=alert — avtomatik silkinadi) + qayta urinish */
export function LoadMore({ onLoad, loading, error }: { onLoad: () => void; loading: boolean; error: string | null }) {
  const til = useLocale();
  return (
    <div className="flex flex-col items-center gap-2 py-1">
      {error && (
        <p role="alert" className="text-[12.5px] font-semibold text-danger-text">
          {error}
        </p>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={onLoad} disabled={loading} className="text-fg-2">
        {loading ? tr(til, FEED.loading) : error ? tr(til, FEED.retry) : tr(til, FEED.more)}
      </Button>
    </div>
  );
}

/** Post kartasi skeleti (yuklanish paytida 1–2 ta) */
export function PostSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("card animate-fade-in p-4 sm:p-5", className)} aria-hidden>
      <div className="flex items-center gap-2.5">
        <span className="skeleton h-9 w-9 !rounded-full" />
        <span className="grid flex-1 gap-1.5">
          <span className="skeleton h-3 w-32" />
          <span className="skeleton h-2.5 w-20" />
        </span>
      </div>
      <span className="skeleton mt-4 block h-3 w-full" />
      <span className="skeleton mt-2 block h-3 w-4/5" />
      <span className="skeleton mt-2 block h-3 w-2/5" />
    </div>
  );
}

/**
 * Sentinel: element ko'rinishga kirganda `onVisible` (cheksiz aylantirish). Reduced-motion'ga bog'liq emas;
 * `enabled=false` bo'lsa kuzatmaydi (kursor tugaganda).
 */
export function useInfiniteSentinel(onVisible: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cb = useRef(onVisible);
  cb.current = onVisible;
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) cb.current();
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);
  return ref;
}

/** Faqat ko'rinadigan tabda ishlaydigan interval (fon tabda so'rov ketmaydi; qaytganda darhol bir marta) */
export function useVisibleInterval(fn: () => void, ms: number, enabled = true) {
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    if (!enabled) return;
    let timer: number | null = null;
    const start = () => {
      if (timer === null) timer = window.setInterval(() => cb.current(), ms);
    };
    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        cb.current();
        start();
      } else stop();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ms, enabled]);
}

/** Matnli bo'sh holat — ikonka, sarlavha, qisqa izoh, ixtiyoriy amal (lenta/izohlar) */
export function FeedEmpty({ icon, title, text, action, className }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("card flex flex-col items-center px-5 py-9 text-center", className)}>
      {icon && <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-[14px] bg-fg/5 text-fg-3">{icon}</span>}
      <p className="text-[15px] font-semibold text-fg">{title}</p>
      {text && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-fg-3">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

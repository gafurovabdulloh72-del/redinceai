"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { haptic, prefersReducedMotion } from "@/components/motion/haptics";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr, type Tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";
import { cn } from "@/lib/utils";

export type ThemeMode = "auto" | "light" | "dark";
export type FontSize = "s" | "m" | "l";
interface Appearance {
  mode: ThemeMode;
  /** Haqiqiy qo'llanayotgan rejim (auto → tizimdan) */
  resolved: "light" | "dark";
  font: FontSize;
  reduceMotion: boolean;
}

const KEYS = { theme: "redince-theme", font: "redince-font", motion: "redince-motion" } as const;
const SERVER: Appearance = { mode: "auto", resolved: "light", font: "m", reduceMotion: false };

/* ---- Do'kon: <html> atributlari haqiqat manbai (init skripti birinchi render'dan oldin o'rnatadi) ---- */
function read(): Appearance {
  const d = document.documentElement.dataset;
  const mode = (d.themeMode as ThemeMode) || "auto";
  return {
    mode: mode === "light" || mode === "dark" ? mode : "auto",
    resolved: d.theme === "dark" ? "dark" : "light",
    font: d.font === "s" || d.font === "l" ? d.font : "m",
    reduceMotion: d.motion === "reduce",
  };
}
let cache: Appearance | null = null;
function snapshot(): Appearance {
  const next = read();
  if (cache && cache.mode === next.mode && cache.resolved === next.resolved && cache.font === next.font && cache.reduceMotion === next.reduceMotion) return cache;
  cache = next;
  return next;
}
function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-theme-mode", "data-font", "data-motion"] });
  return () => mo.disconnect();
}
function save(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}
function systemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Tanlangan rejim fonini brauzer manzil paneliga ham beradi (<meta name="theme-color">) */
function syncThemeColorMeta() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  if (!bg) return;
  let metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
  if (metas.length === 0) {
    const m = document.createElement("meta");
    m.name = "theme-color";
    document.head.appendChild(m);
    metas = [m];
  }
  for (const m of metas) {
    m.removeAttribute("media");
    m.setAttribute("content", bg);
  }
}

function applyTheme(mode: ThemeMode) {
  const d = document.documentElement;
  const resolved = mode === "auto" ? (systemDark() ? "dark" : "light") : mode;
  const run = () => {
    d.dataset.theme = resolved;
    d.dataset.themeMode = mode;
  };
  // Rejim almashuvi — View Transitions crossfade (qo'llab-quvvatlasa va harakat kamaytirilmagan bo'lsa)
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (d.dataset.theme !== resolved && typeof doc.startViewTransition === "function" && !prefersReducedMotion()) doc.startViewTransition(run);
  else run();
}

export function setThemeMode(mode: ThemeMode) {
  applyTheme(mode);
  save(KEYS.theme, mode === "auto" ? null : mode);
  haptic("light");
}
export function setFontSize(font: FontSize) {
  const d = document.documentElement;
  if (font === "m") delete d.dataset.font;
  else d.dataset.font = font;
  save(KEYS.font, font === "m" ? null : font);
}
export function setReduceMotion(on: boolean) {
  const d = document.documentElement;
  if (on) d.dataset.motion = "reduce";
  else delete d.dataset.motion;
  save(KEYS.motion, on ? "reduce" : null);
}

export function useAppearance(): Appearance {
  return useSyncExternalStore(subscribe, snapshot, () => SERVER);
}

/**
 * Root layout'da bir marta: avto rejimda OS temasi o'zgarsa darhol almashtiradi, theme-color meta'ni sinxronlaydi.
 * Server DOM'iga tegmaydi.
 */
export function AppearanceSync() {
  const a = useAppearance();
  useEffect(() => {
    syncThemeColorMeta();
  }, [a.resolved]);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => {
      if (read().mode === "auto") applyTheme("auto");
    };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return null;
}

/* ---- Panel: tema / shrift / harakat (Sidebar «Yana» menyusi va mobil «Ko'rinish» varag'i) ---- */
export function AppearancePanel({ className }: { className?: string }) {
  const til = useLocale();
  const a = useAppearance();
  const themes: Array<{ v: ThemeMode; label: Tr; icon: LucideIcon }> = [
    { v: "auto", label: SHELL.appearance.themeAuto, icon: Monitor },
    { v: "light", label: SHELL.appearance.themeLight, icon: Sun },
    { v: "dark", label: SHELL.appearance.themeDark, icon: Moon },
  ];
  const fonts: Array<{ v: FontSize; label: Tr; cls: string }> = [
    { v: "s", label: SHELL.appearance.fontS, cls: "text-[12px]" },
    { v: "m", label: SHELL.appearance.fontM, cls: "text-[14px]" },
    { v: "l", label: SHELL.appearance.fontL, cls: "text-[17px]" },
  ];
  return (
    <div className={cn("grid gap-3", className)}>
      <Row label={tr(til, SHELL.appearance.theme)}>
        <div className="segment w-full" role="radiogroup" aria-label={tr(til, SHELL.appearance.theme)}>
          {themes.map((t) => (
            <button key={t.v} type="button" role="radio" aria-checked={a.mode === t.v} data-active={a.mode === t.v} onClick={() => setThemeMode(t.v)} className="segment-item flex flex-1 items-center justify-center gap-1.5 !px-2">
              <t.icon size={16} aria-hidden />
              <span className="truncate">{tr(til, t.label)}</span>
            </button>
          ))}
        </div>
      </Row>
      <Row label={tr(til, SHELL.appearance.fontSize)}>
        <div className="segment w-full" role="radiogroup" aria-label={tr(til, SHELL.appearance.fontSize)}>
          {fonts.map((f) => (
            <button key={f.v} type="button" role="radio" aria-checked={a.font === f.v} aria-label={tr(til, f.label)} data-active={a.font === f.v} onClick={() => setFontSize(f.v)} className={cn("segment-item flex-1 !px-2 font-display", f.cls)}>
              A
            </button>
          ))}
        </div>
      </Row>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-fg">{tr(til, SHELL.appearance.reduceMotion)}</span>
          <span className="block text-[11.5px] leading-snug text-fg-3">{tr(til, SHELL.appearance.reduceMotionHint)}</span>
        </span>
        <button type="button" role="switch" aria-checked={a.reduceMotion} aria-label={tr(til, SHELL.appearance.reduceMotion)} onClick={() => setReduceMotion(!a.reduceMotion)} className="switch" />
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-3">{label}</span>
      {children}
    </div>
  );
}

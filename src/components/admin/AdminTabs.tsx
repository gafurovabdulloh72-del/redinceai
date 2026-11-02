"use client";

import { Children, useCallback, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * ADMIN REDIZAYN (2026-11-02, foydalanuvchi so'rovi «soddalashtirib, dizaynini boshqacha qil»):
 * 20 ta bo'lim bitta cheksiz sahifa + scrollspy o'rniga 5 ta TAB (Navbat · Moliya · Kontent ·
 * Odamlar · Tizim). Bo'limlar server'da avvalgidek chiziladi — bu faqat ko'rsatish qatlami:
 * faol bo'lmagan guruhlar `hidden` (DOM'da qoladi, ichki `#anchor` havolalar ishlayveradi —
 * hash o'zgarsa tegishli tab avtomatik ochilib, bo'limga scroll qilinadi).
 */

export interface AdminTabDef {
  key: string;
  label: string;
  /** Navbat soni — tab yorlig'ida badge */
  count?: number;
  /** Shu tab ichidagi bo'lim id'lari (hash orqali ochish uchun) */
  ids: string[];
}

export function AdminTabs({ tabs, children }: { tabs: AdminTabDef[]; children: ReactNode }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const kids = Children.toArray(children);

  const openHash = useCallback(
    (hash: string) => {
      const id = hash.replace(/^#/, "");
      if (!id) return;
      const t = tabs.find((x) => x.ids.includes(id));
      if (!t) return;
      setActive(t.key);
      // Tab ochilgach element ko'rinadi — keyin scroll
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    },
    [tabs],
  );

  useEffect(() => {
    openHash(window.location.hash);
    const on = () => openHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, [openHash]);

  return (
    <>
      {/* Yopishqoq tab qatori — scroll'da ham qo'l ostida */}
      <div className="sticky top-0 z-40 -mx-4 mt-6 border-b border-line bg-bg/92 px-4 backdrop-blur-md sm:mx-0 sm:px-0">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto py-2" role="tablist" aria-label="Admin bo'limlari">
          {tabs.map((t) => {
            const on = t.key === active;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setActive(t.key);
                  if (window.location.hash) history.replaceState(null, "", window.location.pathname);
                  window.scrollTo({ top: 0 });
                }}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-colors",
                  on ? "bg-fg text-bg" : "text-fg-3 hover:bg-fg/6 hover:text-fg",
                )}
              >
                {t.label}
                {(t.count ?? 0) > 0 && (
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums", on ? "bg-bg/20 text-bg" : "bg-accent-soft text-accent-text")}>{t.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {tabs.map((t, i) => (
        <div key={t.key} role="tabpanel" hidden={t.key !== active}>
          {kids[i]}
        </div>
      ))}
    </>
  );
}

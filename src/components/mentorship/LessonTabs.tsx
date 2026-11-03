"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { MS } from "@/lib/i18n/dict/mentorship";

export interface LessonTab {
  key: string;
  label: string;
  /** Yorliq yonidagi son (masalan, materiallar soni) */
  count?: number;
  /** Diqqat talab qiladi (test topshirilmagan) */
  dot?: boolean;
  /**
   * «Yangi javob» nuqtasi (kamchilik #25): server oxirgi javob vaqtini beradi, mijoz localStorage'dagi
   * «oxirgi ko'rgan» vaqt bilan solishtiradi; tab ochilganda belgilanadi va nuqta o'chadi.
   */
  fresh?: { storageKey: string; ts: number | null };
  content: ReactNode;
}

/**
 * Dars sahifasidagi tablar: Dars · Materiallar · Test · Vazifa · Savol-javob.
 * Oldin hammasi bitta uzun ustunda edi (1700px+ scroll) — endi bir ekranda.
 * Faqat mavjud bo'lgan tablar uzatiladi; bitta tab qolsa qator chizilmaydi.
 */
export function LessonTabs({ tabs }: { tabs: LessonTab[] }) {
  const til = useLocale();
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  // fresh nuqtalari: SSR'da localStorage yo'q — effect'da hisoblanadi (hydration mos keladi)
  const [freshKeys, setFreshKeys] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const out: Record<string, boolean> = {};
    for (const t of tabs) {
      if (!t.fresh?.ts) continue;
      try {
        const seen = Number(localStorage.getItem(t.fresh.storageKey) ?? 0);
        if (t.fresh.ts > seen) out[t.key] = true;
      } catch {
        /* localStorage yopiq — nuqtasiz */
      }
    }
    setFreshKeys(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const markSeen = (t: LessonTab) => {
    if (!t.fresh) return;
    try {
      localStorage.setItem(t.fresh.storageKey, String(Date.now()));
    } catch {
      /* jim */
    }
    setFreshKeys((m) => ({ ...m, [t.key]: false }));
  };
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  if (!tabs.length) return null;
  if (tabs.length === 1) return <div className="mt-4">{tabs[0].content}</div>;

  return (
    <div className="mt-4">
      <div className="no-scrollbar -mx-4 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1" role="tablist" aria-label={tr(til, MS.lessonTabs)}>
          {tabs.map((t) => {
            const on = t.key === current?.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setActive(t.key);
                  markSeen(t);
                }}
                className={cn(
                  "relative inline-flex h-10 items-center gap-1.5 px-3 text-[13.5px] font-semibold transition",
                  on ? "text-fg after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:bg-fg" : "text-fg-3 hover:text-fg",
                )}
              >
                {t.label}
                {t.count ? <span className="text-[12px] font-normal text-fg-4">{t.count}</span> : null}
                {(t.dot || freshKeys[t.key]) && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-label={freshKeys[t.key] ? tr(til, MS.newReply) : tr(til, MS.attention)} />}
              </button>
            );
          })}
        </div>
      </div>
      <div role="tabpanel" className="pt-4">
        {current?.content}
      </div>
    </div>
  );
}

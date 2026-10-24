"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface LessonTab {
  key: string;
  label: string;
  /** Yorliq yonidagi son (masalan, materiallar soni) */
  count?: number;
  /** Diqqat talab qiladi (test topshirilmagan) */
  dot?: boolean;
  content: ReactNode;
}

/**
 * Dars sahifasidagi tablar: Dars · Materiallar · Test · Vazifa · Savol-javob.
 * Oldin hammasi bitta uzun ustunda edi (1700px+ scroll) — endi bir ekranda.
 * Faqat mavjud bo'lgan tablar uzatiladi; bitta tab qolsa qator chizilmaydi.
 */
export function LessonTabs({ tabs }: { tabs: LessonTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  if (!tabs.length) return null;
  if (tabs.length === 1) return <div className="mt-4">{tabs[0].content}</div>;

  return (
    <div className="mt-4">
      <div className="no-scrollbar -mx-4 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1" role="tablist" aria-label="Dars bo'limlari">
          {tabs.map((t) => {
            const on = t.key === current?.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActive(t.key)}
                className={cn(
                  "relative inline-flex h-10 items-center gap-1.5 px-3 text-[13.5px] font-semibold transition",
                  on ? "text-fg after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:bg-fg" : "text-fg-3 hover:text-fg",
                )}
              >
                {t.label}
                {t.count ? <span className="text-[12px] font-normal text-fg-4">{t.count}</span> : null}
                {t.dot && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-label="diqqat" />}
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

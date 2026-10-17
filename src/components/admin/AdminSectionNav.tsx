"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Admin: o'ng tomonda DOIMIY (sticky) bo'limlar navigatsiyasi — uzun sahifada scroll o'rniga bir bosishda o'tish.
 * Scrollspy: qaysi bo'lim ekranda bo'lsa, o'shanisi yoritiladi. Faqat keng ekranda (xl) ko'rinadi —
 * torda tepadagi chiplar ishlayveradi.
 */
export interface AdminNavItem {
  id: string;
  label: string;
  badge?: number;
}

export function AdminSectionNav({ items }: { items: AdminNavItem[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => Boolean(el));
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        // Ekranning yuqori qismiga eng yaqin ko'rinayotgan bo'lim faol
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  return (
    <nav aria-label="Admin bo'limlari" className="sticky top-24 hidden max-h-[calc(100vh-120px)] overflow-y-auto xl:block">
      <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-4">Bo'limlar</p>
      <ul className="space-y-0.5 border-l border-line pl-0">
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              className={cn(
                "-ml-px flex min-h-9 items-center justify-between gap-2 border-l-2 px-3 py-1.5 text-[13px] font-medium transition",
                active === i.id ? "border-accent font-semibold text-fg" : "border-transparent text-fg-3 hover:border-line-2 hover:text-fg",
              )}
            >
              <span className="truncate">{i.label}</span>
              {i.badge ? <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-accent-text">{i.badge}</span> : null}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

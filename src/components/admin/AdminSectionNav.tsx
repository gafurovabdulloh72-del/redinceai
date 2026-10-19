"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Activity, BadgeCheck, BarChart3, Banknote, CreditCard, Flag, Gavel, HardDrive, Landmark, Megaphone, RadioTower, Scale, Send, Server, Settings, ShieldAlert, Star, TrendingUp, Users, Circle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Bo'lim id'si → ikonka (skanlashni osonlashtiradi) */
const SECTION_ICONS: Record<string, LucideIcon> = {
  tasdiqlash: BadgeCheck,
  nizolar: Scale,
  payoutlar: Banknote,
  shikoyatlar: Flag,
  moderatsiya: Gavel,
  tolovlar: CreditCard,
  moliya: TrendingUp,
  analitika: BarChart3,
  shubhali: ShieldAlert,
  sharhlar: Star,
  efirlar: RadioTower,
  foydalanuvchilar: Users,
  xabar: Megaphone,
  "telegram-bot": Send,
  "r2-saqlash": HardDrive,
  faollik: Activity,
  tizim: Server,
  "tolov-sozlamalari": Landmark,
  sozlamalar: Settings,
};

/**
 * Admin: o'ng tomonda DOIMIY (sticky) bo'limlar navigatsiyasi — uzun sahifada scroll o'rniga bir bosishda o'tish.
 * Scrollspy pozitsiya bo'yicha: ekranning yuqori 30% chizig'idan o'tgan OXIRGI bo'lim faol — qisqa bo'limlar
 * (sahifa oxiridagi sozlamalar ham) IntersectionObserver band'iga sig'masa ham to'g'ri yoritiladi.
 * Faol belgisi (2px chiziq) bandlar orasida silliq siljiydi. Faqat keng ekranda (xl) ko'rinadi.
 */
export interface AdminNavItem {
  id: string;
  label: string;
  badge?: number;
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function AdminSectionNav({ items }: { items: AdminNavItem[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [mark, setMark] = useState<{ top: number; height: number } | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const ids = items.map((i) => i.id);
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = window.innerHeight * 0.3;
      let current: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) current = id;
        else break;
      }
      // Sahifa oxiri — oxirgi bo'lim (qisqa bo'lim chiziqqa yetmasa ham)
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = ids[ids.length - 1] ?? current;
      setActive(current ?? ids[0] ?? null);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items]);

  // Faol belgi koordinatasi — faol band o'zgarganda qayta o'lchanadi
  useIsoLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !active) return;
    const a = list.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (!a) return;
    setMark({ top: a.offsetTop, height: a.offsetHeight });
    // Faol band ro'yxat ichida ko'rinib tursin (ro'yxatning o'zi aylanadi)
    const nav = list.parentElement;
    if (nav && (a.offsetTop < nav.scrollTop || a.offsetTop + a.offsetHeight > nav.scrollTop + nav.clientHeight)) nav.scrollTo({ top: Math.max(0, a.offsetTop - 40), behavior: "smooth" });
  }, [active]);

  return (
    <nav aria-label="Admin bo'limlari" className="sticky top-8 hidden max-h-[calc(100vh-64px)] overflow-y-auto xl:block">
      <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-4">Bo&apos;limlar</p>
      <ul ref={listRef} className="relative space-y-0.5 border-l border-line pl-0">
        {mark && <span aria-hidden="true" className="absolute -left-px w-0.5 rounded-full bg-accent transition-[top,height] duration-300 ease-out motion-reduce:transition-none" style={{ top: mark.top, height: mark.height }} />}
        {items.map((i) => {
          const Icon = SECTION_ICONS[i.id] ?? Circle;
          const on = active === i.id;
          return (
            <li key={i.id}>
              <a
                href={`#${i.id}`}
                data-id={i.id}
                aria-current={on ? "location" : undefined}
                onClick={() => setActive(i.id)}
                className={cn(
                  "mx-1 flex min-h-9 items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                  on ? "bg-fg/6 font-semibold text-fg" : "text-fg-3 hover:bg-fg/4 hover:text-fg",
                )}
              >
                <Icon size={15} className={cn("shrink-0", on ? "text-accent" : "text-fg-4")} />
                <span className="flex-1 truncate">{i.label}</span>
                {i.badge ? <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-accent-text">{i.badge}</span> : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

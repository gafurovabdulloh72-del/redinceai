"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Briefcase, Clock3, Send, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { useIsPhone } from "@/components/motion/useMediaQuery";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = { user: UserRound, send: Send, briefcase: Briefcase, shield: ShieldCheck, clock: Clock3 };

export interface ProfilePanel {
  key: string;
  label: string;
  icon: keyof typeof ICONS;
  node: ReactNode;
}

/**
 * Profil sahifasi bo'limlari. Telefonda — haqiqiy tablar (faqat tanlangan bo'lim chiziladi, sahifa 4 marta qisqaradi),
 * sm+ da — avvalgidek chiplar + barcha bo'limlar ustma-ust. Tanlov `?tab=` va `#hash` dan o'qiladi (tashqi havolalar ishlaydi).
 */
export function ProfilePanels({ panels }: { panels: ProfilePanel[] }) {
  const phone = useIsPhone();
  const router = useRouter();
  const sp = useSearchParams();
  const fromQuery = sp.get("tab");
  const [active, setActive] = useState<string>(() => (fromQuery && panels.some((p) => p.key === fromQuery) ? fromQuery : panels[0]?.key));
  useEffect(() => {
    // #mutaxassis kabi eski havolalar
    const h = window.location.hash.replace("#", "");
    if (h && panels.some((p) => p.key === h)) setActive(h);
  }, [panels]);
  useEffect(() => {
    if (fromQuery && panels.some((p) => p.key === fromQuery)) setActive(fromQuery);
  }, [fromQuery, panels]);

  const pick = (key: string) => {
    setActive(key);
    const q = new URLSearchParams(sp.toString());
    q.set("tab", key);
    router.replace(`${window.location.pathname}?${q.toString()}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <>
      <nav aria-label="Bo'limlar" className="no-scrollbar -mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1.5" role={phone ? "tablist" : undefined}>
          {panels.map((p) => {
            const Icon = ICONS[p.icon];
            const on = phone && active === p.key;
            return (
              <li key={p.key}>
                {phone ? (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => pick(p.key)}
                    className={cn("press inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition", on ? "border-fg bg-fg text-bg" : "border-line bg-surface text-fg-2")}
                  >
                    <Icon size={14} className={on ? "text-bg/80" : "text-fg-3"} /> {p.label}
                  </button>
                ) : (
                  <a href={`#${p.key}`} className="press inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
                    <Icon size={14} className="text-fg-3" /> {p.label}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="stagger space-y-5 [&>*]:animate-fade-up">
        {panels.map((p) => (
          <div key={p.key} id={`${p.key}-panel`} role={phone ? "tabpanel" : undefined} className={cn(phone && active !== p.key && "hidden")}>
            {p.node}
          </div>
        ))}
      </div>
    </>
  );
}

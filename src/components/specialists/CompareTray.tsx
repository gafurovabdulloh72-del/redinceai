"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { GitCompareArrows, X } from "lucide-react";
import { Avatar } from "@/components/ui";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { usePresence } from "@/components/motion/usePresence";
import { tr } from "@/lib/i18n";
import { KATALOG_X, TAQQOS } from "@/lib/i18n/dict/catalog";
import { cn } from "@/lib/utils";
import { COMPARE_MAX, clearCompare, compareHref, getCompareServerSnapshot, getCompareSnapshot, removeCompare, subscribeCompare } from "./compare-store";

/**
 * Pastdagi suzuvchi panel (F54): "Taqqoslash (2)" — tanlanganlar bo'lsa ko'rinadi (kirish/chiqish animatsiyasi bilan).
 * Har bir avatar — bosilsa shu ijodkor ro'yxatdan chiqadi (alohida olib tashlash). Telefonda pastki tab-bar ustida.
 */
export function CompareTray({ className, aboveCta = false }: { className?: string; /** Profil sahifasi: telefonda pastki CTA paneli ustida */ aboveCta?: boolean }) {
  const til = useLocale();
  const snap = useSyncExternalStore(subscribeCompare, getCompareSnapshot, getCompareServerSnapshot);
  const pathname = usePathname();
  const [notice, setNotice] = useState<string | null>(null);
  const items = snap.items;
  const visible = items.length > 0 && pathname !== "/taqqoslash";
  const pres = usePresence(visible, 200);

  useEffect(() => {
    if (!snap.notice) return;
    setNotice(TAQQOS.maxNotice[til](COMPARE_MAX));
    const t = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(t);
  }, [snap.notice, til]);

  if (!pres.mounted) return null;
  const enough = items.length >= 2;

  return (
    <div
      className={cn(
        "pointer-events-none fixed left-3 right-[4.25rem] z-40 flex flex-col items-center gap-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2",
        pres.closing ? "animate-fade-out" : "animate-slide-up",
        aboveCta ? "bottom-[calc(9.75rem+env(safe-area-inset-bottom))] md:bottom-24 lg:bottom-6" : "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6",
        className,
      )}
    >
      {notice && (
        <p role="status" className="card-elevated pop-in pointer-events-auto max-w-full !rounded-full px-4 py-2 text-center text-[12.5px] font-semibold text-fg">
          {notice}
        </p>
      )}
      <div className="card-elevated pointer-events-auto flex w-full max-w-md items-center gap-2 !rounded-full py-1.5 pl-2 pr-1.5 sm:w-auto" role="region" aria-label={tr(til, TAQQOS.trayAria)}>
        <ul className="flex shrink-0 -space-x-2 pl-1" aria-label={tr(til, TAQQOS.trayAria)}>
          {items.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => removeCompare(i.id)}
                aria-label={KATALOG_X.compareRemoveOne[til](i.name)}
                title={KATALOG_X.compareRemoveOne[til](i.name)}
                className="group/av press relative block rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Avatar name={i.name} src={i.avatarUrl} size={30} decorative singleInitial />
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ink/70 text-white opacity-0 transition-opacity group-hover/av:opacity-100 group-focus-visible/av:opacity-100" aria-hidden>
                  <X size={12} />
                </span>
              </button>
            </li>
          ))}
        </ul>
        <span className="hidden min-w-0 flex-1 truncate px-1 text-[12px] text-fg-3 sm:block sm:max-w-[200px]">
          {enough ? items.map((i) => i.name.split(" ")[0]).join(", ") : TAQQOS.pickMore[til](COMPARE_MAX - items.length)}
        </span>
        <Link href={compareHref(items)} className={cn("press ml-auto inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition sm:ml-0", enough ? "btn-accent" : "btn-ink")}>
          <GitCompareArrows size={15} aria-hidden="true" /> {TAQQOS.compareCount[til](items.length)}
        </Link>
        <button type="button" onClick={clearCompare} aria-label={tr(til, TAQQOS.clearAria)} title={tr(til, TAQQOS.clearTitle)} className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

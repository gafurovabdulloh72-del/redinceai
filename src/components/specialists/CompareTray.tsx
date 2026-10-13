"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { GitCompareArrows, X } from "lucide-react";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";
import { COMPARE_MAX, clearCompare, compareHref, getCompareServerSnapshot, getCompareSnapshot, subscribeCompare } from "./compare-store";

/**
 * Pastdagi suzuvchi panel (F54): "Taqqoslash (2)" — tanlanganlar bo'lsa ko'rinadi.
 * Telefonda pastki tab-bar ustida (profil sahifasida — `aboveCta` bilan CTA paneli ustida).
 */
export function CompareTray({ className, aboveCta = false }: { className?: string; /** Profil sahifasi: telefonda pastki CTA paneli ustida */ aboveCta?: boolean }) {
  const snap = useSyncExternalStore(subscribeCompare, getCompareSnapshot, getCompareServerSnapshot);
  const pathname = usePathname();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!snap.notice) return;
    setNotice(snap.notice.text);
    const t = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(t);
  }, [snap.notice]);

  const items = snap.items;
  if (items.length === 0 || pathname === "/taqqoslash") return null;
  const enough = items.length >= 2;

  return (
    <div
      className={cn(
        // Telefonda o'ngda "Yuqoriga" tugmasi (BackToTop, right-4) uchun joy qoldiriladi
        "pointer-events-none fixed left-3 right-[4.25rem] z-40 flex flex-col items-center gap-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2",
        aboveCta ? "bottom-[calc(9.75rem+env(safe-area-inset-bottom))] md:bottom-24 lg:bottom-6" : "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6",
        className,
      )}
    >
      {notice && (
        <p role="status" className="card-elevated pointer-events-auto max-w-full !rounded-full px-4 py-2 text-center text-[12.5px] font-semibold text-fg animate-fade-up" style={{ animationDuration: "0.25s" }}>
          {notice}
        </p>
      )}
      <div className="card-elevated pointer-events-auto flex w-full max-w-md items-center gap-2 !rounded-full py-1.5 pl-2 pr-1.5 sm:w-auto" role="region" aria-label="Taqqoslash ro'yxati">
        <span className="flex shrink-0 -space-x-2 pl-1" aria-hidden="true">
          {items.map((i) => (
            <Avatar key={i.id} name={i.name} src={i.avatarUrl} size={30} decorative singleInitial />
          ))}
        </span>
        <span className="hidden min-w-0 flex-1 truncate px-1 text-[12px] text-fg-3 sm:block sm:max-w-[200px]">
          {enough ? items.map((i) => i.name.split(" ")[0]).join(", ") : `Yana ${COMPARE_MAX - items.length} tagacha tanlang`}
        </span>
        <Link
          href={compareHref(items)}
          className={cn("ml-auto inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition active:scale-[0.97] sm:ml-0", enough ? "btn-accent" : "btn-ink")}
        >
          <GitCompareArrows size={15} aria-hidden="true" /> Taqqoslash ({items.length})
        </Link>
        <button
          type="button"
          onClick={clearCompare}
          aria-label="Taqqoslash ro'yxatini tozalash"
          title="Tozalash"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

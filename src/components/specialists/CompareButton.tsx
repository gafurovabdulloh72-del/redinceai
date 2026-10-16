"use client";

import { useSyncExternalStore, type MouseEvent } from "react";
import { Check, GitCompareArrows } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { TAQQOS } from "@/lib/i18n/dict/catalog";
import { cn } from "@/lib/utils";
import { getCompareServerSnapshot, getCompareSnapshot, subscribeCompare, toggleCompare, type CompareItem } from "./compare-store";

type Variant = "overlay" | "ghost" | "outline" | "chip";

/**
 * "Taqqoslash" tugmasi (F54): ro'yxatga qo'shadi/olib tashlaydi (3 tagacha, localStorage).
 *  overlay — karta muqovasi ustida (oq disk), ghost — qator ichida, outline — profil CTA yonida (kvadrat), chip — matnli.
 * 44px bosish maydoni; aria-pressed holatni bildiradi.
 */
export function CompareButton({ item, variant = "outline", className }: { item: CompareItem; variant?: Variant; className?: string }) {
  const til = useLocale();
  const snap = useSyncExternalStore(subscribeCompare, getCompareSnapshot, getCompareServerSnapshot);
  const on = snap.items.some((i) => i.id === item.id);
  const label = on ? tr(til, TAQQOS.remove) : tr(til, TAQQOS.add);

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    // Karta havolasi ustida — navigatsiyaga aylanmasin
    e.preventDefault();
    e.stopPropagation();
    toggleCompare(item);
  };

  const Icon = on ? Check : GitCompareArrows;

  if (variant === "overlay") {
    return (
      <button type="button" onClick={onClick} aria-pressed={on} aria-label={label} title={label} className={cn("group/cmp inline-flex h-11 w-11 items-center justify-center rounded-full", className)}>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full shadow-[var(--shadow-1)] transition group-active/cmp:scale-95",
            on ? "btn-ink" : "bg-surface text-fg-2 group-hover/cmp:text-fg",
          )}
        >
          <Icon size={15} aria-hidden="true" />
        </span>
      </button>
    );
  }

  if (variant === "chip") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={on}
        className={cn(
          "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition active:scale-[0.97]",
          on ? "btn-ink" : "border border-line-2 bg-surface text-fg hover:border-fg hover:bg-fg/4",
          className,
        )}
      >
        <Icon size={14} aria-hidden="true" />
        {on ? tr(til, TAQQOS.inCompare) : tr(til, TAQQOS.compare)}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition",
        variant === "outline"
          ? cn("h-13 w-13 border active:scale-[0.97]", on ? "btn-ink border-transparent" : "border-line-2 bg-surface text-fg hover:border-fg hover:bg-fg/4")
          : cn("h-11 w-11 hover:bg-fg/6 active:scale-95", on ? "text-fg" : "text-fg-3 hover:text-fg"),
        className,
      )}
    >
      <Icon size={variant === "outline" ? 18 : 16} aria-hidden="true" />
    </button>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type MouseEvent } from "react";
import { Heart } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { SEVIMLI } from "@/lib/i18n/dict/catalog";
import { cn } from "@/lib/utils";
import { ensureFavoritesLoaded, getFavoritesServerSnapshot, getFavoritesSnapshot, subscribeFavorites, toggleFavorite } from "./favorites-store";
import { useFavoritesSeed } from "./FavoritesSeed";

type Variant = "overlay" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

/* sm — vizual 36px (yonidagi sm tugmalar bilan bir xil), bosish maydoni ::before orqali 44px */
const SIZE: Record<Size, string> = { sm: "relative h-9 w-9 before:absolute before:-inset-1 before:rounded-full", md: "h-11 w-11", lg: "h-13 w-13" };
const ICON: Record<Size, number> = { sm: 15, md: 17, lg: 18 };

function loginHref() {
  const next = typeof window === "undefined" ? "/" : window.location.pathname + window.location.search;
  return `/auth/kirish?next=${encodeURIComponent(next)}`;
}

/**
 * Sevimlilar tugmasi (yurak): kontur → to'ldirilgan. 44px bosish maydoni, aria-pressed, optimistik.
 * Mehmon bossa — kirish sahifasiga (?next= joriy sahifa).
 *  overlay — karta muqovasi ustida (oq disk), outline — CTA yonida, ghost — qator ichida.
 */
export function FavoriteButton({ specialistId, variant = "outline", size = "md", className }: { specialistId: string; variant?: Variant; size?: Size; className?: string }) {
  const til = useLocale();
  const snap = useSyncExternalStore(subscribeFavorites, getFavoritesSnapshot, getFavoritesServerSnapshot);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // Server ID'larni bergan sahifada (FavoritesSeed) — do'kon tayyor bo'lguncha shu ro'yxat, GET yuborilmaydi
  const seed = useFavoritesSeed();

  useEffect(() => {
    if (!seed) ensureFavoritesLoaded();
  }, [seed]);

  const on = seed && (snap.status === "unknown" || snap.status === "loading") ? seed.has(specialistId) : snap.ids.has(specialistId);
  const label = on ? tr(til, SEVIMLI.remove) : tr(til, SEVIMLI.add);

  const onClick = async (e: MouseEvent<HTMLButtonElement>) => {
    // Karta havolasi yonida turadi — bosish navigatsiyaga aylanmasin
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      // Holat ishonchli bo'lsa optimistik; mehmon/noma'lum bo'lsa avval server javobini kutamiz (401 → kirish)
      const res = await toggleFavorite(specialistId, snap.status === "ready");
      if (res === "guest") router.push(loginHref());
    } finally {
      setBusy(false);
    }
  };

  const icon = <Heart size={ICON[size]} className={cn("transition-transform duration-200", on && "fill-current scale-110")} aria-hidden="true" />;

  if (variant === "overlay") {
    return (
      <button type="button" onClick={onClick} aria-pressed={on} aria-label={label} title={label} className={cn("group/fav inline-flex h-11 w-11 items-center justify-center rounded-full", className)}>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-1)] transition group-active/fav:scale-95", on ? "text-accent" : "text-fg-2 group-hover/fav:text-fg")}>{icon}</span>
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
        SIZE[size],
        variant === "outline" ? "border border-line-2 bg-surface hover:border-fg hover:bg-fg/4 active:scale-[0.97]" : "hover:bg-fg/6 active:scale-95",
        on ? "text-accent" : variant === "outline" ? "text-fg" : "text-fg-3 hover:text-fg",
        className,
      )}
    >
      {icon}
    </button>
  );
}

"use client";

import { Search } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { PALET } from "@/lib/i18n/dict/search";
import { cn } from "@/lib/utils";

/** Navbar'dagi qidiruv tugmasi — CommandPalette'ni ochadi (⌘K ham ishlaydi); yorliqlar tilga mos */
export function SearchButton({ className }: { className?: string }) {
  const til = useLocale();
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-search"))}
      aria-label={tr(til, PALET.buttonAria)}
      title={tr(til, PALET.buttonTitle)}
      className={cn("card card-hover press flex h-10 w-10 shrink-0 items-center justify-center !rounded-full text-fg-2 hover:text-fg", className)}
    >
      <Search size={17} />
    </button>
  );
}

"use client";

import { Search } from "lucide-react";
import { Kbd } from "@/components/ui";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";

/** O'ng rail tepasidagi qidiruv maydoni — bosilganda global ⌘K palitrasi ochiladi (X/Instagram web kabi doim ko'rinib turadi) */
export function RailSearch() {
  const til = useLocale();
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-search"))}
      className="press flex h-11 w-full items-center gap-2.5 rounded-full border border-transparent bg-surface-3 px-4 text-left text-[13.5px] text-fg-3 transition hover:border-line-2 hover:text-fg-2"
    >
      <Search size={16} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{tr(til, FEED.railSearch)}</span>
      <Kbd>⌘K</Kbd>
    </button>
  );
}

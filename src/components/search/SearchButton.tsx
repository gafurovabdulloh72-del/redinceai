"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** Navbar'dagi qidiruv tugmasi — CommandPalette'ni ochadi (⌘K ham ishlaydi) */
export function SearchButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-search"))}
      aria-label="Qidiruv (⌘K)"
      title="Qidiruv — ⌘K / Ctrl+K"
      className={cn("card card-hover flex h-10 w-10 shrink-0 items-center justify-center !rounded-full text-fg-2 hover:text-fg", className)}
    >
      <Search size={17} />
    </button>
  );
}

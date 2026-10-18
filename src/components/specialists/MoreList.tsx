"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Serverda chizilgan ro'yxatning davomini yashirib turadi («Yana N ta» tugmasi).
 * DOM barqaror (hidden atributi) — hydration'ga ta'sir yo'q; ochilganda `expand-in`.
 */
export function MoreList({ children, labelMore, labelLess, className }: { children: ReactNode; labelMore: string; labelLess: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <div hidden={!open} className={cn(open && "expand-in")}>
        {children}
      </div>
      <div className="flex justify-center pt-1">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="press inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
          {open ? labelLess : labelMore}
          <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </div>
    </div>
  );
}

"use client";

import { ArrowDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Tortib yangilash ko'rsatkichi: pastga strelka → bo'sag'ada aylanadi → yuklanishda spinner */
export function PullIndicator({ pull, refreshing, armed }: { pull: number; refreshing: boolean; armed: boolean }) {
  if (pull <= 0 && !refreshing) return null;
  const h = refreshing ? 56 : pull;
  return (
    <div aria-hidden className="flex items-end justify-center overflow-hidden transition-[height] duration-150 sm:hidden" style={{ height: h }}>
      <span className={cn("mb-2 grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-fg-2 transition-transform", armed && !refreshing && "rotate-180 text-fg")}>
        {refreshing ? <Loader2 size={17} className="animate-spin" /> : <ArrowDown size={17} />}
      </span>
    </div>
  );
}

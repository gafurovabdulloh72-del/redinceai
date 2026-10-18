"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Uzun tavsif: dastlab `lines` qatorgacha kesiladi, «ko'proq / kamroq» bilan ochiladi.
 * Qisqa matnda tugma chiqmaydi (uzunlik bo'yicha taxmin — DOM o'lchamisiz, hydration'ga xavfsiz).
 */
export function ExpandableText({ text, lines = 3, className, threshold = 220 }: { text: string; lines?: 2 | 3 | 4; className?: string; threshold?: number }) {
  const [open, setOpen] = useState(false);
  const long = text.length > threshold || text.split("\n").length > lines;
  const clamp = { 2: "line-clamp-2", 3: "line-clamp-3", 4: "line-clamp-4" }[lines];
  return (
    <div className={className}>
      <p className={cn("whitespace-pre-wrap text-[14.5px] leading-relaxed text-fg-2", !open && clamp)}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-1 text-[13px] font-semibold text-fg-2 underline-offset-2 hover:underline">
          {open ? "kamroq" : "ko'proq"}
        </button>
      )}
    </div>
  );
}

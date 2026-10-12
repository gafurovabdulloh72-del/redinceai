"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Ko'nikma chiplari (E97/F50): birinchi `max` tasi ko'rinadi, "+N" bosilsa — hammasi.
 * Har bir chip shu ko'nikma bo'yicha filtrlangan ro'yxatga olib boradi (?skill=).
 * Karta ichida ishlatiladi: chiplar "pointer-events-auto" — kartaning cho'zilgan havolasi ustida turadi.
 */
export function SkillChips({ skills, max = 3, className }: { skills: string[]; max?: number; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (skills.length === 0) return null;
  const shown = expanded ? skills : skills.slice(0, max);
  const rest = skills.length - max;

  return (
    <div className={cn("flex gap-1.5", expanded ? "flex-wrap" : "overflow-hidden", className)}>
      {shown.map((s) => (
        <Link
          key={s}
          href={`/mutaxassislar?skill=${encodeURIComponent(s)}`}
          prefetch={false}
          title={`"${s}" ko'nikmasi bor mutaxassislar`}
          className="pointer-events-auto relative z-10 inline-flex min-h-6 min-w-0 items-center truncate rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-fg-2 transition hover:border-fg hover:text-fg"
        >
          <span className="truncate">{s}</span>
        </Link>
      ))}
      {rest > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Ko'nikmalarni yig'ish" : `Yana ${rest} ta ko'nikmani ko'rsatish`}
          title={expanded ? undefined : skills.slice(max).join(", ")}
          className="pointer-events-auto relative z-10 inline-flex min-h-6 shrink-0 items-center rounded-full bg-fg/6 px-2 py-0.5 text-[11px] font-semibold text-fg-2 transition hover:bg-fg/10 hover:text-fg"
        >
          {expanded ? "Kamroq" : `+${rest}`}
        </button>
      )}
    </div>
  );
}

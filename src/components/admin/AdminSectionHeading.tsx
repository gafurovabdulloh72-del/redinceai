import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Admin bo'lim sarlavhasi — ommaviy SectionHeading'dan farqli ravishda IXCHAM:
 * sarlavha 20–22px, tavsif ostida 13px, holat chipi sarlavha bilan bir qatorda (o'ngda).
 * Assimetrik ustunlar va 100px bo'shliqlar yo'q — boshqaruv vositasi uchun tinch ko'rinish.
 */
export function AdminSectionHeading({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div data-reveal className={cn("mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-2", className)}>
      <div className="min-w-0 max-w-2xl">
        <h2 className="font-display text-[20px] font-semibold leading-tight tracking-[-0.01em] text-fg sm:text-[22px]">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-fg-3">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2 sm:pt-1">{action}</div>}
    </div>
  );
}

/** Navbat chipi: n > 0 — ogohlantirish («N ta kutmoqda»), aks holda tinch («Navbat bo'sh») */
export function QueueChip({ n, some, none }: { n: number; some: (n: number) => string; none: string }) {
  return (
    <Badge tone={n > 0 ? "warning" : "success"} className="!px-2.5 !py-1 tabular-nums">
      {n > 0 ? some(n) : none}
    </Badge>
  );
}

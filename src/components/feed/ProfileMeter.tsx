import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { tr, type Locale } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";
import { PROFIL_X } from "@/lib/i18n/dict/profile";
import type { Completeness } from "@/lib/profile/completeness";
import { cn } from "@/lib/utils";

/**
 * Profil to'ldirilganlik kartasi (LinkedIn naqshi): maqsad gradienti + Zeigarnik effekti — tugallanmagan ish tepada ko'rinib turadi.
 * Ma'lumot profil sahifasidagi «Profil to'liqligi» bilan bir xil (lib/profile/completeness). 100% bo'lsa umuman chiqmaydi.
 * `className` orqali telefonda lentada (lg:hidden), desktopda o'ng railda ishlatiladi.
 */
export function ProfileMeter({ data, til, className }: { data: Completeness; til: Locale; className?: string }) {
  const next = data.missing[0];
  if (!next) return null;
  return (
    <Link href={next.href} className={cn("card card-hover block p-4", className)} aria-label={`${tr(til, FEED.meterTitle)} — ${data.percent}%`}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-accent-soft text-accent-text">
          <Sparkles size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-fg">{tr(til, FEED.meterTitle)}</p>
          <p className="truncate text-[12px] text-fg-3">{tr(til, FEED.meterHint)}</p>
        </div>
        <span className="stat-num text-[20px] text-fg">{data.percent}%</span>
      </div>
      <div className="meter mt-3" role="progressbar" aria-valuenow={data.percent} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${data.percent}%` }} />
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-fg-2">
        <span className="shrink-0 font-semibold text-fg">{tr(til, FEED.meterNext)}:</span>
        <span className="min-w-0 flex-1 truncate">{tr(til, PROFIL_X.completenessItems[next.key])}</span>
        <ArrowRight size={14} className="shrink-0 text-accent-text" aria-hidden="true" />
      </p>
    </Link>
  );
}

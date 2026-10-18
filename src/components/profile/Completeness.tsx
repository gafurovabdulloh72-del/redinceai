import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { tr, type Locale } from "@/lib/i18n";
import { PROFIL_X } from "@/lib/i18n/dict/profile";
import type { Completeness as CompletenessData } from "@/lib/profile/completeness";

/** «Profil to'liqligi» kartasi — faqat egasiga: foiz chizig'i + eng muhim 4 ta yetishmayotgan qism (har biri kabinetga havola) */
export function Completeness({ data, til, className }: { data: CompletenessData; til: Locale; className?: string }) {
  const done = data.percent >= 100;
  return (
    <section className={className} aria-label={tr(til, PROFIL_X.completenessTitle)}>
      <div className="card-outline p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-fg">{tr(til, PROFIL_X.completenessTitle)}</p>
          <span className="font-display text-[15px] font-semibold tabular-nums text-fg">{data.percent}%</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={data.percent} aria-label={PROFIL_X.completenessAria[til](data.percent)}>
          <div className={done ? "h-full rounded-full bg-success transition-[width] duration-700" : "h-full rounded-full bg-accent transition-[width] duration-700"} style={{ width: `${data.percent}%` }} />
        </div>
        {done ? (
          <p className="mt-2.5 flex items-center gap-1.5 text-[12.5px] text-fg-2">
            <CheckCircle2 size={14} className="text-success" aria-hidden /> {tr(til, PROFIL_X.completenessDone)}
          </p>
        ) : (
          <>
            <p className="mt-2 text-[12px] leading-snug text-fg-3">{tr(til, PROFIL_X.completenessHint)}</p>
            <ul className="mt-2.5 space-y-1">
              {data.missing.map((m) => (
                <li key={m.key}>
                  <Link href={m.href} className="group flex min-h-8 items-center gap-2 text-[13px] text-fg-2 transition hover:text-fg">
                    <Circle size={13} className="shrink-0 text-fg-4" aria-hidden />
                    <span className="flex-1">{tr(til, PROFIL_X.completenessItems[m.key])}</span>
                    <ArrowRight size={13} className="shrink-0 text-fg-4 transition group-hover:translate-x-0.5 group-hover:text-fg" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

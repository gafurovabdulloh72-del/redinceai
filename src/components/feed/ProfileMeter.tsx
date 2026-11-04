import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import { ArrowRight, Check } from "lucide-react";
import { tr, type Locale } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";
import type { ProfileCompletion } from "@/lib/profile/completion";
import { cn } from "@/lib/utils";

/** Halqa progress (SVG) — bitta manba: ProfileMeter va kabinet kartasi */
export function CompletionRing({ pct, size = 48, stroke = 5, label }: { pct: number; size?: number; stroke?: number; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-2)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, Math.max(0, pct)) / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} className="transition-[stroke-dashoffset] duration-500" />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-fg font-semibold tabular-nums" style={{ fontSize: size * 0.28 }}>
        {pct}%
      </text>
    </svg>
  );
}

/**
 * Profil tayyorligi kartasi (Zeigarnik effekti: tugallanmagan ish ko'rinib turadi). Ma'lumot — `profileCompletion()`
 * (lib/profile/completion.ts, mutaxassis va mijoz uchun bir xil manba). 100% bo'lsa chizilmaydi.
 * `compact` — Kabinet → Profil tepasidagi bir qatorli ko'rinish (halqa + «N qadam qoldi» + keyingi qadam).
 */
export function ProfileMeter({ data, til, className, compact = false }: { data: ProfileCompletion; til: Locale; className?: string; compact?: boolean }) {
  const next = data.next;
  if (!next || data.pct >= 100) return null;
  const aria = `${FEED.meterReady[til](data.pct)} — ${FEED.meterLeft[til](data.left)}`;

  if (compact) {
    return (
      <div className={cn("card m-flat flex items-center gap-3 p-3", className)} role="status" aria-label={aria}>
        <CompletionRing pct={data.pct} size={44} stroke={4} label={aria} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-fg">{FEED.meterReady[til](data.pct)}</p>
          <p className="truncate text-[12px] text-fg-3">
            {FEED.meterLeft[til](data.left)} · {tr(til, FEED.meterNext)}: {tr(til, next.label)}
          </p>
        </div>
        <ButtonLink href={next.href} size="sm" variant="outline" className="shrink-0">
          {tr(til, FEED.meterOpen)} <ArrowRight size={14} aria-hidden="true" />
        </ButtonLink>
      </div>
    );
  }

  const shown = data.steps.filter((s) => !s.done).slice(0, 3);
  return (
    <div className={cn("card p-4", className)} role="status" aria-label={aria}>
      <div className="flex items-center gap-3">
        <CompletionRing pct={data.pct} size={52} label={aria} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-fg">{FEED.meterReady[til](data.pct)}</p>
          <p className="truncate text-[12px] text-fg-3">{FEED.meterLeft[til](data.left)}</p>
        </div>
      </div>
      <div className="meter mt-3" role="progressbar" aria-valuenow={data.pct} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${data.pct}%` }} />
      </div>
      <ul className="mt-3 space-y-0.5">
        {shown.map((s, i) => (
          <li key={s.key}>
            <Link href={s.href} className={cn("group flex min-h-9 items-center gap-2.5 rounded-lg px-1.5 text-[12.5px] transition hover:bg-fg/5", i === 0 ? "font-semibold text-fg" : "text-fg-2")}>
              <span className={cn("h-4 w-4 shrink-0 rounded-full border-2", i === 0 ? "border-accent" : "border-line-2")} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{tr(til, s.label)}</span>
              {i === 0 && <ArrowRight size={14} className="shrink-0 text-accent-text transition group-hover:translate-x-0.5" aria-hidden="true" />}
            </Link>
          </li>
        ))}
        {data.done > 0 && (
          <li className="flex items-center gap-2.5 px-1.5 pt-1 text-[11.5px] text-fg-4">
            <Check size={13} aria-hidden="true" /> {data.done}/{data.total}
          </li>
        )}
      </ul>
      <p className="mt-2 text-[11.5px] text-fg-4">{tr(til, FEED.meterHint)}</p>
    </div>
  );
}

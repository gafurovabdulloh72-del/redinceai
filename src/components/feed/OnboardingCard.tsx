"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Rocket, X } from "lucide-react";
import { tr, type Locale } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";
import { ONBOARDING_COOKIE, type OnboardingStep } from "@/lib/onboarding-shared";
import { cn } from "@/lib/utils";

/**
 * Yangi ijodkor yo'riqnomasi (bosh sahifa, lenta ustida): 5–6 ta qisqa qadam — rasm, tavsif, portfolio, birinchi post, jamoa, Telegram.
 * Maqsad gradienti: progress chizig'i + faqat KEYINGI qadamning izohi va tugmasi ko'rinadi (qolganlari ixcham).
 * «Keyinroq» — cookie (30 kun): server kartani qaytarmaydi, shuning uchun sahifa ochilganda miltillash yo'q.
 */
export function OnboardingCard({ steps, til }: { steps: OnboardingStep[]; til: Locale }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const done = steps.filter((s) => s.done).length;
  const percent = Math.round((done / steps.length) * 100);
  const next = steps.find((s) => !s.done);

  function dismiss() {
    try {
      document.cookie = `${ONBOARDING_COOKIE}=1; path=/; max-age=${30 * 24 * 3600}; samesite=lax`;
    } catch {
      /* cookie yozilmasa ham joriy sahifada yashiriladi */
    }
    setHidden(true);
  }

  return (
    <section className="card expand-in p-4 sm:p-5" aria-labelledby="ob-title">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-accent-soft text-accent-text">
          <Rocket size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="ob-title" className="font-display text-[16px] font-bold leading-tight text-fg">
            {tr(til, FEED.obTitle)}
          </h2>
          <p className="mt-0.5 text-[12.5px] leading-snug text-fg-3">{tr(til, FEED.obLead)}</p>
        </div>
        <button type="button" onClick={dismiss} aria-label={tr(til, FEED.obLater)} title={tr(til, FEED.obLater)} className="press -mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg">
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3.5 flex items-center gap-3">
        <div className="meter flex-1" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={FEED.obProgress[til](done, steps.length)}>
          <span style={{ width: `${Math.max(percent, 4)}%` }} />
        </div>
        <span className="stat-num shrink-0 text-[12.5px] font-semibold text-fg-2">{FEED.obProgress[til](done, steps.length)}</span>
      </div>

      <ol className="mt-3 divide-y divide-line">
        {steps.map((s, i) => {
          const isNext = next?.key === s.key;
          return (
            <li key={s.key}>
              <Link href={s.href} aria-current={isNext ? "step" : undefined} className={cn("press group flex items-center gap-3 py-2.5 transition", isNext ? "-mx-2 rounded-[12px] bg-accent-soft/40 px-2" : "hover:text-fg")}>
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums",
                    s.done ? "bg-success text-white" : isNext ? "bg-accent text-white" : "border border-line-2 text-fg-3",
                  )}
                  aria-hidden="true"
                >
                  {s.done ? <Check size={13} strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[13.5px]", s.done ? "text-fg-3 line-through decoration-fg-4/60" : "font-semibold text-fg")}>{tr(til, FEED.obSteps[s.key])}</span>
                  {isNext && <span className="block text-[12px] leading-snug text-fg-3">{tr(til, FEED.obHints[s.key])}</span>}
                </span>
                {isNext ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-accent-text">
                    {tr(til, FEED.obStart)}
                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                ) : null}
                {s.done && <span className="sr-only">✓</span>}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

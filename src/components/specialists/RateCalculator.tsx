"use client";

import { useId, useState } from "react";
import { Calculator, Info, Minus, Plus } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { localizePrice, priceFromLabel } from "@/lib/i18n/dict/catalog";
import { PROFIL } from "@/lib/i18n/dict/profile";
import type { SpecialistRates } from "@/lib/db/schema";
import { cn, formatPrice, formatUsd } from "@/lib/utils";

type Unit = "hourly" | "daily" | "unit" | "project";
const UNIT: Record<Unit, { max: number; def: number }> = {
  hourly: { max: 200, def: 4 },
  daily: { max: 60, def: 1 },
  unit: { max: 1000, def: 5 },
  project: { max: 1, def: 1 },
};

/**
 * Narx kalkulyatori (F70): soat / kun / dona × tarif yoki loyihabay boshlang'ich narx
 * (+ ixtiyoriy shoshilinch ustama, platforma sozlamasi urgentPct).
 * Natija — taxminiy; yakuniy narx buyurtmada kelishiladi.
 */
export function RateCalculator({ rates, urgentPct, usdRate, className }: { rates: SpecialistRates; urgentPct: number; usdRate: number; className?: string }) {
  const til = useLocale();
  const units = (["hourly", "daily", "unit", "project"] as const).filter((u) => (rates[u] ?? 0) > 0);
  const [unit, setUnit] = useState<Unit | null>(units[0] ?? null);
  const [qty, setQty] = useState<number>(unit ? UNIT[unit].def : 1);
  const [urgent, setUrgent] = useState(false);
  const inputId = useId();
  const urgentId = useId();

  if (!unit) return null;

  const fixed = unit === "project";
  const rate = rates[unit] ?? 0;
  const base = fixed ? rate : rate * qty;
  const total = Math.round(urgent && urgentPct > 0 ? base * (1 + urgentPct / 100) : base);
  const usd = formatUsd(total, usdRate);
  const clamp = (n: number) => Math.min(UNIT[unit].max, Math.max(1, Math.round(n) || 1));
  const noun = tr(til, PROFIL.calc.units[unit].noun);

  return (
    <section className={cn("card p-5 sm:p-6", className)} aria-labelledby="calc-title">
      <div className="flex items-center gap-2.5">
        <span className="icon-tile-outline icon-tile-sm">
          <Calculator size={16} aria-hidden="true" />
        </span>
        <h2 id="calc-title" className="font-display text-[17px] font-semibold tracking-tight text-fg">
          {tr(til, PROFIL.calc.title)}
        </h2>
      </div>

      {units.length > 1 && (
        <div className="segment mt-4 flex w-full" role="radiogroup" aria-label={tr(til, PROFIL.calc.unitAria)}>
          {units.map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={unit === u}
              data-active={unit === u}
              onClick={() => {
                setUnit(u);
                setQty(UNIT[u].def);
              }}
              className="segment-item min-h-10 flex-1"
            >
              {tr(til, PROFIL.calc.units[u].label)}
            </button>
          ))}
        </div>
      )}

      {fixed ? (
        <p className="mt-4 text-[13px] leading-relaxed text-fg-3">{PROFIL.calc.projectNote[til](priceFromLabel(til, formatPrice(rate)))}</p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label htmlFor={inputId} className="text-[13px] font-medium text-fg-2">
            {PROFIL.calc.howMany[til](noun)} <span className="font-normal text-fg-4">({localizePrice(til, formatPrice(rate))} / {noun})</span>
          </label>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setQty((q) => clamp(q - 1))}
              aria-label={tr(til, PROFIL.calc.decrease)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line-2 text-fg transition hover:border-fg disabled:opacity-40"
              disabled={qty <= 1}
            >
              <Minus size={15} />
            </button>
            <input
              id={inputId}
              type="number"
              inputMode="numeric"
              min={1}
              max={UNIT[unit].max}
              value={qty}
              onChange={(e) => setQty(clamp(Number(e.target.value)))}
              className="field !h-10 !w-20 text-center tabular-nums"
            />
            <button
              type="button"
              onClick={() => setQty((q) => clamp(q + 1))}
              aria-label={tr(til, PROFIL.calc.increase)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line-2 text-fg transition hover:border-fg disabled:opacity-40"
              disabled={qty >= UNIT[unit].max}
            >
              <Plus size={15} />
            </button>
          </div>
        </div>
      )}

      {urgentPct > 0 && (
        <div className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-[12px] border border-line px-3.5 py-2">
          <span id={urgentId} className="text-[13px] font-medium text-fg-2">
            {PROFIL.calc.urgent[til](urgentPct)}
          </span>
          <button type="button" role="switch" aria-checked={urgent} aria-labelledby={urgentId} onClick={() => setUrgent((v) => !v)} className="switch" />
        </div>
      )}

      <div className="mt-4 rounded-[16px] bg-surface-2 px-4 py-3.5" aria-live="polite">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-fg-3">{tr(til, PROFIL.calc.estimate)}</p>
        <p className="mt-1 font-display text-[24px] font-semibold leading-tight tracking-tight text-fg">
          {fixed && til === "ru" ? <span className="text-[15px] font-medium text-fg-3">от </span> : null}
          {localizePrice(til, formatPrice(total))}
          {fixed && til !== "ru" ? <span className="text-[15px] font-medium text-fg-3"> dan</span> : null}
        </p>
        <p className="mt-0.5 text-[12px] text-fg-3">
          {fixed ? tr(til, PROFIL.calc.projectUnit) : `${qty} ${noun} × ${localizePrice(til, formatPrice(rate))}`}
          {urgent && urgentPct > 0 ? ` + ${urgentPct}%` : ""}
          {usd ? ` · ${usd}` : ""}
        </p>
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-snug text-fg-3">
        <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
        {tr(til, PROFIL.calc.disclaimer)}
      </p>
    </section>
  );
}

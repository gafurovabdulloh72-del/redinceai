"use client";

import { useId, useState } from "react";
import { Calculator, Info, Minus, Plus } from "lucide-react";
import type { SpecialistRates } from "@/lib/db/schema";
import { cn, formatPrice, formatUsd } from "@/lib/utils";

type Unit = "hourly" | "daily";
const UNIT: Record<Unit, { label: string; noun: string; max: number; def: number }> = {
  hourly: { label: "Soatbay", noun: "soat", max: 200, def: 4 },
  daily: { label: "Kunbay", noun: "kun", max: 60, def: 1 },
};

/**
 * Narx kalkulyatori (F70): soat yoki kun × tarif (+ ixtiyoriy shoshilinch ustama, platforma sozlamasi urgentPct).
 * Natija — taxminiy; yakuniy narx buyurtmada kelishiladi. Loyiha tarifi alohida qator sifatida.
 */
export function RateCalculator({ rates, urgentPct, usdRate, className }: { rates: SpecialistRates; urgentPct: number; usdRate: number; className?: string }) {
  const units = (["hourly", "daily"] as const).filter((u) => (rates[u] ?? 0) > 0);
  const [unit, setUnit] = useState<Unit | null>(units[0] ?? null);
  const [qty, setQty] = useState<number>(unit ? UNIT[unit].def : 1);
  const [urgent, setUrgent] = useState(false);
  const inputId = useId();
  const urgentId = useId();

  if (!units.length && !rates.project) return null;

  const rate = unit ? (rates[unit] ?? 0) : 0;
  const base = rate * qty;
  const total = Math.round(urgent && urgentPct > 0 ? base * (1 + urgentPct / 100) : base);
  const usd = formatUsd(total, usdRate);
  const clamp = (n: number) => (unit ? Math.min(UNIT[unit].max, Math.max(1, Math.round(n) || 1)) : 1);

  return (
    <section className={cn("card p-5 sm:p-6", className)} aria-labelledby="calc-title">
      <div className="flex items-center gap-2.5">
        <span className="icon-tile-outline icon-tile-sm">
          <Calculator size={16} aria-hidden="true" />
        </span>
        <h2 id="calc-title" className="font-display text-[17px] font-semibold tracking-tight text-fg">
          Narx kalkulyatori
        </h2>
      </div>

      {/* Tariflar */}
      <ul className="mt-4 grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-3">
        {rates.hourly ? (
          <li className="rounded-[12px] bg-surface-2 px-3 py-2">
            <span className="block text-fg-3">Soatiga</span>
            <span className="font-semibold text-fg">{formatPrice(rates.hourly)}</span>
          </li>
        ) : null}
        {rates.daily ? (
          <li className="rounded-[12px] bg-surface-2 px-3 py-2">
            <span className="block text-fg-3">Kuniga</span>
            <span className="font-semibold text-fg">{formatPrice(rates.daily)}</span>
          </li>
        ) : null}
        {rates.project ? (
          <li className="rounded-[12px] bg-surface-2 px-3 py-2">
            <span className="block text-fg-3">Loyiha</span>
            <span className="font-semibold text-fg">{formatPrice(rates.project)} dan</span>
          </li>
        ) : null}
      </ul>

      {unit && (
        <>
          {units.length > 1 && (
            <div className="segment mt-4 flex w-full" role="radiogroup" aria-label="Hisob birligi">
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
                  {UNIT[u].label}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label htmlFor={inputId} className="text-[13px] font-medium text-fg-2">
              Necha {UNIT[unit].noun}?
            </label>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setQty((q) => clamp(q - 1))}
                aria-label="Kamaytirish"
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
                aria-label="Ko'paytirish"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line-2 text-fg transition hover:border-fg disabled:opacity-40"
                disabled={qty >= UNIT[unit].max}
              >
                <Plus size={15} />
              </button>
            </div>
          </div>

          {urgentPct > 0 && (
            <div className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-[12px] border border-line px-3.5 py-2">
              <span id={urgentId} className="text-[13px] font-medium text-fg-2">
                Shoshilinch (+{urgentPct}%)
              </span>
              <button type="button" role="switch" aria-checked={urgent} aria-labelledby={urgentId} onClick={() => setUrgent((v) => !v)} className="switch" />
            </div>
          )}

          <div className="mt-4 rounded-[16px] bg-surface-2 px-4 py-3.5" aria-live="polite">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-fg-3">Taxminiy narx</p>
            <p className="mt-1 font-display text-[24px] font-semibold leading-tight tracking-tight text-fg">{formatPrice(total)}</p>
            <p className="mt-0.5 text-[12px] text-fg-3">
              {qty} {UNIT[unit].noun} × {formatPrice(rate)}
              {urgent && urgentPct > 0 ? ` + ${urgentPct}%` : ""}
              {usd ? ` · ${usd}` : ""}
            </p>
          </div>
        </>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-snug text-fg-3">
        <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
        Bu taxminiy hisob. Yakuniy narx loyiha hajmiga qarab mutaxassis bilan kelishiladi va buyurtmada belgilanadi.
      </p>
    </section>
  );
}

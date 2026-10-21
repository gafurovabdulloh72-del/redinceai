"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Globe2, MapPin, Wallet, Zap } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { REGIONS } from "@/lib/constants";
import { CategoryPicker } from "@/components/ui/CategoryPicker";
import { cn } from "@/lib/utils";
import { REMOTE_KEY, WIZARD_BUDGETS, WIZARD_DEADLINES, wizardQuery, type WizardBudgetKey, type WizardDeadlineKey, type WizardState } from "./wizard-options";

const STEPS = [
  { key: "yonalish", title: "Qanday mutaxassis kerak?", hint: "Yo'nalishni tanlang" },
  { key: "byudjet", title: "Byudjetingiz qancha?", hint: "Taxminiy summa — keyin kelishasiz" },
  { key: "hudud", title: "Qayerda ishlash kerak?", hint: "Hudud yoki masofaviy ish" },
  { key: "muddat", title: "Qachongacha kerak?", hint: "Muddat bo'yicha mos mutaxassislar" },
] as const;

const tile = (on: boolean) =>
  cn(
    "press flex min-h-11 items-center gap-2.5 rounded-[14px] border px-3.5 py-3 text-left text-[14px] font-semibold transition",
    on ? "border-fg bg-fg/4 text-fg ring-1 ring-fg" : "border-line bg-surface text-fg-2 hover:border-line-2 hover:text-fg",
  );

/**
 * Buyurtma sehrgari (F72): Yo'nalish → Byudjet → Hudud/masofaviy → Muddat. Har qadamda tanlov keyingisiga o'tkazadi;
 * oxirida natija URL'ga yoziladi (?…&natija=1) — sahifa tavsiyalarni serverda hisoblaydi (ulashish/orqaga ishlaydi).
 */
export function OrderWizard({ initial, initialStep = 0 }: { initial: WizardState; initialStep?: number }) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(3, Math.max(0, initialStep)));
  const [v, setV] = useState<WizardState>(initial);
  /** Qadam yo'nalishi: oldinga — chapdan kiradi, orqaga — o'ngdan (slide tokenlari) */
  const [dir, setDir] = useState<1 | -1>(1);
  const [pending, start] = useTransition();
  const go = (next: number) => {
    setDir(next >= step ? 1 : -1);
    setStep(Math.min(3, Math.max(0, next)));
  };

  const finish = (next: WizardState) => start(() => router.push(`/buyurtma-berish?${wizardQuery(next, { natija: "1" })}`));
  const choose = (patch: Partial<WizardState>) => {
    const next = { ...v, ...patch };
    setV(next);
    if (step < 3) window.setTimeout(() => go(step + 1), 140);
    else finish(next);
  };
  const filled = [v.yonalish, v.byudjet, v.hudud, v.muddat];
  const current = STEPS[step];

  return (
    <div className="card-elevated max-w-3xl p-5 sm:p-8">
      {/* Progress */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">
          {step + 1}/{STEPS.length}-qadam
        </p>
        {step > 0 && (
          <button type="button" onClick={() => go(step - 1)} className="press -mr-2 inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-fg-2 transition hover:bg-fg/6 hover:text-fg">
            <ArrowLeft size={14} /> Orqaga
          </button>
        )}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1} aria-label="Sehrgar bosqichi">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => (i <= step || filled[i - 1] ? go(i) : undefined)}
            className="group py-2"
            aria-label={`${i + 1}-qadam: ${s.hint}`}
            tabIndex={-1}
          >
            <span className={cn("block h-1.5 rounded-full transition-colors", i < step || (i === step && filled[i]) ? "bg-fg" : i === step ? "bg-accent" : "bg-line-2")} />
          </button>
        ))}
      </div>

      <h2 className="display-xl mt-4 text-[26px] text-fg sm:text-[32px]">{current.title}</h2>
      <p className="mt-1.5 text-[14px] text-fg-3">{current.hint}</p>

      <div className={cn("mt-5", dir === 1 ? "animate-slide-left" : "animate-slide-right")} key={step}>
        {step === 0 && (
          <CategoryPicker value={v.yonalish || null} onChange={(slug) => choose({ yonalish: slug })} />
        )}

        {step === 1 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {WIZARD_BUDGETS.map((b) => {
              const on = v.byudjet === b.key;
              return (
                <button key={b.key} type="button" aria-pressed={on} onClick={() => choose({ byudjet: b.key as WizardBudgetKey })} className={tile(on)}>
                  <Wallet size={16} className="shrink-0 text-fg-3" />
                  <span className="flex-1">{b.label}</span>
                  {on && <Check size={15} />}
                </button>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <button type="button" aria-pressed={v.hudud === REMOTE_KEY} onClick={() => choose({ hudud: REMOTE_KEY })} className={cn(tile(v.hudud === REMOTE_KEY), "w-full")}>
              <Globe2 size={17} className="shrink-0 text-accent" />
              <span className="flex-1">
                Masofaviy — hudud muhim emas
                <span className="block text-[12px] font-normal text-fg-3">Montaj, dizayn, animatsiya kabi onlayn bajariladigan ishlar uchun</span>
              </span>
              {v.hudud === REMOTE_KEY && <Check size={15} />}
            </button>
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3">
              {REGIONS.map((r) => {
                const on = v.hudud === r.slug;
                return (
                  <button key={r.slug} type="button" aria-pressed={on} onClick={() => choose({ hudud: r.slug })} className={tile(on)}>
                    <MapPin size={15} className="shrink-0 text-fg-3" />
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    {on && <Check size={15} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {WIZARD_DEADLINES.map((d) => {
              const on = v.muddat === d.key;
              return (
                <button key={d.key} type="button" aria-pressed={on} disabled={pending} onClick={() => choose({ muddat: d.key as WizardDeadlineKey })} className={tile(on)}>
                  {d.key === "shoshilinch" ? <Zap size={16} className="shrink-0 text-warning-text" /> : <Check size={16} className={cn("shrink-0", on ? "text-fg" : "text-fg-4")} />}
                  <span className="flex-1">
                    {d.label}
                    <span className="block text-[12px] font-normal text-fg-3">{d.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
        {step < 3 ? (
          <Button size="md" variant="outline" onClick={() => go(step + 1)} disabled={!filled[step]}>
            Keyingi <ArrowRight size={15} />
          </Button>
        ) : (
          <Button size="md" variant="accent" onClick={() => finish(v)} disabled={pending || !v.yonalish}>
            {pending ? <Spinner /> : <ArrowRight size={15} />} Mutaxassislarni ko'rsatish
          </Button>
        )}
      </div>
    </div>
  );
}

"use client";

import { ArrowLeft, ArrowRight, Check, Clapperboard, Search } from "lucide-react";
import { Button } from "@/components/ui";
import { CategoryField } from "@/components/ui/CategoryPicker";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { AUTH } from "@/lib/i18n/dict/auth";
import { CATEGORIES, CATEGORY_GROUPS } from "@/lib/categories";
import { EXPERIENCE_LEVELS, REGIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Role = "client" | "specialist";

/** Qadam ko'rsatkichi: [← Orqaga] segmentlar ketma-ket to'ladi (animatsiyali) · «2/3» — bitta ixcham qator */
export function StepBar({ step, total, onBack }: { step: number; total: number; onBack?: () => void }) {
  const til = useLocale();
  return (
    <div className="mb-3 flex items-center gap-3 tiny:mb-2">
      {onBack && (
        <button type="button" onClick={onBack} className="press -ml-2 inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[13px] font-semibold text-fg-3 transition hover:bg-fg/6 hover:text-fg">
          <ArrowLeft size={14} aria-hidden="true" /> {tr(til, AUTH.reg.back)}
        </button>
      )}
      <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-label={AUTH.reg.stepOf[til](step, total)}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/8">
            <span className={cn("block h-full rounded-full bg-[image:var(--brand-grad)] transition-[width] duration-500 ease-out", i < step ? "w-full" : "w-0")} />
          </span>
        ))}
      </div>
      <span className="shrink-0 text-[12px] font-semibold tabular-nums text-fg-3" aria-hidden="true">
        {step}/{total}
      </span>
    </div>
  );
}

/** Ikki karta YONMA-YON: Mijoz / Mutaxassis. Tanlanganda halqa pulsi + belgi chiqadi; bosish — keyingi qadamga o'tadi (onPick). Telefonda qisqa matn, katta ekranda batafsil. */
export function RoleStep({ role, onPick }: { role: Role | null; onPick: (r: Role) => void }) {
  const til = useLocale();
  const cards = [
    {
      value: "client" as const,
      icon: Search,
      title: tr(til, AUTH.reg.clientTitle),
      tag: tr(til, AUTH.reg.clientTag),
      lead: tr(til, AUTH.reg.clientLead),
      bullets: [tr(til, AUTH.reg.clientB1), tr(til, AUTH.reg.clientB2), tr(til, AUTH.reg.clientB3)],
      from: "#6b8fcf",
      to: "#8b7fd1",
    },
    {
      value: "specialist" as const,
      icon: Clapperboard,
      title: tr(til, AUTH.reg.specTitle),
      tag: tr(til, AUTH.reg.specTag),
      lead: tr(til, AUTH.reg.specLead),
      bullets: [tr(til, AUTH.reg.specB1), tr(til, AUTH.reg.specB2), tr(til, AUTH.reg.specB3)],
      from: "#ff5a36",
      to: "#df7a5a",
    },
  ];
  return (
    <div role="radiogroup" aria-label={tr(til, AUTH.role.aria)} className="grid grid-cols-2 gap-3">
      {cards.map((c, i) => {
        const on = role === c.value;
        const Icon = c.icon;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(c.value)}
            style={{ animationDelay: `${i * 80}ms` }}
            className={cn(
              "group animate-fade-up relative flex min-w-0 flex-col overflow-hidden rounded-[22px] border bg-surface text-left transition duration-300 active:scale-[0.985]",
              on ? "border-accent ring-4 ring-accent/15" : "border-line hover:-translate-y-0.5 hover:border-line-2 hover:shadow-[var(--shadow-2)]",
            )}
          >
            {/* Tasvir maydoni: rol rangidagi yumshoq fon + katta xira belgi (suv belgisi) + oldingi plitka */}
            <span
              className="relative block h-[104px] shrink-0 overflow-hidden sm:h-[124px] short:!h-[92px]"
              style={{ background: `linear-gradient(140deg, color-mix(in srgb, ${c.from} 24%, var(--surface)), color-mix(in srgb, ${c.to} 9%, var(--surface)))` }}
            >
              <Icon aria-hidden="true" size={118} strokeWidth={1.25} className="absolute -bottom-6 -right-5 opacity-[0.16] transition-transform duration-500 group-hover:-translate-y-1 group-hover:-rotate-6" style={{ color: c.from }} />
              <span className="absolute left-3.5 top-3.5 flex h-11 w-11 items-center justify-center rounded-[14px] text-white shadow-[0_8px_20px_-8px_var(--tile)] sm:left-4 sm:top-4 sm:h-12 sm:w-12" style={{ background: `linear-gradient(145deg, ${c.from}, ${c.to})`, ["--tile" as string]: c.from }}>
                <Icon size={22} strokeWidth={2} />
              </span>
              <span className={cn("absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 transition", on ? "animate-badge-pop border-accent bg-accent text-white" : "border-fg/15 bg-surface/70")} aria-hidden="true">
                {on && <Check size={13} strokeWidth={3} />}
              </span>
            </span>
            <span className="flex flex-1 flex-col p-3.5 sm:p-4">
              <span className="block font-display text-[15px] font-extrabold leading-tight tracking-tight text-fg sm:text-[17px]">{c.title}</span>
              <span className="mt-1 block text-[12.5px] leading-snug text-fg-3 sm:hidden">{c.tag}</span>
              <span className="mt-1 hidden text-[13px] leading-snug text-fg-3 sm:block">{c.lead}</span>
              {/* Afzalliklar: faqat keng va yetarli baland ekranda */}
              <ul className="mt-3 hidden space-y-1.5 sm:block cozy:!hidden">
                {c.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[12.5px] leading-snug text-fg-2">
                    <Check size={14} strokeWidth={2.5} className="mt-px shrink-0" style={{ color: c.from }} aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-[13px] font-semibold text-fg">
                {tr(til, AUTH.reg.next)}
                <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Mutaxassis uchun 2-qadam — hammasi bitta ekranda: kasb (Upwork uslubidagi menyu varag'i), tajriba (bitta qator) va hudud.
 * Kasb ro'yxati sahifada ochilib turmaydi — «Tanlash» bosilganda varaqda ochiladi (scroll yo'q).
 */
export function CraftStep({
  category,
  onCategory,
  experience,
  onExperience,
  region,
  onRegion,
  onNext,
  error,
}: {
  category: string | null;
  onCategory: (slug: string) => void;
  experience: string;
  onExperience: (v: string) => void;
  region: string;
  onRegion: (v: string) => void;
  onNext: () => void;
  error?: string | null;
}) {
  const til = useLocale();
  // «Boshlang'ich (1 yilgacha)» → tugmada bosh qismi, tanlanganda qavs ichi (yillar) tagida
  const split = (label: string) => {
    const m = /^(.*?)\s*\((.*)\)$/.exec(label);
    return { main: m ? m[1] : label, years: m ? m[2] : "" };
  };
  const years = split(EXPERIENCE_LEVELS.find((e) => e.value === experience)?.label ?? "").years;
  return (
    <div className="space-y-4 short:space-y-3 tiny:space-y-2.5">
      <div>
        <span className="field-label">{tr(til, AUTH.reg.craftTitle)}</span>
        <CategoryField
          value={category}
          onChange={onCategory}
          title={tr(til, AUTH.reg.craftTitle)}
          placeholder={tr(til, AUTH.reg.craftTitle)}
          labels={{ choose: tr(til, AUTH.reg.choose), change: tr(til, AUTH.reg.change), hint: AUTH.reg.craftCount[til](CATEGORIES.length, CATEGORY_GROUPS.length) }}
        />
      </div>

      <div>
        <span className="field-label">{tr(til, AUTH.reg.expTitle)}</span>
        <div role="radiogroup" aria-label={tr(til, AUTH.reg.expTitle)} className="grid grid-cols-4 gap-1.5">
          {EXPERIENCE_LEVELS.map((e) => {
            const on = experience === e.value;
            return (
              <button
                key={e.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onExperience(e.value)}
                className={cn("press min-h-11 min-w-0 rounded-[12px] border px-1 text-center text-[12px] font-semibold leading-tight transition sm:text-[13px]", on ? "border-accent bg-accent-soft/50 text-fg ring-1 ring-accent/40" : "border-line bg-surface text-fg-2 hover:border-line-2")}
              >
                {split(e.label).main}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 h-4 text-[12px] text-fg-3" aria-live="polite">
          {years}
        </p>
      </div>

      <div>
        <label htmlFor="reg-region" className="field-label">
          {tr(til, AUTH.reg.regionTitle)}
        </label>
        <select id="reg-region" value={region} onChange={(e) => onRegion(e.target.value)} className="field w-full text-[14.5px]">
          <option value="">{tr(til, AUTH.reg.regionPlaceholder)}</option>
          {REGIONS.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="expand-in text-[13px] font-semibold text-danger-text">
          {error}
        </p>
      )}

      <Button type="button" variant="accent" size="lg" onClick={onNext} className="w-full">
        {tr(til, AUTH.reg.next)} <ArrowRight size={18} />
      </Button>
    </div>
  );
}

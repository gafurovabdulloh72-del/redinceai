"use client";

import { ArrowLeft, ArrowRight, Check, Clapperboard, Search } from "lucide-react";
import { Button } from "@/components/ui";
import { CategoryPicker } from "@/components/ui/CategoryPicker";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { AUTH } from "@/lib/i18n/dict/auth";
import { CATEGORY_BY_SLUG, CATEGORY_GROUP_BY_SLUG, EXPERIENCE_LEVELS, REGIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Role = "client" | "specialist";

/** Qadam ko'rsatkichi: segmentlar ketma-ket to'ladi (animatsiyali) + «2-qadam · 3 dan» */
export function StepBar({ step, total }: { step: number; total: number }) {
  const til = useLocale();
  return (
    <div className="mb-5" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-label={AUTH.reg.stepOf[til](step, total)}>
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/8">
            <span className={cn("block h-full rounded-full bg-[image:var(--brand-grad)] transition-[width] duration-500 ease-out", i < step ? "w-full" : "w-0")} />
          </span>
        ))}
      </div>
      <p className="mt-2 text-[12px] font-semibold text-fg-3">{AUTH.reg.stepOf[til](step, total)}</p>
    </div>
  );
}

/** Ikki katta karta: Mijoz / Mutaxassis. Tanlanganda halqa pulsi + belgi chiqadi; bosish — keyingi qadamga o'tadi (onPick). */
export function RoleStep({ role, onPick }: { role: Role | null; onPick: (r: Role) => void }) {
  const til = useLocale();
  const cards = [
    {
      value: "client" as const,
      icon: Search,
      title: tr(til, AUTH.reg.clientTitle),
      lead: tr(til, AUTH.reg.clientLead),
      bullets: [tr(til, AUTH.reg.clientB1), tr(til, AUTH.reg.clientB2), tr(til, AUTH.reg.clientB3)],
      from: "#6b8fcf",
      to: "#8b7fd1",
    },
    {
      value: "specialist" as const,
      icon: Clapperboard,
      title: tr(til, AUTH.reg.specTitle),
      lead: tr(til, AUTH.reg.specLead),
      bullets: [tr(til, AUTH.reg.specB1), tr(til, AUTH.reg.specB2), tr(til, AUTH.reg.specB3)],
      from: "#ff5a36",
      to: "#df7a5a",
    },
  ];
  return (
    <div role="radiogroup" aria-label={tr(til, AUTH.role.aria)} className="grid gap-3 sm:grid-cols-2">
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
            style={{ animationDelay: `${i * 90}ms` }}
            className={cn(
              "group animate-tilt-in relative flex flex-col overflow-hidden rounded-[20px] border p-4 text-left transition-all duration-300 active:scale-[0.985] sm:p-5",
              on ? "animate-ring-pulse border-accent bg-accent-soft/40" : "border-line bg-surface hover:-translate-y-1 hover:border-line-2 hover:shadow-[var(--shadow-2)]",
            )}
          >
            {/* Orqa nur shari */}
            <span aria-hidden="true" className="animate-orb pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-30 blur-2xl transition-opacity duration-300 group-hover:opacity-60" style={{ background: `radial-gradient(circle, ${c.from}, transparent 70%)`, animationDelay: `${i * 2}s` }} />
            <span className="animate-float relative flex h-14 w-14 items-center justify-center rounded-[18px] text-white shadow-[0_10px_24px_-10px_var(--tile)]" style={{ background: `linear-gradient(145deg, ${c.from}, ${c.to})`, ["--tile" as string]: c.from, animationDelay: `${i * 0.6}s` }}>
              <Icon size={26} strokeWidth={2} />
            </span>
            <span className="relative mt-3.5 block font-display text-[19px] font-extrabold leading-tight tracking-tight text-fg">{c.title}</span>
            <span className="relative mt-1 block text-[13px] leading-snug text-fg-3">{c.lead}</span>
            <ul className="relative mt-3.5 space-y-1.5">
              {c.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-[12.5px] leading-snug text-fg-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white" style={{ background: c.from }}>
                    <Check size={10} strokeWidth={3.5} aria-hidden="true" />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <span className="relative mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg">
              {tr(til, AUTH.reg.next)}
              <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </span>
            {on && (
              <span className="animate-badge-pop absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white" aria-hidden="true">
                <Check size={13} strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Mutaxassis uchun 2-qadam: kasb (Upwork uslubidagi menyu), tajriba darajasi va hudud */
export function CraftStep({
  category,
  onCategory,
  experience,
  onExperience,
  region,
  onRegion,
  onBack,
  onNext,
  error,
}: {
  category: string | null;
  onCategory: (slug: string) => void;
  experience: string;
  onExperience: (v: string) => void;
  region: string;
  onRegion: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  error?: string | null;
}) {
  const til = useLocale();
  const c = category ? CATEGORY_BY_SLUG[category] : undefined;
  return (
    <div className="space-y-5">
      {c && (
        <div className="animate-pop flex items-center gap-3 rounded-[16px] border border-accent/40 bg-accent-soft/40 p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-white" style={{ background: `linear-gradient(145deg, ${c.accent}, ${c.accent}b0)` }}>
            <CategoryIcon icon={c.icon} size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-fg">{c.name}</span>
            <span className="block truncate text-[12px] text-fg-3">
              {tr(til, AUTH.reg.chosen)} · {CATEGORY_GROUP_BY_SLUG[c.group].name}
            </span>
          </span>
        </div>
      )}

      <CategoryPicker value={category} onChange={onCategory} stacked />

      <div>
        <span className="field-label">{tr(til, AUTH.reg.expTitle)}</span>
        <div role="radiogroup" aria-label={tr(til, AUTH.reg.expTitle)} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {EXPERIENCE_LEVELS.map((e) => {
            const on = experience === e.value;
            // «Boshlang'ich (1 yilgacha)» → bosh qismi + qavs ichi alohida qatorda
            const m = /^(.*?)\s*\((.*)\)$/.exec(e.label);
            return (
              <button
                key={e.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onExperience(e.value)}
                className={cn("press rounded-[14px] border px-3 py-2.5 text-left transition", on ? "border-accent bg-accent-soft/50 ring-1 ring-accent/40" : "border-line bg-surface hover:border-line-2")}
              >
                <span className="block text-[13px] font-semibold text-fg">{m ? m[1] : e.label}</span>
                {m && <span className="block text-[11.5px] text-fg-3">{m[2]}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="reg-region" className="field-label">
          {tr(til, AUTH.reg.regionTitle)}
        </label>
        <select id="reg-region" value={region} onChange={(e) => onRegion(e.target.value)} className="field h-12 w-full text-[14.5px]">
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

      <div className="flex items-center gap-2.5">
        <Button type="button" variant="outline" size="lg" onClick={onBack} className="shrink-0">
          <ArrowLeft size={17} /> {tr(til, AUTH.reg.back)}
        </Button>
        <Button type="button" variant="accent" size="lg" onClick={onNext} className="btn-shine flex-1">
          {tr(til, AUTH.reg.next)} <ArrowRight size={18} />
        </Button>
      </div>
    </div>
  );
}

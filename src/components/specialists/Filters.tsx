"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowUpDown, CheckCircle2, ChevronDown, LayoutGrid, Rows3, Search, SlidersHorizontal, X } from "lucide-react";
import { Button, Spinner, VerifiedBadge } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { CATEGORIES, EXPERIENCE_LEVELS, GENDERS, REGIONS } from "@/lib/constants";
import { cn, formatPrice } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Konstantalar                                                        */
/* ------------------------------------------------------------------ */
export const PRICE_MAX = 20_000_000;
export const PRICE_STEP = 100_000;

/** URL'dagi "filtr" kalitlari (sort/limit/page/view bunga kirmaydi) */
export const FILTER_KEYS = ["q", "category", "region", "priceMin", "priceMax", "experience", "verified", "gender", "available"] as const;

export const SORT_OPTIONS = [
  { value: "rating", label: "Reyting bo'yicha" },
  { value: "popular", label: "Mashhurlik bo'yicha" },
  { value: "newest", label: "Eng yangilari" },
  { value: "price_asc", label: "Narx: arzondan" },
  { value: "price_desc", label: "Narx: qimmatdan" },
] as const;

/** Tez tanlanadigan narx oraliqlari (so'm) */
const PRICE_PRESETS: Array<{ label: string; min: number; max: number }> = [
  { label: "1 mln gacha", min: 0, max: 1_000_000 },
  { label: "1–3 mln", min: 1_000_000, max: 3_000_000 },
  { label: "3–7 mln", min: 3_000_000, max: 7_000_000 },
  { label: "7 mln+", min: 7_000_000, max: 0 },
];

/* ------------------------------------------------------------------ */
/* URL bilan ishlovchi hook                                            */
/* ------------------------------------------------------------------ */
function useUrlFilters() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const navigate = useCallback(
    (next: URLSearchParams, replace: boolean) => {
      if (next.toString() === sp.toString()) return;
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => {
        if (replace) router.replace(url, { scroll: false });
        else router.push(url, { scroll: false });
      });
    },
    [sp, pathname, router],
  );

  /** Bir nechta parametrni o'zgartiradi; (keepPage bo'lmasa) page=1 ga qaytadi */
  const setParams = useCallback(
    (patch: Record<string, string | null | undefined>, opts: { replace?: boolean; keepPage?: boolean } = {}) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (!opts.keepPage) next.delete("page");
      navigate(next, !!opts.replace);
    },
    [sp, navigate],
  );

  /** Barcha filtrlarni tozalaydi (saralash va ko'rinish saqlanadi) */
  const reset = useCallback(() => {
    const next = new URLSearchParams(sp.toString());
    for (const k of FILTER_KEYS) next.delete(k);
    next.delete("page");
    navigate(next, false);
  }, [sp, navigate]);

  // Narx oralig'i (min+max) bitta filtr sifatida sanaladi
  const activeCount =
    FILTER_KEYS.filter((k) => {
      if (k === "priceMin" || k === "priceMax") return false;
      const v = sp.get(k);
      return !!v && v !== "0";
    }).length + (Number(sp.get("priceMin")) > 0 || Number(sp.get("priceMax")) > 0 ? 1 : 0);

  return { sp, setParams, reset, pending, activeCount };
}

/**
 * Lokal qiymat + kechiktirilgan (debounce) URL yangilanishi.
 * URL tashqaridan o'zgarsa (chip olib tashlandi, Tozalash) lokal qiymat ham yangilanadi.
 */
function useDebouncedParam(urlValue: string, commit: (v: string) => void, normalize: (v: string) => string, delay = 400) {
  const [value, setValue] = useState(urlValue);
  const synced = useRef(urlValue);

  useEffect(() => {
    if (urlValue !== synced.current) {
      synced.current = urlValue;
      setValue(urlValue);
    }
  }, [urlValue]);

  useEffect(() => {
    const norm = normalize(value);
    if (norm === synced.current) return;
    const t = setTimeout(() => {
      synced.current = norm;
      commit(norm);
    }, delay);
    return () => clearTimeout(t);
  }, [value, commit, normalize, delay]);

  const flush = useCallback(() => {
    const norm = normalize(value);
    if (norm === synced.current) return;
    synced.current = norm;
    commit(norm);
  }, [value, commit, normalize]);

  const resetLocal = useCallback((v: string) => {
    synced.current = v;
    setValue(v);
  }, []);

  return { value, setValue, flush, resetLocal };
}

const normQ = (v: string) => v.trim().slice(0, 80);

/* Narx oralig'i "min|max" satri sifatida saqlanadi (bo'sh = chegara yo'q) */
const clampPrice = (n: number) => Math.min(PRICE_MAX, Math.max(0, Math.round(n / PRICE_STEP) * PRICE_STEP));
function encodeRange(min: number, max: number) {
  let hi = clampPrice(max);
  if (hi <= 0 || hi >= PRICE_MAX) hi = 0;
  // Minimal qiymat maksimaldan kamida bir qadam past bo'lsin
  const lo = hi > 0 ? Math.min(clampPrice(min), hi - PRICE_STEP) : clampPrice(min);
  return `${lo > 0 ? lo : ""}|${hi > 0 ? hi : ""}`;
}
function decodeRange(v: string): { min: number; max: number } {
  const [a, b] = v.split("|");
  return { min: Number(a) || 0, max: Number(b) || 0 };
}
const normRange = (v: string) => {
  const { min, max } = decodeRange(v);
  return encodeRange(min, max);
};
const priceLabel = (n: number) => formatPrice(n, { compact: true }).replace(" so'm", "");
function rangeText(min: number, max: number) {
  if (!min && !max) return "Cheklanmagan";
  if (min && !max) return `${priceLabel(min)} so'mdan`;
  if (!min && max) return `${priceLabel(max)} so'mgacha`;
  return `${priceLabel(min)} – ${priceLabel(max)} so'm`;
}

/* ------------------------------------------------------------------ */
/* Kichik UI bo'laklari                                                */
/* ------------------------------------------------------------------ */
function Chip({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition active:scale-[0.97]",
        active ? "btn-ink border-transparent" : "border-line bg-surface text-fg-2 hover:border-line-2 hover:text-fg",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Count({ n, active }: { n: number; active: boolean }) {
  return <span className={cn("text-[11px] tabular-nums", active ? "opacity-80" : "text-fg-4")}>{n}</span>;
}

/** Studio switch: 44×26 pill, yoqilganda "siyoh" (globals.css → .switch). Bosish maydoni 44px'gacha kengaytirilgan. */
export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="switch before:absolute before:-inset-x-2 before:-inset-y-2.5 before:content-['']"
    />
  );
}

function ActiveBadge({ n, tone = "accent" }: { n: number; tone?: "accent" | "ink" }) {
  if (n <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums leading-none",
        tone === "ink" ? "bg-ink text-ink-fg" : "bg-accent text-white",
      )}
      aria-label={`${n} ta faol filtr`}
    >
      {n}
    </span>
  );
}

/** Yig'iladigan filtr guruhi: sarlavha + (yopiq holatda) tanlangan qiymat xulosasi */
function Group({ title, summary, defaultOpen = false, children }: { title: string; summary?: string | null; defaultOpen?: boolean; children: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen || Boolean(summary));
  return (
    <section className="border-t border-line">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left"
      >
        <span className="text-[14px] font-semibold text-fg">{title}</span>
        <span className="flex min-w-0 items-center gap-2">
          {!open && summary && <span className="max-w-[150px] truncate rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-text">{summary}</span>}
          <ChevronDown size={16} className={cn("shrink-0 text-fg-3 transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
        </span>
      </button>
      <div id={id} hidden={!open} className="pb-4">
        {children}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Ikki tutqichli narx slayderi                                         */
/* ------------------------------------------------------------------ */
const thumb =
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-[26px] [&::-webkit-slider-thumb]:w-[26px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-line-2 [&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:shadow-[var(--shadow-2)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:active:scale-110 " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-[26px] [&::-moz-range-thumb]:w-[26px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-line-2 [&::-moz-range-thumb]:bg-surface [&::-moz-range-thumb]:shadow-[var(--shadow-2)]";

function PriceRange({
  min,
  max,
  onChange,
  onCommit,
}: {
  min: number;
  max: number; // 0 = cheksiz
  onChange: (min: number, max: number) => void;
  onCommit: () => void;
}) {
  const hiVal = max > 0 ? max : PRICE_MAX;
  const loPct = (min / PRICE_MAX) * 100;
  const hiPct = (hiVal / PRICE_MAX) * 100;
  const text = rangeText(min, max);

  const setLo = (v: number) => onChange(Math.min(v, hiVal - PRICE_STEP), max);
  const setHi = (v: number) => onChange(Math.min(min, v - PRICE_STEP), v >= PRICE_MAX ? 0 : v);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[12px] text-fg-3">Oraliq</span>
        <output className="whitespace-nowrap text-[13px] font-semibold tabular-nums text-fg" aria-live="polite">
          {text}
        </output>
      </div>

      <div className="relative h-7 px-[13px]" role="group" aria-label="Narx oralig'i">
        {/* Yo'lak va tanlangan oraliq */}
        <div className="absolute inset-x-[13px] top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-fg/10" aria-hidden="true">
          <div className="absolute inset-y-0 rounded-full bg-accent" style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }} />
        </div>
        <input
          type="range"
          aria-label="Minimal narx"
          min={0}
          max={PRICE_MAX}
          step={PRICE_STEP}
          value={min}
          onChange={(e) => setLo(Number(e.target.value))}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
          aria-valuetext={min > 0 ? `${priceLabel(min)} so'mdan` : "Cheklanmagan"}
          className={cn("pointer-events-none absolute inset-x-0 top-1/2 h-7 w-full -translate-y-1/2 appearance-none bg-transparent", thumb, min > hiVal - PRICE_STEP * 4 && "z-20")}
        />
        <input
          type="range"
          aria-label="Maksimal narx"
          min={0}
          max={PRICE_MAX}
          step={PRICE_STEP}
          value={hiVal}
          onChange={(e) => setHi(Number(e.target.value))}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
          aria-valuetext={max > 0 ? `${priceLabel(max)} so'mgacha` : "Cheklanmagan"}
          className={cn("pointer-events-none absolute inset-x-0 top-1/2 z-10 h-7 w-full -translate-y-1/2 appearance-none bg-transparent", thumb)}
        />
      </div>

      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-fg-4" aria-hidden="true">
        <span>0</span>
        <span>{priceLabel(PRICE_MAX)}+</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {PRICE_PRESETS.map((p) => {
          const on = min === p.min && max === p.max;
          return (
            <Chip
              key={p.label}
              active={on}
              className="!h-8 !px-2.5 !text-[12px]"
              onClick={() => {
                onChange(on ? 0 : p.min, on ? 0 : p.max);
                onCommit();
              }}
            >
              {p.label}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Filtrlar formasi                                                    */
/* ------------------------------------------------------------------ */
export interface FiltersProps {
  categoryCounts: Record<string, number>;
  regionCounts: Record<string, number>;
  showHeader?: boolean;
  className?: string;
}

export function Filters({ categoryCounts, regionCounts, showHeader = true, className }: FiltersProps) {
  const { sp, setParams, reset, pending, activeCount } = useUrlFilters();

  const urlQ = sp.get("q") ?? "";
  const urlRange = normRange(`${sp.get("priceMin") ?? ""}|${sp.get("priceMax") ?? ""}`);
  const category = sp.get("category") ?? "";
  const region = sp.get("region") ?? "";
  const experience = sp.get("experience") ?? "";
  const gender = sp.get("gender") ?? "";
  const verified = sp.get("verified") === "1";
  const available = sp.get("available") === "1";

  const commitQ = useCallback((v: string) => setParams({ q: v || null }, { replace: true }), [setParams]);
  const commitRange = useCallback(
    (v: string) => {
      const { min, max } = decodeRange(v);
      setParams({ priceMin: min > 0 ? String(min) : null, priceMax: max > 0 ? String(max) : null }, { replace: true });
    },
    [setParams],
  );

  const q = useDebouncedParam(urlQ, commitQ, normQ);
  const range = useDebouncedParam(urlRange, commitRange, normRange, 500);
  const { min: priceMin, max: priceMax } = decodeRange(range.value);

  const totalAll = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  const catInfo = CATEGORIES.find((c) => c.slug === category);
  const regionInfo = REGIONS.find((r) => r.slug === region);
  const expInfo = EXPERIENCE_LEVELS.find((e) => e.value === experience);
  const genderInfo = GENDERS.find((g) => g.value === gender);

  const onReset = () => {
    q.resetLocal("");
    range.resetLocal("|");
    reset();
  };

  return (
    <div className={cn(className)}>
      {showHeader ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold text-fg">
            <SlidersHorizontal size={16} className="text-fg-3" />
            Filtrlar
            <ActiveBadge n={activeCount} />
            {pending && <Spinner className="h-3.5 w-3.5 text-fg-3" />}
          </h2>
          <Button variant="ghost" size="sm" className="!h-9 !px-3 text-[13px]" onClick={onReset} disabled={activeCount === 0}>
            Tozalash
          </Button>
        </div>
      ) : (
        <p className="mb-2 flex min-h-5 items-center gap-2 text-[12px] font-medium text-fg-3" aria-live="polite">
          {pending && (
            <>
              <Spinner className="h-3.5 w-3.5" /> Natijalar yangilanmoqda…
            </>
          )}
        </p>
      )}

      {/* Qidiruv — har doim ko'rinadi */}
      <div className="pb-4">
        <label htmlFor="sp-q" className="sr-only">
          Qidiruv
        </label>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" />
          <input
            id="sp-q"
            type="text"
            className="field !h-11 !pl-10 !pr-10"
            placeholder="Ism, ko'nikma yoki shahar…"
            value={q.value}
            onChange={(e) => q.setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && q.flush()}
            autoComplete="off"
            enterKeyHint="search"
            maxLength={80}
          />
          {q.value && (
            <button
              type="button"
              onClick={() => q.setValue("")}
              aria-label="Qidiruvni tozalash"
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/8 hover:text-fg"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Yo'nalish */}
      <Group title="Yo'nalish" summary={catInfo?.name} defaultOpen>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!category} onClick={() => setParams({ category: null })}>
            Barchasi <Count n={totalAll} active={!category} />
          </Chip>
          {CATEGORIES.map((c) => {
            const on = category === c.slug;
            return (
              <Chip key={c.slug} active={on} onClick={() => setParams({ category: on ? null : c.slug })}>
                <CategoryIcon icon={c.icon} size={13} className={on ? undefined : "text-fg-3"} />
                {c.name}
                <Count n={categoryCounts[c.slug] ?? 0} active={on} />
              </Chip>
            );
          })}
        </div>
      </Group>

      {/* Hudud */}
      <Group title="Hudud" summary={regionInfo?.short} defaultOpen>
        <label htmlFor="sp-region" className="sr-only">
          Hudud
        </label>
        <select id="sp-region" className="field !h-11" value={region} onChange={(e) => setParams({ region: e.target.value || null })}>
          <option value="">Barcha hududlar</option>
          {REGIONS.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name} ({regionCounts[r.slug] ?? 0})
            </option>
          ))}
        </select>
      </Group>

      {/* Narx */}
      <Group title="Narx" summary={priceMin || priceMax ? rangeText(priceMin, priceMax) : null}>
        <PriceRange min={priceMin} max={priceMax} onChange={(lo, hi) => range.setValue(encodeRange(lo, hi))} onCommit={range.flush} />
      </Group>

      {/* Tajriba */}
      <Group title="Tajriba" summary={expInfo ? expInfo.label.split(" (")[0] : null}>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!experience} onClick={() => setParams({ experience: null })}>
            Barchasi
          </Chip>
          {EXPERIENCE_LEVELS.map((e) => {
            const on = experience === e.value;
            const [name, years] = e.label.replace(")", "").split(" (");
            return (
              <Chip key={e.value} active={on} onClick={() => setParams({ experience: on ? null : e.value })}>
                {name}
                <span className={cn("text-[11px]", on ? "opacity-80" : "text-fg-4")}>{years}</span>
              </Chip>
            );
          })}
        </div>
      </Group>

      {/* Jins */}
      <Group title="Jins" summary={genderInfo?.label}>
        <div className="segment w-full" role="radiogroup" aria-label="Jins">
          {[{ value: "", label: "Barchasi" }, ...GENDERS].map((g) => {
            const on = gender === g.value;
            return (
              <button
                key={g.value || "all"}
                type="button"
                role="radio"
                aria-checked={on}
                data-active={on}
                onClick={() => setParams({ gender: g.value || null })}
                className="segment-item min-h-[38px] flex-1"
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </Group>

      {/* Boshqa */}
      <Group title="Boshqa" summary={[verified && "Tasdiqlangan", available && "Hozir bo'sh"].filter(Boolean).join(" · ") || null}>
        <div className="flex min-h-12 items-center justify-between gap-3 rounded-[var(--r-sm)] border border-line bg-surface-2 px-3.5 py-2.5 dark:bg-surface">
          <span className="flex min-w-0 items-center gap-2.5">
            <VerifiedBadge size={20} />
            <span className="min-w-0">
              <span id="sp-verified-label" className="block text-[14px] font-medium text-fg">
                Faqat tasdiqlanganlar
              </span>
              <span className="block text-[12px] text-fg-3">Tekshiruvdan o'tgan profillar</span>
            </span>
          </span>
          <Switch checked={verified} onChange={(v) => setParams({ verified: v ? "1" : null })} label="Faqat tasdiqlangan mutaxassislar" />
        </div>
        {/* Mavjudlik (B32): "Band" va ta'tildagilar chiqmaydi */}
        <div className="mt-2 flex min-h-12 items-center justify-between gap-3 rounded-[var(--r-sm)] border border-line bg-surface-2 px-3.5 py-2.5 dark:bg-surface">
          <span className="flex min-w-0 items-center gap-2.5">
            <CheckCircle2 size={20} className="shrink-0 text-success" />
            <span className="min-w-0">
              <span className="block text-[14px] font-medium text-fg">Faqat hozir bo'shlar</span>
              <span className="block text-[12px] text-fg-3">Band va ta'tildagilar chiqmaydi</span>
            </span>
          </span>
          <Switch checked={available} onChange={(v) => setParams({ available: v ? "1" : null })} label="Faqat hozir buyurtma qabul qiladiganlar" />
        </div>
      </Group>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Saralash                                                            */
/* ------------------------------------------------------------------ */
export function SortSelect({ className }: { className?: string }) {
  const { sp, setParams } = useUrlFilters();
  const value = sp.get("sort") ?? "rating";
  return (
    <div className={cn("relative", className)}>
      <ArrowUpDown size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" />
      <select
        aria-label="Saralash"
        className="field !h-11 !rounded-full !py-0 !pl-10 text-[14px] font-medium"
        value={value}
        onChange={(e) => setParams({ sort: e.target.value === "rating" ? null : e.target.value })}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ko'rinish: to'r / ro'yxat                                           */
/* ------------------------------------------------------------------ */
export function ViewToggle({ className }: { className?: string }) {
  const { sp, setParams } = useUrlFilters();
  const view = sp.get("view") === "list" ? "list" : "grid";
  const opts = [
    { value: "grid", label: "To'r", icon: LayoutGrid },
    { value: "list", label: "Ro'yxat", icon: Rows3 },
  ] as const;
  return (
    <div className={cn("segment", className)} role="radiogroup" aria-label="Ko'rinish">
      {opts.map((o) => {
        const on = view === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.label}
            title={o.label}
            data-active={on}
            onClick={() => setParams({ view: o.value === "grid" ? null : o.value }, { keepPage: true, replace: true })}
            className="segment-item !flex h-[34px] w-10 items-center justify-center !px-0"
          >
            <o.icon size={16} />
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mobil: "Filtrlar" tugmasi + pastdan chiqadigan varaq                 */
/* ------------------------------------------------------------------ */
export function MobileFilters({
  categoryCounts,
  regionCounts,
  total,
  className,
}: {
  categoryCounts: Record<string, number>;
  regionCounts: Record<string, number>;
  total: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const { reset, activeCount } = useUrlFilters();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fokus varaq ichida qoladi, yopilganda "Filtrlar" tugmasiga qaytadi
  useFocusTrap(sheetRef, mounted && open);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <Button variant="outline" size="md" className={cn("!h-11 px-4", className)} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
        <SlidersHorizontal size={15} className="text-fg-3" />
        Filtrlar
        <ActiveBadge n={activeCount} />
      </Button>

      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-labelledby="sp-filters-title">
            <button type="button" aria-label="Yopish" onClick={close} className="absolute inset-0 bg-black/45" />
            <div
              ref={sheetRef}
              className="card-elevated absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col !rounded-b-none !rounded-t-[28px] animate-fade-up"
              style={{ animationDuration: "0.35s" }}
            >
              <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-fg/15" />
              <div className="flex shrink-0 items-center justify-between px-5 pb-1 pt-3">
                <h2 id="sp-filters-title" className="flex items-center gap-2 font-display text-[18px] font-semibold text-fg">
                  Filtrlar
                  <ActiveBadge n={activeCount} />
                </h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Yopish"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-fg-2 transition hover:bg-fg/6 hover:text-fg"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-1">
                <Filters categoryCounts={categoryCounts} regionCounts={regionCounts} showHeader={false} />
              </div>
              <div
                className="flex shrink-0 items-center gap-2 border-t border-line px-5 pt-3"
                style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
              >
                <Button variant="outline" onClick={reset} disabled={activeCount === 0}>
                  Tozalash
                </Button>
                <Button className="flex-1" onClick={close}>
                  {total} ta natijani ko'rish
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowUpDown, Search, SlidersHorizontal, X } from "lucide-react";
import { Button, Spinner, VerifiedBadge } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { CATEGORIES, EXPERIENCE_LEVELS, REGIONS } from "@/lib/constants";
import { cn, formatPrice } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Konstantalar                                                        */
/* ------------------------------------------------------------------ */
export const PRICE_MAX = 20_000_000;
export const PRICE_STEP = 100_000;

/** URL'dagi "filtr" kalitlari (sort/limit/page bunga kirmaydi) */
export const FILTER_KEYS = ["q", "category", "region", "priceMax", "experience", "verified"] as const;

export const SORT_OPTIONS = [
  { value: "rating", label: "Reyting bo'yicha" },
  { value: "popular", label: "Mashhurlik bo'yicha" },
  { value: "newest", label: "Eng yangilari" },
  { value: "price_asc", label: "Narx: arzondan" },
  { value: "price_desc", label: "Narx: qimmatdan" },
] as const;

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

  /** Bir nechta parametrni o'zgartiradi; har safar page=1 ga qaytadi */
  const setParams = useCallback(
    (patch: Record<string, string | null | undefined>, opts: { replace?: boolean } = {}) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      next.delete("page");
      navigate(next, !!opts.replace);
    },
    [sp, navigate],
  );

  /** Barcha filtrlarni tozalaydi (saralash saqlanadi) */
  const reset = useCallback(() => {
    const next = new URLSearchParams(sp.toString());
    for (const k of FILTER_KEYS) next.delete(k);
    next.delete("page");
    navigate(next, false);
  }, [sp, navigate]);

  const activeCount = FILTER_KEYS.filter((k) => {
    const v = sp.get(k);
    return !!v && v !== "0";
  }).length;

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
const normPrice = (v: string) => {
  const n = Number(v);
  return n > 0 && n < PRICE_MAX ? String(n) : "";
};

/* ------------------------------------------------------------------ */
/* Kichik UI bo'laklari                                                */
/* ------------------------------------------------------------------ */
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition active:scale-[0.97]",
        active ? "btn-ink" : "bg-fg/5 text-fg-2 hover:bg-fg/9 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function Count({ n, active }: { n: number; active: boolean }) {
  return <span className={cn("text-[11px] tabular-nums", active ? "opacity-80" : "text-fg-4")}>{n}</span>;
}

/** Studio switch: 44×26 pill, yoqilganda "siyoh" rangda (globals.css → .switch) */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="switch" />;
}

function ActiveBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className="glass-tint inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold">{n}</span>;
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
  const urlPrice = normPrice(sp.get("priceMax") ?? "");
  const category = sp.get("category") ?? "";
  const region = sp.get("region") ?? "";
  const experience = sp.get("experience") ?? "";
  const verified = sp.get("verified") === "1";

  const commitQ = useCallback((v: string) => setParams({ q: v || null }, { replace: true }), [setParams]);
  const commitPrice = useCallback((v: string) => setParams({ priceMax: v || null }, { replace: true }), [setParams]);

  const q = useDebouncedParam(urlQ, commitQ, normQ);
  const price = useDebouncedParam(urlPrice, commitPrice, normPrice);

  const priceNum = Number(price.value) || 0;
  const sliderValue = priceNum > 0 ? priceNum : PRICE_MAX;
  const pct = Math.round((sliderValue / PRICE_MAX) * 100);
  const totalAll = Object.values(categoryCounts).reduce((a, b) => a + b, 0);

  const onReset = () => {
    q.resetLocal("");
    price.resetLocal("");
    reset();
  };

  return (
    <div className={cn("space-y-4", className)}>
      {showHeader ? (
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold text-fg">
            <SlidersHorizontal size={17} className="text-tint" />
            Filtrlar
            <ActiveBadge n={activeCount} />
            {pending && <Spinner className="h-3.5 w-3.5 text-fg-3" />}
          </h2>
          <Button variant="tint-soft" size="sm" className="!h-8 !px-3" onClick={onReset} disabled={activeCount === 0}>
            Tozalash
          </Button>
        </div>
      ) : (
        pending && (
          <p className="flex items-center gap-2 text-[12px] font-medium text-fg-3">
            <Spinner className="h-3.5 w-3.5" /> Natijalar yangilanmoqda…
          </p>
        )
      )}

      {/* Qidiruv */}
      <div>
        <label htmlFor="sp-q" className="field-label">
          Qidiruv
        </label>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" />
          <input
            id="sp-q"
            type="text"
            className="field !pl-10 !pr-10"
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
              className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-fg/10 text-fg-2 transition hover:bg-fg/15"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Yo'nalish */}
      <div>
        <p className="field-label">Yo'nalish</p>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!category} onClick={() => setParams({ category: null })}>
            Barchasi <Count n={totalAll} active={!category} />
          </Chip>
          {CATEGORIES.map((c) => {
            const on = category === c.slug;
            return (
              <Chip key={c.slug} active={on} onClick={() => setParams({ category: on ? null : c.slug })}>
                <CategoryIcon icon={c.icon} size={13} style={on ? undefined : { color: c.accent }} />
                {c.name}
                <Count n={categoryCounts[c.slug] ?? 0} active={on} />
              </Chip>
            );
          })}
        </div>
      </div>

      {/* Hudud */}
      <div>
        <label htmlFor="sp-region" className="field-label">
          Hudud
        </label>
        <select id="sp-region" className="field" value={region} onChange={(e) => setParams({ region: e.target.value || null })}>
          <option value="">Barcha hududlar</option>
          {REGIONS.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name} ({regionCounts[r.slug] ?? 0})
            </option>
          ))}
        </select>
      </div>

      {/* Narx */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="sp-price" className="field-label !mb-0">
            Narx
          </label>
          <span className="whitespace-nowrap text-[13px] font-semibold text-tint tabular-nums">
            {priceNum > 0 ? `${formatPrice(priceNum, { compact: true })} gacha` : "Cheklanmagan"}
          </span>
        </div>
        <input
          id="sp-price"
          type="range"
          min={0}
          max={PRICE_MAX}
          step={PRICE_STEP}
          value={sliderValue}
          onChange={(e) => price.setValue(e.target.value)}
          onPointerUp={price.flush}
          onKeyUp={price.flush}
          aria-valuetext={priceNum > 0 ? `${formatPrice(priceNum, { compact: true })} gacha` : "Cheklanmagan"}
          style={{ backgroundImage: `linear-gradient(to right, var(--accent) ${pct}%, transparent ${pct}%)` }}
          className={cn(
            "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-fg/10",
            "[&::-webkit-slider-thumb]:h-[26px] [&::-webkit-slider-thumb]:w-[26px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.28),0_0_0_0.5px_rgba(0,0,0,0.08)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:active:scale-110",
            "[&::-moz-range-thumb]:h-[26px] [&::-moz-range-thumb]:w-[26px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.28)]",
          )}
        />
      </div>

      {/* Tajriba */}
      <div>
        <label htmlFor="sp-exp" className="field-label">
          Tajriba
        </label>
        <select id="sp-exp" className="field" value={experience} onChange={(e) => setParams({ experience: e.target.value || null })}>
          <option value="">Barcha darajalar</option>
          {EXPERIENCE_LEVELS.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tasdiqlangan */}
      <div className="glass-weak flex items-center justify-between gap-3 !rounded-[18px] px-3.5 py-2.5 !shadow-none">
        <span className="flex items-center gap-2.5">
          <VerifiedBadge size={20} />
          <span>
            <span className="block text-[14px] font-medium text-fg">Tasdiqlanganlar</span>
            <span className="block text-[12px] text-fg-3">Tekshiruvdan o'tgan profillar</span>
          </span>
        </span>
        <Switch checked={verified} onChange={(v) => setParams({ verified: v ? "1" : null })} label="Faqat tasdiqlangan mutaxassislar" />
      </div>
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
        className="field !h-10 !rounded-full !py-0 !pl-10 text-[14px] font-medium"
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
/* Mobil: "Filtrlar" tugmasi + pastdan chiqadigan shisha varaq          */
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
      <Button variant="glass" size="sm" className={cn("!h-10 px-4", className)} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
        <SlidersHorizontal size={15} className="text-tint" />
        Filtrlar
        <ActiveBadge n={activeCount} />
      </Button>

      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-labelledby="sp-filters-title">
            <button type="button" aria-label="Yopish" onClick={close} className="absolute inset-0 bg-black/40" />
            <div
              ref={sheetRef}
              className="card-elevated absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col !rounded-b-none !rounded-t-[28px] animate-fade-up"
              style={{ animationDuration: "0.35s" }}
            >
              <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-fg/15" />
              <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-3">
                <h2 id="sp-filters-title" className="flex items-center gap-2 text-[17px] font-semibold text-fg">
                  <SlidersHorizontal size={17} className="text-tint" />
                  Filtrlar
                  <ActiveBadge n={activeCount} />
                </h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Yopish"
                  className="glass glass-pill flex h-9 w-9 items-center justify-center text-fg-2 transition hover:text-fg"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-1">
                <Filters categoryCounts={categoryCounts} regionCounts={regionCounts} showHeader={false} />
              </div>
              <div
                className="flex shrink-0 items-center gap-2 border-t border-hairline px-5 pt-3"
                style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
              >
                <Button variant="tint-soft" onClick={reset} disabled={activeCount === 0}>
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

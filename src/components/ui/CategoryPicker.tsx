"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, Search, X } from "lucide-react";
import { CATEGORIES, CATEGORIES_BY_GROUP, CATEGORY_BY_SLUG, CATEGORY_GROUPS, CATEGORY_GROUP_BY_SLUG, type Category, type CategoryGroupSlug } from "@/lib/categories";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/utils";

/** Qidiruv uchun: kichik harf, apostroflar olib tashlanadi (o' / oʻ / o‘ → o) */
const norm = (s: string) => s.toLowerCase().replace(/[ʼ'’‘ʻ`´]/g, "").trim();

/**
 * Upwork uslubidagi kasb tanlagich: chapda GURUHLAR (Video, Dizayn, Dasturlash …), o'ngda tanlangan guruh kasblari;
 * qidiruv yozilsa — barcha kasblar bo'yicha. Telefonda guruhlar gorizontal chiplar. `counts` berilsa (katalog) —
 * sonlar ko'rsatiladi va `hideEmpty` bo'lsa mutaxassisi yo'q kasblar yashiriladi.
 */
export function CategoryPicker({
  value,
  onChange,
  counts,
  hideEmpty = false,
  className,
  autoFocus = false,
  stacked = false,
  labels,
}: {
  value: string | null;
  onChange: (slug: string) => void;
  counts?: Record<string, number>;
  hideEmpty?: boolean;
  className?: string;
  autoFocus?: boolean;
  /** Tor konteyner (masalan, auth kartasi): guruhlar tepada gorizontal chiplar, kasblar bitta ustunda */
  stacked?: boolean;
  labels?: { search?: string; empty?: string };
}) {
  const [q, setQ] = useState("");
  const selected = value ? CATEGORY_BY_SLUG[value] : undefined;
  const visible = (c: Category) => !hideEmpty || !counts || (counts[c.slug] ?? 0) > 0 || c.slug === value;
  const groups = useMemo(() => CATEGORIES_BY_GROUP.map(({ group, items }) => ({ group, items: items.filter(visible) })).filter((g) => g.items.length > 0), [counts, hideEmpty, value]); // eslint-disable-line react-hooks/exhaustive-deps
  const [active, setActive] = useState<CategoryGroupSlug>(() => selected?.group ?? groups[0]?.group.slug ?? "video");
  const activeGroup = groups.find((g) => g.group.slug === active) ?? groups[0];
  const sumOf = (items: Category[]) => (counts ? items.reduce((a, c) => a + (counts[c.slug] ?? 0), 0) : 0);

  const nq = norm(q);
  const results = nq ? CATEGORIES.filter((c) => visible(c) && norm(`${c.name} ${c.plural} ${c.description} ${CATEGORY_GROUP_BY_SLUG[c.group].name}`).includes(nq)) : null;

  const item = (c: Category, i: number) => {
    const on = value === c.slug;
    const n = counts?.[c.slug];
    return (
      <button
        key={c.slug}
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => onChange(c.slug)}
        style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}
        className={cn(
          "press animate-fade-up flex w-full items-center gap-3 rounded-[14px] border p-2.5 text-left transition",
          on ? "border-accent/60 bg-accent-soft ring-1 ring-accent/40" : "border-line bg-surface hover:border-line-2 hover:bg-fg/4",
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-white" style={{ background: `linear-gradient(145deg, ${c.accent}, ${c.accent}b0)` }}>
          <CategoryIcon icon={c.icon} size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-fg">{c.name}</span>
          <span className="block truncate text-[11.5px] text-fg-3">{c.description}</span>
        </span>
        {n != null ? <span className="shrink-0 text-[12px] font-semibold tabular-nums text-fg-3">{n}</span> : null}
        {on && <Check size={16} className="shrink-0 text-accent" aria-hidden="true" />}
      </button>
    );
  };

  return (
    <div className={cn("min-w-0", className)}>
      <label className="relative mb-3 block">
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus={autoFocus}
          placeholder={labels?.search ?? "Kasbni qidiring: montaj, SMM, dasturchi…"}
          aria-label={labels?.search ?? "Kasbni qidirish"}
          className="field h-11 w-full pl-10 pr-10 text-[14px]"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Tozalash" className="press absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-fg-3 hover:bg-fg/6 hover:text-fg">
            <X size={14} />
          </button>
        )}
      </label>

      {results ? (
        results.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-line px-4 py-8 text-center text-[13px] text-fg-3">{labels?.empty ?? "Bunday kasb topilmadi — boshqa so'z bilan urinib ko'ring"}</p>
        ) : (
          <div role="radiogroup" aria-label="Kasblar" className={cn("grid gap-2", !stacked && "sm:grid-cols-2")}>
            {results.map((c, i) => item(c, i))}
          </div>
        )
      ) : (
        <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-3", !stacked && "md:grid-cols-[210px_minmax(0,1fr)]")}>
          <div className={cn("no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1", !stacked && "md:mx-0 md:flex-col md:gap-0.5 md:overflow-visible md:px-0")} role="tablist" aria-label="Kasb guruhlari">
            {groups.map(({ group, items }) => {
              const on = activeGroup?.group.slug === group.slug;
              const n = sumOf(items);
              return (
                <button
                  key={group.slug}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActive(group.slug)}
                  className={cn(
                    "press flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-left text-[13px] font-semibold transition",
                    !stacked && "md:w-full md:rounded-[12px]",
                    on ? "bg-fg text-bg" : cn("bg-fg/5 text-fg-2 hover:bg-fg/9 hover:text-fg", !stacked && "md:bg-transparent"),
                  )}
                >
                  <CategoryIcon icon={group.icon} size={15} className={on ? undefined : "text-fg-3"} />
                  <span className={cn("whitespace-nowrap", !stacked && "md:flex-1 md:whitespace-normal")}>{group.name}</span>
                  {counts ? <span className={cn("text-[11.5px] tabular-nums", on ? "opacity-70" : "text-fg-4")}>{n}</span> : null}
                  {!stacked && <ChevronRight size={14} className={cn("hidden shrink-0 md:block", on ? "opacity-70" : "text-fg-4")} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <div key={activeGroup?.group.slug} role="radiogroup" aria-label={activeGroup?.group.name} className={cn("grid content-start gap-2", !stacked && "sm:grid-cols-2")}>
            {activeGroup?.items.map((c, i) => item(c, i))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Kasb maydoni: tanlangan kasb kartasi + «O'zgartirish» — bosilganda CategoryPicker varag'i ochiladi (Sheet).
 * Filtr va profil formalari uchun (joyni tejaydi). `onClear` berilsa — «Barcha kasblar» tugmasi chiqadi.
 */
export function CategoryField({
  value,
  onChange,
  onClear,
  counts,
  hideEmpty,
  title = "Kasbni tanlang",
  placeholder = "Kasbni tanlang",
  className,
  labels,
}: {
  value: string | null;
  onChange: (slug: string) => void;
  onClear?: () => void;
  counts?: Record<string, number>;
  hideEmpty?: boolean;
  title?: string;
  placeholder?: string;
  className?: string;
  /** Tilga moslash: «Tanlash» / «O'zgartirish» tugma yozuvi va tanlanmagandagi izoh (standart — o'zbekcha) */
  labels?: { choose?: string; change?: string; hint?: string };
}) {
  const [open, setOpen] = useState(false);
  const c = value ? CATEGORY_BY_SLUG[value] : undefined;
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="press card card-hover flex w-full items-center gap-3 !rounded-[16px] p-3 text-left"
      >
        {c ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-white" style={{ background: `linear-gradient(145deg, ${c.accent}, ${c.accent}b0)` }}>
            <CategoryIcon icon={c.icon} size={19} />
          </span>
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-fg/6 text-fg-3">
            <Search size={18} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-fg">{c ? c.name : placeholder}</span>
          <span className="block truncate text-[12px] text-fg-3">{c ? CATEGORY_GROUP_BY_SLUG[c.group].name : (labels?.hint ?? `${CATEGORIES.length} ta kasb · ${CATEGORY_GROUPS.length} ta guruh`)}</span>
        </span>
        <span className="shrink-0 rounded-full bg-fg/6 px-3 py-1.5 text-[12px] font-semibold text-fg-2">{c ? (labels?.change ?? "O'zgartirish") : (labels?.choose ?? "Tanlash")}</span>
      </button>
      {onClear && c && (
        <button type="button" onClick={onClear} className="mt-1.5 text-[12px] font-semibold text-fg-3 underline-offset-2 hover:text-fg hover:underline">
          Barcha kasblar
        </button>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={title} size="lg">
        <CategoryPicker
          value={value}
          counts={counts}
          hideEmpty={hideEmpty}
          autoFocus
          onChange={(slug) => {
            onChange(slug);
            setOpen(false);
          }}
        />
      </Sheet>
    </div>
  );
}

/** Faqat varaq: tashqi tugma (masalan, filtrdagi «Barcha kasblar») ochib-yopadi */
export function CategorySheet({
  open,
  onClose,
  value,
  onChange,
  counts,
  hideEmpty,
  title = "Kasbni tanlang",
}: {
  open: boolean;
  onClose: () => void;
  value: string | null;
  onChange: (slug: string) => void;
  counts?: Record<string, number>;
  hideEmpty?: boolean;
  title?: string;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} size="lg">
      <CategoryPicker
        value={value}
        counts={counts}
        hideEmpty={hideEmpty}
        autoFocus
        onChange={(slug) => {
          onChange(slug);
          onClose();
        }}
      />
    </Sheet>
  );
}

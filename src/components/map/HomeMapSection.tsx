"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, MapPin, Search, Users, X } from "lucide-react";
import { UzbekistanMap } from "./UzbekistanMap";
import { Avatar, Stars, VerifiedBadge } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CATEGORIES, CATEGORY_BY_SLUG, REGIONS, REGION_BY_SLUG } from "@/lib/constants";
import type { RegionStat, SpecialistListItem } from "@/lib/queries";
import { cn, formatPriceRange } from "@/lib/utils";

/**
 * Bosh sahifadagi interaktiv xarita:
 * - yuqorida kasb (kategoriya) pill'lari → xarita shu kasb bo'yicha qayta bo'yaladi
 * - viloyat bosilganda yon panelda o'sha hududdagi (va tanlangan kasbdagi) mutaxassislar ro'yxati chiqadi
 * - yon panel bo'sh turmaydi: eng faol hududlar + yo'nalishlar bo'yicha taqsimot (bar'lar)
 */

const LIMIT = 6;
type ApiResult = { items: SpecialistListItem[]; total: number };

export function HomeMapSection({ stats, total }: { stats: Record<string, RegionStat>; total: number }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [data, setData] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const cache = useRef(new Map<string, ApiResult>());
  const listRef = useRef<HTMLDivElement>(null);

  const region = selected ? REGION_BY_SLUG[selected] : null;
  const cat = category ? CATEGORY_BY_SLUG[category] : null;

  /* Tanlangan kasb bo'yicha hududlar soni (xaritani bo'yash uchun) */
  const counts = useMemo(
    () => Object.fromEntries(REGIONS.map((r) => [r.slug, category ? (stats[r.slug]?.byCategory[category] ?? 0) : (stats[r.slug]?.total ?? 0)])),
    [stats, category],
  );
  const scopeTotal = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);
  const countFor = (slugCat: string | null) => {
    if (selected) return slugCat ? (stats[selected]?.byCategory[slugCat] ?? 0) : (stats[selected]?.total ?? 0);
    return slugCat ? REGIONS.reduce((a, r) => a + (stats[r.slug]?.byCategory[slugCat] ?? 0), 0) : total;
  };

  const topRegions = useMemo(
    () => [...REGIONS].sort((a, b) => (counts[b.slug] ?? 0) - (counts[a.slug] ?? 0)).slice(0, 5),
    [counts],
  );

  /* Butun O'zbekiston bo'yicha yo'nalishlar taqsimoti (yon panel bo'sh holati uchun) */
  const catTotals = useMemo(
    () =>
      CATEGORIES.map((c) => ({ c, n: REGIONS.reduce((a, r) => a + (stats[r.slug]?.byCategory[c.slug] ?? 0), 0) }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 5),
    [stats],
  );
  const catMax = Math.max(1, ...catTotals.map((x) => x.n));

  /* Ro'yxatni yuklash (hudud yoki kasb tanlanganda) */
  useEffect(() => {
    if (!selected && !category) {
      setData(null);
      return;
    }
    const key = `${selected ?? ""}|${category ?? ""}`;
    const hit = cache.current.get(key);
    if (hit) {
      setData(hit);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ limit: String(LIMIT), sort: "rating" });
    if (selected) params.set("region", selected);
    if (category) params.set("category", category);
    fetch(`/api/specialists?${params}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok) {
          const res: ApiResult = { items: json.data.items, total: json.data.total };
          cache.current.set(key, res);
          setData(res);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [selected, category]);

  /* Mobilda hudud tanlanganda ro'yxatga sirpanish */
  const pickRegion = (slug: string | null) => {
    setSelected(slug);
    if (slug && window.innerWidth < 1024) {
      setTimeout(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  };

  const listHref = `/mutaxassislar?${new URLSearchParams({ ...(selected ? { region: selected } : {}), ...(category ? { category } : {}) })}`;
  const unit = cat ? cat.name.toLowerCase() : "mutaxassis";

  return (
    <div className="grid gap-5 lg:grid-cols-12 lg:items-stretch">
      {/* ---------------- Xarita paneli ---------------- */}
      <div className="card flex min-w-0 flex-col p-3 sm:p-5 lg:col-span-8">
        <div className="mb-2 flex flex-col gap-3 px-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-fg-2">
              <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-70 animate-pulse-ring" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
              </span>
              {cat ? (
                <>
                  <span className="font-display text-fg">{scopeTotal}</span> ta {cat.name.toLowerCase()} · 14 hudud
                </>
              ) : (
                <>
                  <span className="font-display text-fg">{total}</span> ta mutaxassis · 14 hudud
                </>
              )}
            </div>
            <span className="hidden text-[12px] text-fg-3 sm:block">Hududni bosing — ro'yxat o'ngda ochiladi</span>
          </div>

          {/* Kasb pill'lari (aylanadigan qator, o'ng chetda so'nish) */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar scroll-fade" role="group" aria-label="Yo'nalish tanlash">
            <CatPill active={!category} onClick={() => setCategory(null)} icon={<Users size={13} />} label="Barchasi" count={countFor(null)} />
            {CATEGORIES.map((c) => (
              <CatPill
                key={c.slug}
                active={category === c.slug}
                onClick={() => setCategory(category === c.slug ? null : c.slug)}
                icon={<CategoryIcon icon={c.icon} size={13} style={{ color: category === c.slug ? undefined : c.accent }} />}
                label={c.name}
                count={countFor(c.slug)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-1 items-center">
          <UzbekistanMap stats={stats} counts={counts} selected={selected} onSelect={pickRegion} unitLabel={unit} className="w-full" />
        </div>

        {/* Legenda — xarita kartasiga biriktirilgan */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-1 pt-3 text-[11.5px] font-medium text-fg-3">
          <div className="flex items-center gap-2">
            <span>kam</span>
            <span className="h-2 w-24 rounded-full" style={{ background: "linear-gradient(90deg, color-mix(in srgb, var(--accent) 8%, var(--map-fill-0)), var(--accent))" }} aria-hidden="true" />
            <span>ko'p</span>
            <span className="ml-1 text-fg-4">— {unit}lar soni</span>
          </div>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" aria-hidden="true" /> marker — hudud markazi
          </span>
        </div>
      </div>

      {/* ---------------- Yon panel ---------------- */}
      <div ref={listRef} className="flex min-w-0 scroll-mt-28 flex-col gap-4 lg:col-span-4">
        <div className={cn("card-elevated flex flex-1 flex-col p-5 transition-[box-shadow] duration-500", selected && "ring-2 ring-accent/40")}>
          {/* Sarlavha */}
          {region ? (
            <div className="flex items-start justify-between gap-3 animate-fade-up" key={region.slug} style={{ animationDuration: "0.3s" }}>
              <div className="flex items-start gap-3">
                <span className="icon-tile">
                  <MapPin size={20} />
                </span>
                <div>
                  <h3 className="font-display text-[19px] font-semibold leading-tight text-fg">{region.name}</h3>
                  <p className="mt-0.5 text-[13px] text-fg-3">
                    <span className="font-display font-semibold text-accent">{countFor(category)}</span> ta {unit} · {region.capital}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Tanlovni bekor qilish"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-fg-3 transition hover:border-fg hover:text-fg"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <span className="icon-tile">{cat ? <CategoryIcon icon={cat.icon} size={20} /> : <Users size={20} />}</span>
              <div>
                <h3 className="font-display text-[19px] font-semibold leading-tight text-fg">{cat ? `${cat.plural} — butun O'zbekiston` : "Hududni tanlang"}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-fg-2">
                  {cat ? "Xaritada viloyatni bosing — shu kasbdagi mutaxassislar o'sha hudud bo'yicha filtrlanadi." : "Xaritadagi istalgan viloyatni bosing — o'sha yerdagi mutaxassislar chiqadi."}
                </p>
              </div>
            </div>
          )}

          <div className="my-4 h-px bg-line" />

          {/* Tana: ro'yxat yoki top hududlar + taqsimot */}
          {selected || category ? (
            <div className="flex flex-1 flex-col">
              {loading && !data ? (
                <ul className="space-y-2" aria-busy="true" aria-label="Yuklanmoqda">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <li key={i} className="flex items-center gap-3 rounded-card p-2">
                      <span className="h-11 w-11 shrink-0 rounded-full skeleton" />
                      <span className="flex-1 space-y-2">
                        <span className="block h-3.5 w-2/3 skeleton" />
                        <span className="block h-3 w-1/2 skeleton" />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : data && data.items.length > 0 ? (
                <ul className={cn("space-y-1 transition-opacity", loading && "opacity-60")}>
                  {data.items.map((sp) => (
                    <SpecialistRow key={sp.id} sp={sp} showRegion={!selected} />
                  ))}
                </ul>
              ) : (
                <div className="card-outline flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
                  <span className="icon-tile-soft mb-3 !rounded-full">
                    <Search size={20} />
                  </span>
                  <p className="font-display text-[15px] font-semibold text-fg">Hali topilmadi</p>
                  <p className="mt-1 text-[13px] text-fg-3">
                    {region ? `${region.short}da` : "Bu yo'nalishda"} hozircha {unit} yo'q.
                  </p>
                  <Link href="/auth/royxat?role=specialist" className="mt-4 inline-flex min-h-10 items-center text-[13px] font-semibold text-accent hover:underline">
                    Birinchi bo'ling →
                  </Link>
                </div>
              )}

              {data && data.total > 0 && (
                <Link href={listHref} className="btn-accent mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full text-[14px] font-semibold">
                  Barchasini ko'rish ({data.total}) <ArrowRight size={16} />
                </Link>
              )}

              {/* Hudud ichidagi yo'nalishlar taqsimoti */}
              {region && !category && stats[region.slug]?.total > 0 && (
                <div className="mt-auto pt-5">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Yo'nalishlar bo'yicha</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.filter((c) => stats[region.slug].byCategory[c.slug]).map((c) => (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => setCategory(c.slug)}
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px] font-medium text-fg-2 transition hover:border-fg hover:text-fg"
                      >
                        <CategoryIcon icon={c.icon} size={12} style={{ color: c.accent }} />
                        {c.name}
                        <span className="font-bold text-fg">{stats[region.slug].byCategory[c.slug]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Eng faol hududlar</p>
              <ul className="space-y-0.5">
                {topRegions.map((r, i) => (
                  <li key={r.slug}>
                    <button
                      type="button"
                      onClick={() => pickRegion(r.slug)}
                      className="flex min-h-11 w-full items-center gap-3 rounded-tile px-2 py-1.5 text-left transition hover:bg-fg/5"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-[12px] font-bold text-accent">{i + 1}</span>
                      <span className="flex-1 text-[14px] font-medium text-fg">{r.name}</span>
                      <span className="font-display text-[13px] font-semibold text-fg-2">{counts[r.slug] ?? 0}</span>
                    </button>
                  </li>
                ))}
              </ul>

              {/* Yo'nalishlar bo'yicha taqsimot — bar'lar, panel pastini to'ldiradi */}
              <div className="mt-auto pt-6">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Yo'nalishlar bo'yicha</p>
                <ul className="space-y-2.5">
                  {catTotals.map(({ c, n }) => (
                    <li key={c.slug}>
                      <button type="button" onClick={() => setCategory(c.slug)} className="group block w-full text-left" aria-label={`${c.plural}: ${n} ta`}>
                        <span className="flex items-center justify-between text-[12.5px]">
                          <span className="inline-flex items-center gap-1.5 font-medium text-fg-2 transition group-hover:text-fg">
                            <CategoryIcon icon={c.icon} size={12} style={{ color: c.accent }} />
                            {c.plural}
                          </span>
                          <span className="font-display font-semibold text-fg">{n}</span>
                        </span>
                        <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                          <span className="block h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${Math.max(4, (n / catMax) * 100)}%`, opacity: 0.55 + (n / catMax) * 0.45 }} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <Link href="/xarita" className="card card-hover flex min-h-14 items-center justify-between px-5 py-3.5">
          <span>
            <span className="block text-[15px] font-semibold text-fg">To'liq xarita rejimi</span>
            <span className="block text-[13px] text-fg-3">Filtrlar bilan batafsil qidiruv</span>
          </span>
          <ArrowRight size={18} className="text-accent" />
        </Link>
      </div>
    </div>
  );
}

function CatPill({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition",
        active ? "border-transparent bg-ink text-ink-fg shadow-[var(--shadow-1)]" : "border-line bg-surface text-fg-2 hover:border-line-2 hover:text-fg",
        count === 0 && !active && "opacity-50",
      )}
    >
      {icon}
      {label}
      <span className={cn("rounded-full px-1.5 py-px text-[10.5px] font-bold", active ? "bg-ink-fg/15 text-ink-fg" : "bg-fg/6 text-fg-2")}>{count}</span>
    </button>
  );
}

function SpecialistRow({ sp, showRegion }: { sp: SpecialistListItem; showRegion: boolean }) {
  const c = CATEGORY_BY_SLUG[sp.category];
  const r = REGION_BY_SLUG[sp.regionSlug];
  return (
    <li>
      <Link href={`/mutaxassislar/${sp.slug}`} className="group flex min-h-14 items-center gap-3 rounded-card p-2 transition hover:bg-fg/5">
        <Avatar name={sp.user.name} src={sp.user.avatarUrl} size={44} decorative />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            <span className="truncate text-[14px] font-semibold text-fg">{sp.user.name}</span>
            {sp.isVerified && <VerifiedBadge size={14} />}
          </span>
          <span className="block truncate text-[12px] text-fg-3">
            {c && <span style={{ color: c.accent }}>{c.name}</span>}
            {c && " · "}
            {sp.city}
            {showRegion && r && r.slug !== "toshkent-shahri" ? `, ${r.short}` : ""}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-[12px]">
            <Stars value={sp.rating} count={sp.reviewCount} size={11} />
            <span className="text-fg-4" aria-hidden="true">·</span>
            <span className="truncate font-semibold text-fg-2">{formatPriceRange(sp.priceFrom, sp.priceTo)}</span>
          </span>
        </span>
        <span className="hover-reveal flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-fg-3 transition">
          <ArrowUpRight size={14} />
        </span>
      </Link>
    </li>
  );
}

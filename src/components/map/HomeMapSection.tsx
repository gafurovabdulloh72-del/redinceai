"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, MapPin, Search, Users, X } from "lucide-react";
import { UzbekistanMap } from "./UzbekistanMap";
import { Avatar, Stars, VerifiedBadge } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ScrollRow } from "@/components/ui/ScrollRow";
import { CATEGORIES, CATEGORY_BY_SLUG, GENDERS, REGIONS, REGION_BY_SLUG } from "@/lib/constants";
import type { RegionStat, SpecialistListItem } from "@/lib/queries";
import { cn, formatPriceRange } from "@/lib/utils";

/**
 * Bosh sahifadagi interaktiv xarita:
 * - yuqorida kasb (kategoriya) pill'lari → xarita shu kasb bo'yicha qayta bo'yaladi
 * - viloyat bosilganda yon panelda o'sha hududdagi (va tanlangan kasbdagi) mutaxassislar ro'yxati chiqadi
 * - yon panel bo'sh turmaydi: eng faol hududlar + yo'nalishlar bo'yicha taqsimot (bar'lar)
 * - tanlov URL'da saqlanadi (?region=&category=&gender=#xarita) — /xarita kabi; serverga qayta so'rov yo'q
 *   (history.replaceState Next router bilan sinxron), shuning uchun yangilash/ulashishda holat yo'qolmaydi
 * - jins faqat ro'yxatni filtrlaydi; xarita ranglari (hudud statistikasi) umumiy qoladi
 */

const LIMIT = 6;
type ApiResult = { items: SpecialistListItem[]; total: number };
type Gender = (typeof GENDERS)[number]["value"];
/** Jins segmenti: "" — barchasi */
const GENDER_OPTIONS: ReadonlyArray<{ value: Gender | ""; label: string }> = [{ value: "", label: "Barchasi" }, ...GENDERS];

const validRegion = (v: string | null) => (v && REGION_BY_SLUG[v] ? v : null);
const validCategory = (v: string | null) => (v && CATEGORY_BY_SLUG[v] ? v : null);
const isGender = (v: string): v is Gender => GENDERS.some((g) => g.value === v);
const validGender = (v: string | null): Gender | null => (v && isGender(v) ? v : null);
function qsOf(region: string | null, category: string | null, gender: Gender | null) {
  const p = new URLSearchParams();
  if (region) p.set("region", region);
  if (category) p.set("category", category);
  if (gender) p.set("gender", gender);
  return p.toString();
}

export function HomeMapSection({ stats, total }: { stats: Record<string, RegionStat>; total: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<string | null>(() => validRegion(searchParams.get("region")));
  const [category, setCategory] = useState<string | null>(() => validCategory(searchParams.get("category")));
  const [gender, setGender] = useState<Gender | null>(() => validGender(searchParams.get("gender")));
  const [data, setData] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const cache = useRef(new Map<string, ApiResult>());
  const listRef = useRef<HTMLDivElement>(null);

  const region = selected ? REGION_BY_SLUG[selected] : null;
  const cat = category ? CATEGORY_BY_SLUG[category] : null;
  const genderInfo = gender ? GENDERS.find((g) => g.value === gender) : undefined;

  /** Biz yozgan oxirgi URL holati (o'z yangilanishimizni orqaga/oldinga navigatsiyadan ajratish uchun) */
  const wanted = useRef(qsOf(selected, category, gender));
  const apply = (r: string | null, c: string | null, g: Gender | null) => {
    setSelected(r);
    setCategory(c);
    setGender(g);
    const qs = qsOf(r, c, g);
    if (qs === wanted.current) return;
    wanted.current = qs;
    // Ulashilgan havola to'g'ridan-to'g'ri xarita bo'limiga tushsin (#xarita)
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}#xarita` : pathname);
  };

  // Tashqi navigatsiya (orqaga/oldinga, havola) → holatni URL'dan olamiz
  useEffect(() => {
    const r = validRegion(searchParams.get("region"));
    const c = validCategory(searchParams.get("category"));
    const g = validGender(searchParams.get("gender"));
    const qs = qsOf(r, c, g);
    if (qs === wanted.current) return;
    wanted.current = qs;
    setSelected(r);
    setCategory(c);
    setGender(g);
  }, [searchParams]);

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
        .slice(0, 4),
    [stats],
  );
  const catMax = Math.max(1, ...catTotals.map((x) => x.n));

  /* Ro'yxatni yuklash (hudud, kasb yoki jins tanlanganda) */
  const active = Boolean(selected || category || gender);
  useEffect(() => {
    if (!selected && !category && !gender) {
      setData(null);
      return;
    }
    const key = qsOf(selected, category, gender);
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
    if (gender) params.set("gender", gender);
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
  }, [selected, category, gender]);

  /* Mobilda hudud tanlanganda ro'yxatga sirpanish */
  const pickRegion = (slug: string | null) => {
    apply(slug, category, gender);
    if (slug && window.innerWidth < 1024) {
      setTimeout(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  };
  const pickCategory = (slug: string | null) => apply(selected, slug, gender);
  const pickGender = (g: Gender | null) => apply(selected, category, g);

  const qs = qsOf(selected, category, gender);
  const listHref = `/mutaxassislar${qs ? `?${qs}` : ""}`;
  const unit = cat ? cat.name.toLowerCase() : "mutaxassis";
  /* Jins tanlanganda hudud statistikasida son yo'q — ro'yxat javobidan olamiz */
  const headCount: string = gender ? (data ? String(data.total) : "…") : String(countFor(category));

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

          {/* Kasb pill'lari: aylanadigan qator — chetlarda so'nish + ko'rinadigan strelka-ishora (mobilda ham) */}
          <ScrollRow label="Yo'nalish tanlash" className="-mx-1" rowClassName="flex gap-1.5 px-1 pb-1">
            <CatPill active={!category} onClick={() => pickCategory(null)} icon={<Users size={16} />} label="Barchasi" count={countFor(null)} />
            {CATEGORIES.map((c) => (
              <CatPill
                key={c.slug}
                active={category === c.slug}
                onClick={() => pickCategory(category === c.slug ? null : c.slug)}
                icon={<CategoryIcon icon={c.icon} size={16} style={{ color: category === c.slug ? undefined : c.accent }} />}
                label={c.name}
                count={countFor(c.slug)}
              />
            ))}
          </ScrollRow>
        </div>

        <div className="flex flex-1 items-center">
          <UzbekistanMap stats={stats} counts={counts} selected={selected} onSelect={pickRegion} unitLabel={unit} className="w-full" />
        </div>

        {/* Legenda — xarita kartasiga biriktirilgan */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-1 pt-3 text-[11.5px] font-medium text-fg-3">
          <div className="flex items-center gap-2">
            <span>kam</span>
            <span className="map-legend-ramp h-2 w-24 rounded-full" aria-hidden="true" />
            <span>ko'p</span>
            <span className="ml-1 text-fg-4">— {unit}lar soni</span>
          </div>
          {/* To'liq rejimga havola — legenda qatorida (yon panel ustuni xarita balandligidan oshmasin) */}
          <Link href="/xarita" className="group inline-flex min-h-10 items-center gap-1.5 text-[12.5px] font-semibold text-fg-2 transition hover:text-fg">
            To'liq xarita rejimi — filtrlar, zoom <ArrowRight size={16} className="text-accent transition-transform group-hover:translate-x-0.5" />
          </Link>
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
                    <span className="font-display font-semibold text-accent-text tabular-nums">{headCount}</span> ta {genderInfo ? `${genderInfo.label.toLowerCase()} ` : ""}
                    {unit}
                    {genderInfo ? " ko'rsatilgan" : ""} · {region.capital}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => pickRegion(null)}
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
                <h3 className="font-display text-[19px] font-semibold leading-tight text-fg">
                  {cat ? `${cat.plural} — butun O'zbekiston` : genderInfo ? `${genderInfo.label} mutaxassislar — butun O'zbekiston` : "Hududni tanlang"}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-fg-2">
                  {cat || genderInfo
                    ? "Xaritada viloyatni bosing — ro'yxat o'sha hudud bo'yicha filtrlanadi."
                    : "Xaritadagi istalgan viloyatni bosing — o'sha yerdagi mutaxassislar chiqadi."}
                </p>
              </div>
            </div>
          )}

          {/* Jins — faqat ro'yxatni filtrlaydi (xarita ranglari umumiy) */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Jins</span>
            <div className="segment shrink-0" role="radiogroup" aria-label="Jins">
              {GENDER_OPTIONS.map((g) => {
                const on = (gender ?? "") === g.value;
                return (
                  <button
                    key={g.value || "all"}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    data-active={on}
                    onClick={() => pickGender(g.value ? g.value : null)}
                    className="segment-item min-h-[38px] !px-3 !py-1 text-[12px]"
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="my-4 h-px bg-line" />

          {/* Tana: ro'yxat yoki top hududlar + taqsimot */}
          {active ? (
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
                    {region ? `${region.short}da` : cat ? "Bu yo'nalishda" : "Bu filtr bo'yicha"} hozircha {genderInfo ? `${genderInfo.label.toLowerCase()} ` : ""}
                    {unit} yo'q.
                  </p>
                  <Link href="/auth/royxat?role=specialist" className="mt-4 inline-flex min-h-10 items-center text-[13px] font-semibold text-accent-text hover:underline">
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
                        onClick={() => pickCategory(c.slug)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px] font-medium text-fg-2 transition hover:border-fg hover:text-fg"
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
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-[12px] font-bold text-accent-text">{i + 1}</span>
                      <span className="flex-1 text-[14px] font-medium text-fg">{r.name}</span>
                      <span className="font-display text-[13px] font-semibold text-fg-2">{counts[r.slug] ?? 0}</span>
                    </button>
                  </li>
                ))}
              </ul>

              {/* Yo'nalishlar bo'yicha taqsimot — bar'lar, panel pastini to'ldiradi */}
              <div className="mt-auto pt-6">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Yo'nalishlar bo'yicha</p>
                <ul className="space-y-1">
                  {catTotals.map(({ c, n }) => (
                    <li key={c.slug}>
                      <button type="button" onClick={() => pickCategory(c.slug)} className="group block min-h-10 w-full py-1.5 text-left" aria-label={`${c.plural}: ${n} ta`}>
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
          <ArrowUpRight size={16} />
        </span>
      </Link>
    </li>
  );
}

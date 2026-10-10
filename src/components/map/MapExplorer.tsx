"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, BadgeCheck, MapPin, RotateCcw, SearchX, Sparkles, UserPlus, X } from "lucide-react";
import { UzbekistanMap } from "./UzbekistanMap";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Avatar, Badge, Button, ButtonLink, Stars } from "@/components/ui";
import { CATEGORIES, CATEGORY_BY_SLUG, REGIONS, REGION_BY_SLUG } from "@/lib/constants";
import type { RegionStat, SpecialistListItem } from "@/lib/queries";
import { cn, formatPriceRange } from "@/lib/utils";

/**
 * To'liq xarita rejimi: chapda interaktiv xarita (choropleth), o'ngda yo'nalish
 * filtri + tanlangan hudud bo'yicha mutaxassislar ro'yxati.
 * - Holat (hudud, yo'nalish) URL bilan sinxron: ?region=&category=
 * - Yo'nalish tanlansa xarita ranglari shu yo'nalish bo'yicha qayta hisoblanadi
 * - Ro'yxat GET /api/specialists orqali olinadi va kesh qilinadi
 */

const LIMIT = 12;

/** API JSON'da sanalar satr ko'rinishida keladi */
type MapItem = Omit<SpecialistListItem, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };

interface ListState {
  items: MapItem[];
  total: number;
}

type ApiResponse =
  | { ok: true; data: { items: MapItem[]; total: number; page: number; pages: number } }
  | { ok: false; error: string };

export interface MapExplorerProps {
  stats: Record<string, RegionStat>;
  categoryStats: Record<string, number>;
  initialRegion: string | null;
  initialCategory: string | null;
}

/* ------------------------------------------------------------------ */
/* Yordamchilar                                                        */
/* ------------------------------------------------------------------ */
function qsOf(region: string | null, category: string | null) {
  const p = new URLSearchParams();
  if (region) p.set("region", region);
  if (category) p.set("category", category);
  return p.toString();
}
/** Tooltip birligi: "Videograf" → "videograf", lekin "UI/UX dizayner" / "3D artist" o'zgarmaydi */
const unitOf = (name: string) => (/^[A-Z0-9]{2,}/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1));
const validRegion = (v: string | null) => (v && REGION_BY_SLUG[v] ? v : null);
const validCategory = (v: string | null) => (v && CATEGORY_BY_SLUG[v] ? v : null);

const MOBILE_MQ = "(max-width: 639px)";
function subscribeMobile(cb: () => void) {
  const mq = window.matchMedia(MOBILE_MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
/** sm dan kichik ekran — xaritadagi yorliqlarni yashirish uchun */
function useIsMobile() {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_MQ).matches,
    () => false,
  );
}

/* ------------------------------------------------------------------ */
/* Kichik UI bo'laklari                                                */
/* ------------------------------------------------------------------ */
function Chip({ active, onClick, children, size = "md" }: { active: boolean; onClick: () => void; children: ReactNode; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold transition active:scale-[0.97]",
        size === "md" ? "h-9 px-3.5 text-[13px]" : "h-8 px-3 text-[12px]",
        active ? "btn-ink border-transparent" : "border-line bg-surface text-fg-2 hover:border-line-2 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function Count({ n, active }: { n: number; active: boolean }) {
  return <span className={cn("text-[11px] tabular-nums", active ? "opacity-75" : "text-fg-4")}>{n}</span>;
}

function LiveDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-70 animate-pulse-ring" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
    </span>
  );
}

function RowSkeleton() {
  return (
    <li className="flex items-center gap-3.5 px-4 py-3.5 sm:px-5" aria-hidden="true">
      <span className="skeleton h-[46px] w-[46px] shrink-0 !rounded-full" />
      <span className="flex-1 space-y-2">
        <span className="skeleton block h-3.5 w-1/2" />
        <span className="skeleton block h-3 w-3/4" />
        <span className="skeleton block h-3 w-1/3" />
      </span>
      <span className="skeleton hidden h-4 w-24 sm:block" />
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Asosiy komponent                                                    */
/* ------------------------------------------------------------------ */
export function MapExplorer({ stats, categoryStats, initialRegion, initialCategory }: MapExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const isMobile = useIsMobile();

  const [region, setRegion] = useState<string | null>(initialRegion);
  const [category, setCategory] = useState<string | null>(initialCategory);

  /** Biz so'ragan oxirgi URL holati (o'z yangilanishimizni tashqi navigatsiyadan ajratish uchun) */
  const wanted = useRef(qsOf(initialRegion, initialCategory));

  const apply = (r: string | null, c: string | null) => {
    setRegion(r);
    setCategory(c);
    const qs = qsOf(r, c);
    if (qs === wanted.current) return;
    wanted.current = qs;
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  // Tashqi navigatsiya (orqaga/oldinga, menyudagi havola) → holatni URL'dan olamiz
  useEffect(() => {
    if (isPending) return;
    const r = validRegion(searchParams.get("region"));
    const c = validCategory(searchParams.get("category"));
    const qs = qsOf(r, c);
    if (qs === wanted.current) return;
    wanted.current = qs;
    setRegion(r);
    setCategory(c);
  }, [searchParams, isPending]);

  /* ---------- Hisoblar ---------- */
  const total = useMemo(() => REGIONS.reduce((a, r) => a + (stats[r.slug]?.total ?? 0), 0), [stats]);

  /** Yo'nalish tanlanganda xarita ranglari shu yo'nalish bo'yicha */
  const counts = useMemo(() => {
    if (!category) return undefined;
    return Object.fromEntries(REGIONS.map((r) => [r.slug, stats[r.slug]?.byCategory[category] ?? 0]));
  }, [category, stats]);

  const countFor = (slug: string) => (counts ? (counts[slug] ?? 0) : (stats[slug]?.total ?? 0));
  const scopeTotal = counts ? REGIONS.reduce((a, r) => a + (counts[r.slug] ?? 0), 0) : total;
  const categoryCount = (c: string) => (region ? (stats[region]?.byCategory[c] ?? 0) : (categoryStats[c] ?? 0));
  const regionTotalAll = region ? (stats[region]?.total ?? 0) : total;

  const regionsByCount = useMemo(
    () => [...REGIONS].sort((a, b) => countFor(b.slug) - countFor(a.slug)),
    [counts, stats], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /* ---------- Ro'yxat ---------- */
  const key = qsOf(region, category);
  const cache = useRef(new Map<string, ListState>());
  const [list, setList] = useState<ListState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const cached = cache.current.get(key);
    if (cached) {
      setList(cached);
      setLoading(false);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    const p = new URLSearchParams({ limit: String(LIMIT), sort: "rating" });
    if (region) p.set("region", region);
    if (category) p.set("category", category);

    fetch(`/api/specialists?${p.toString()}`, { signal: ctrl.signal })
      .then(async (res) => {
        const json = (await res.json()) as ApiResponse;
        if (!json.ok) throw new Error(json.error);
        const next: ListState = { items: json.data.items, total: json.data.total };
        cache.current.set(key, next);
        setList(next);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error && e.message ? e.message : "Ro'yxatni yuklab bo'lmadi");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [key, region, category, attempt]);

  const retry = () => {
    cache.current.delete(key);
    setAttempt((n) => n + 1);
  };

  const regionInfo = region ? REGION_BY_SLUG[region] : null;
  const cat = category ? CATEGORY_BY_SLUG[category] : null;
  const shown = list && !loading ? list.total : region ? countFor(region) : scopeTotal;
  const listHref = `/mutaxassislar${key ? `?${key}` : ""}`;

  return (
    // grid-cols-1 + min-w-0: gorizontal aylanadigan chip qatorlari ustunni kengaytirib yubormasligi uchun
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
      {/* ================= XARITA ================= */}
      <section className="min-w-0 lg:col-span-7" aria-label="Interaktiv xarita">
        <div className="card p-3 sm:p-5 lg:sticky lg:top-28">
          {/* Sarlavha qatori */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 sm:mb-3">
            <div className="flex items-center gap-2.5 text-[12px] font-semibold text-fg-2 sm:text-[13px]">
              <LiveDot />
              <span>
                {REGIONS.length} hudud · <span className="text-fg">{scopeTotal}</span> mutaxassis
                {cat && (
                  <>
                    {" "}
                    · <span className="text-accent">{cat.plural}</span>
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-fg-3">
              kam
              <span
                className="h-2 w-20 rounded-full sm:w-28"
                style={{ background: "linear-gradient(90deg, color-mix(in srgb, var(--accent) 8%, var(--map-base)), var(--accent))" }}
              />
              ko'p
            </div>
          </div>

          <UzbekistanMap
            variant="panel"
            stats={stats}
            counts={counts}
            selected={region}
            onSelect={(slug) => apply(slug, category)}
            unitLabel={cat ? unitOf(cat.name) : "mutaxassis"}
            showLabels={!isMobile}
            className="px-1 sm:px-2"
          />

          {/* Hudud chiplari (kichik hududlarni bosish oson bo'lishi uchun) */}
          <div className="-mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 pb-1 no-scrollbar sm:-mx-5 sm:px-5" role="group" aria-label="Hududlar">
            {regionsByCount.map((r) => {
              const on = region === r.slug;
              return (
                <Chip key={r.slug} size="sm" active={on} onClick={() => apply(on ? null : r.slug, category)}>
                  {r.short}
                  <Count n={countFor(r.slug)} active={on} />
                </Chip>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= PANEL ================= */}
      <aside className="flex min-w-0 flex-col gap-4 lg:col-span-5" aria-label="Natijalar paneli">
        {/* Yo'nalish filtri */}
        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">Yo'nalish</p>
            {isPending && <span className="text-[11px] font-medium text-fg-4">Yangilanmoqda…</span>}
          </div>
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="group" aria-label="Yo'nalishlar">
            <Chip active={!category} onClick={() => apply(region, null)}>
              Barchasi <Count n={regionTotalAll} active={!category} />
            </Chip>
            {CATEGORIES.map((c) => {
              const on = category === c.slug;
              return (
                <Chip key={c.slug} active={on} onClick={() => apply(region, on ? null : c.slug)}>
                  <CategoryIcon icon={c.icon} size={14} style={on ? undefined : { color: c.accent }} />
                  {c.name}
                  <Count n={categoryCount(c.slug)} active={on} />
                </Chip>
              );
            })}
          </div>
        </div>

        {/* Natijalar */}
        <div className={cn("card overflow-hidden transition-shadow duration-500", region && "ring-2 ring-accent/30")}>
          <header className="flex items-start justify-between gap-3 px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="btn-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
                {regionInfo ? <MapPin size={19} /> : <Sparkles size={19} />}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h2 className="break-words font-display text-[18px] font-semibold leading-tight text-fg sm:text-[20px]">
                    {regionInfo ? regionInfo.name : "Butun O'zbekiston"}
                  </h2>
                  {cat && (
                    <Badge tone="accent" className="shrink-0">
                      <CategoryIcon icon={cat.icon} size={11} /> {cat.name}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-[13px] text-fg-3" aria-live="polite">
                  {regionInfo ? `Markaz: ${regionInfo.capital} · ` : "Eng yuqori reytinglilar · "}
                  <span className="font-semibold text-fg-2 tabular-nums">{shown}</span> ta mutaxassis
                </p>
              </div>
            </div>
            {region ? (
              <Button variant="outline" size="sm" className="shrink-0 !h-8 !px-3" onClick={() => apply(null, category)}>
                <X size={13} /> Tozalash
              </Button>
            ) : (
              <span className="hidden shrink-0 text-[12px] text-fg-4 sm:block">Hududni bosing</span>
            )}
          </header>

          {/* Ro'yxat */}
          {loading ? (
            <ul className="divide-y divide-line border-t border-line">
              {Array.from({ length: 5 }).map((_, i) => (
                <RowSkeleton key={i} />
              ))}
            </ul>
          ) : error ? (
            <div className="flex flex-col items-center border-t border-line px-6 py-12 text-center">
              <p className="font-display text-[16px] font-semibold text-fg">Yuklab bo'lmadi</p>
              <p className="mt-1.5 max-w-xs text-[13px] text-fg-3">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={retry}>
                <RotateCcw size={14} /> Qayta urinish
              </Button>
            </div>
          ) : list && list.items.length > 0 ? (
            <ul key={key} className="divide-y divide-line border-t border-line animate-fade-up" style={{ animationDuration: "0.35s" }}>
              {list.items.map((it) => {
                const c = CATEGORY_BY_SLUG[it.category];
                const price = formatPriceRange(it.priceFrom, it.priceTo);
                return (
                  <li key={it.id}>
                    <Link
                      href={`/mutaxassislar/${it.slug}`}
                      className="group flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-fg/4 sm:px-5"
                    >
                      <Avatar name={it.user.name} src={it.user.avatarUrl} size={46} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-[15px] font-semibold leading-tight text-fg">
                          <span className="truncate">{it.user.name}</span>
                          {it.isVerified && <BadgeCheck size={15} className="shrink-0 fill-accent text-white" aria-label="Tasdiqlangan" />}
                          {!it.isAvailable && <span className="shrink-0 rounded-full bg-fg/8 px-1.5 py-0.5 text-[10px] font-semibold text-fg-3">Band</span>}
                        </p>
                        <p className="mt-0.5 truncate text-[13px] text-fg-2">{it.title}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-fg-3">
                          {c && (
                            <span className="inline-flex items-center gap-1">
                              <CategoryIcon icon={c.icon} size={12} style={{ color: c.accent }} />
                              {c.name}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={11} /> {it.city}
                          </span>
                          <Stars value={it.rating} count={it.reviewCount} size={11} />
                          <span className="font-display text-[12px] font-semibold text-fg sm:hidden">{price}</span>
                        </p>
                      </div>
                      <div className="hidden w-[118px] shrink-0 text-right sm:block">
                        <p className="font-display text-[12px] font-semibold leading-snug text-fg">{price}</p>
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-fg-4">Narx</p>
                      </div>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-fg-3 transition group-hover:border-fg group-hover:text-fg">
                        <ArrowUpRight size={14} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center border-t border-line px-6 py-12 text-center">
              <span className="card mb-4 flex h-14 w-14 items-center justify-center !rounded-[18px] text-accent">
                <SearchX size={24} />
              </span>
              <p className="font-display text-[17px] font-semibold text-fg">Hozircha hech kim yo'q</p>
              <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-fg-3">
                {regionInfo
                  ? `${cat ? cat.plural : "Mutaxassislar"} bu hududda hali ro'yxatdan o'tmagan. Boshqa hududni tanlang yoki birinchi bo'ling.`
                  : `${cat ? cat.plural : "Mutaxassislar"} hali ro'yxatdan o'tmagan — birinchi bo'ling!`}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {region && (
                  <Button variant="outline" size="sm" onClick={() => apply(null, category)}>
                    Butun O'zbekiston
                  </Button>
                )}
                {category && (
                  <Button variant="outline" size="sm" onClick={() => apply(region, null)}>
                    Barcha yo'nalishlar
                  </Button>
                )}
                <ButtonLink href="/auth/royxat?role=specialist" size="sm">
                  <UserPlus size={14} /> Birinchi bo'lish
                </ButtonLink>
              </div>
            </div>
          )}

          {/* Pastki qator */}
          {!error && (
            <div className="flex flex-col gap-3 border-t border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-[12px] text-fg-3">
                {list && list.total > LIMIT ? `Eng yaxshi ${LIMIT} tasi ko'rsatildi` : "Reyting bo'yicha saralangan"}
              </p>
              <ButtonLink href={listHref} variant="accent" size="sm" className="w-full sm:w-auto">
                Barchasini ko'rish ({shown}) <ArrowRight size={14} />
              </ButtonLink>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

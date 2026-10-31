"use client";

import { usePresence } from "@/components/motion/usePresence";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, BarChart3, Briefcase, CalendarDays, Check, Link2, List, LocateFixed, MapPin, RotateCcw, SearchX, Sparkles, Trophy, UserPlus, Users, X } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { XARITA } from "@/lib/i18n/dict/search";
import { UzbekistanMap } from "./UzbekistanMap";
import { lonLatToMap, nearestRegion, regionAt } from "./geo-utils";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ScrollRow } from "@/components/ui/ScrollRow";
import { Avatar, Badge, Button, ButtonLink, IconTile, Stars, VerifiedBadge } from "@/components/ui";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { CATEGORIES, CATEGORY_BY_SLUG, GENDERS, REGIONS, REGION_BY_SLUG, topCategories, type Region } from "@/lib/constants";
import type { RegionStat } from "@/lib/queries";
import { GENDER_OPTIONS, qsOf, useSpecialistList, validCategory, validGender, validRegion, type Gender, type SerializedSpecialist } from "./filter-utils";
import { cn, formatPrice, formatPriceRange, isRecent, timeAgo } from "@/lib/utils";

/**
 * To'liq xarita rejimi: chapda interaktiv xarita (choropleth) + hudud statistikasi,
 * o'ngda yo'nalish filtri + tanlangan hudud bo'yicha mutaxassislar ro'yxati.
 * - Holat (hudud, yo'nalish, jins) URL bilan sinxron: ?region=&category=&gender=
 * - Jins faqat ro'yxatni filtrlaydi; xarita ranglari (hudud statistikasi) umumiy qoladi
 * - Yo'nalish tanlansa xarita ranglari shu yo'nalish bo'yicha qayta hisoblanadi
 * - Ro'yxat GET /api/specialists orqali olinadi va kesh qilinadi
 */

const LIMIT = 12;

/** API JSON'da sanalar satr ko'rinishida keladi */
type MapItem = SerializedSpecialist;

interface ListState {
  items: MapItem[];
  total: number;
}

type ApiResponse =
  | { ok: true; data: { items: MapItem[]; total: number; page: number; pages: number } }
  | { ok: false; error: string };


/** Ishlar rejimi uchun yengil e'lon (server map-stats.ts dan keladi) */
export interface MapJobLite {
  id: string;
  title: string;
  category: string;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetType: "fixed" | "hourly";
  createdAt: number;
}
/** Hover mini-kartasi uchun hudud topi */
export interface MapTopLite {
  slug: string;
  name: string;
  avatarUrl: string | null;
  rating: number;
  reviewCount: number;
  priceFrom: number;
}
export type MapMode = "mutaxassis" | "ish";

export interface MapExplorerProps {
  stats: Record<string, RegionStat>;
  categoryStats: Record<string, number>;
  initialRegion: string | null;
  initialCategory: string | null;
  initialGender?: Gender | null;
  initialMode?: MapMode;
  /** Hudud bo'yicha ochiq e'lonlar soni (+ "remote" kaliti — hududsizlar) */
  jobCounts?: Record<string, number>;
  jobsByRegion?: Record<string, MapJobLite[]>;
  onlineCounts?: Record<string, number>;
  topByRegion?: Record<string, MapTopLite[]>;
  /** Hudud bo'yicha eng ko'p uchraydigan ko'nikmalar (hover kartochka) */
  topSkills?: Record<string, Array<{ skill: string; n: number }>>;
}

/** E'lon byudjeti bir qatorda */
const budgetLine = (j: MapJobLite) => (j.budgetMin || j.budgetMax ? `${formatPriceRange(j.budgetMin ?? 0, j.budgetMax)}${j.budgetType === "hourly" ? " /soat" : ""}` : "Kelishiladi");

/* ------------------------------------------------------------------ */
/* Yordamchilar                                                        */
/* ------------------------------------------------------------------ */

/** «Hududni ulashish»: /xarita?hudud=<slug> havolasini nusxalaydi (2 soniya «Nusxalandi») */
function ShareRegionButton({ slug }: { slug: string }) {
  const til = useLocale();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${window.location.origin}/xarita?hudud=${slug}`);
          setCopied(true);
        } catch {
          /* clipboard yo'q */
        }
      }}
      aria-label={tr(til, XARITA.shareRegion)}
      title={tr(til, XARITA.shareRegion)}
      aria-live="polite"
      className={cn("press inline-flex h-7 items-center gap-1 rounded-full border border-line px-2.5 text-[11px] font-semibold transition hover:border-fg hover:text-fg", copied ? "text-success-text" : "text-fg-2")}
    >
      {copied ? <Check size={12} aria-hidden /> : <Link2 size={12} aria-hidden />}
      {copied ? tr(til, XARITA.shareCopied) : tr(til, XARITA.shareRegion)}
    </button>
  );
}
/** Tooltip birligi: "Videograf" → "videograf", lekin "UI/UX dizayner" / "3D artist" o'zgarmaydi */
const unitOf = (name: string) => (/^[A-Z0-9]{2,}/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1));

/** Narx BIR qatorda: diapazon juda uzun bo'lsa — "… dan" ko'rinishi */
function priceLine(from: number, to?: number | null) {
  const full = formatPriceRange(from, to, { full: true });
  if (full.length <= 20) return full;
  if (from) return `${formatPrice(from)} dan`;
  return full;
}


/* ------------------------------------------------------------------ */
/* "Menga yaqin" — geolokatsiya → hudud                                */
/* ------------------------------------------------------------------ */
type GeoStatus = { tone: "info" | "ok" | "error"; text: string } | null;

/** Brauzer joylashuvi → ichida bo'lgan hudud (yoki markazi eng yaqini). Ruxsat berilmasa — tushunarli xabar */
function useNearMe(onFound: (slug: string) => void) {
  const [status, setStatus] = useState<GeoStatus>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const show = (s: GeoStatus, ms = 0) => {
    clearTimeout(timer.current);
    setStatus(s);
    if (ms) timer.current = setTimeout(() => setStatus(null), ms);
  };

  const locate = () => {
    if (busy) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      show({ tone: "error", text: "Brauzeringiz joylashuvni aniqlay olmaydi — hududni xaritadan tanlang." }, 6000);
      return;
    }
    setBusy(true);
    show({ tone: "info", text: "Joylashuv aniqlanmoqda…" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const p = lonLatToMap(pos.coords.longitude, pos.coords.latitude);
        const inside = regionAt(p.x, p.y);
        const near = inside ?? nearestRegion(p.x, p.y).region;
        const name = REGION_BY_SLUG[near.slug]?.name ?? near.name;
        onFound(near.slug);
        show(
          inside
            ? { tone: "ok", text: `Siz ${name} hududidasiz — ro'yxat shu hudud bo'yicha.` }
            : { tone: "ok", text: `Joylashuvingiz O'zbekistondan tashqarida — eng yaqin hudud: ${name}.` },
          7000,
        );
      },
      (err) => {
        setBusy(false);
        show(
          {
            tone: "error",
            text:
              err.code === err.PERMISSION_DENIED
                ? "Joylashuvga ruxsat berilmadi. Brauzer sozlamalarida ruxsat bering yoki hududni xaritadan tanlang."
                : err.code === err.TIMEOUT
                  ? "Joylashuvni aniqlash juda uzoq davom etdi — qayta urinib ko'ring."
                  : "Joylashuvni aniqlab bo'lmadi — hududni xaritadan tanlang.",
          },
          8000,
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  };

  return { status, busy, locate, dismiss: () => show(null) };
}

/* ------------------------------------------------------------------ */
/* Kichik UI bo'laklari                                                */
/* ------------------------------------------------------------------ */
function Chip({ active, onClick, children, size = "md", className }: { active: boolean; onClick: () => void; children: ReactNode; size?: "sm" | "md"; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold transition active:scale-[0.97]",
        size === "md" ? "h-10 px-3.5 text-[13px]" : "h-9 px-3 text-[12.5px]",
        active ? "btn-ink border-transparent" : "border-line bg-surface text-fg-2 hover:border-line-2 hover:text-fg",
        className,
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
/* "Barcha hududlar" varag'i (mobil + klaviatura uchun qulay ro'yxat)   */
/* ------------------------------------------------------------------ */
function RegionSheet({
  open,
  onClose,
  selected,
  countFor,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  selected: string | null;
  countFor: (slug: string) => number;
  onPick: (slug: string | null) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);
  useFocusTrap(ref, mounted && open);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const pres = usePresence(open, 280);
  if (!mounted || !pres.mounted) return null;
  const sorted = [...REGIONS].sort((a, b) => a.short.localeCompare(b.short, "uz"));

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="region-sheet-title">
      <button type="button" aria-label="Yopish" onClick={onClose} className={`absolute inset-0 bg-black/45 ${pres.closing ? "animate-fade-out" : "animate-fade-in"}`} />
      <div
        ref={ref}
        className={`card-elevated absolute inset-x-0 bottom-0 flex max-h-[86dvh] flex-col !rounded-b-none !rounded-t-[var(--r-lg)] sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[420px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:!rounded-[var(--r-lg)] ${pres.closing ? "animate-sheet-down sm:animate-modal-out" : "animate-sheet-up sm:animate-modal-in"}`}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-fg/15 sm:hidden" />
        <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-3 sm:pt-5">
          <h2 id="region-sheet-title" className="font-display text-[18px] font-semibold text-fg">
            Barcha hududlar
          </h2>
          <button type="button" onClick={onClose} aria-label="Yopish" className="flex h-11 w-11 items-center justify-center rounded-full text-fg-2 transition hover:bg-fg/6 hover:text-fg">
            <X size={20} />
          </button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <li>
            <button
              type="button"
              onClick={() => {
                onPick(null);
                onClose();
              }}
              className={cn("flex min-h-12 w-full items-center gap-3 rounded-[var(--r-sm)] px-3 text-left text-[15px] transition hover:bg-fg/5", !selected && "bg-fg/5 font-semibold")}
            >
              <span className="flex-1 text-fg">Butun O'zbekiston</span>
              {!selected && <Check size={16} className="text-accent" />}
            </button>
          </li>
          {sorted.map((r) => {
            const on = selected === r.slug;
            return (
              <li key={r.slug}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(on ? null : r.slug);
                    onClose();
                  }}
                  className={cn("flex min-h-12 w-full items-center gap-3 rounded-[var(--r-sm)] px-3 text-left text-[15px] transition hover:bg-fg/5", on && "bg-fg/5 font-semibold")}
                >
                  <span className="flex-1 truncate text-fg">{r.name}</span>
                  <span className="text-[12px] tabular-nums text-fg-3">{countFor(r.slug)}</span>
                  {on && <Check size={16} className="text-accent" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Hudud statistikasi paneli                                           */
/* ------------------------------------------------------------------ */
function RegionStatsPanel({
  regionInfo,
  category,
  total,
  byCategory,
  topItems,
  loading,
  onPickCategory,
  className,
}: {
  regionInfo: Region | null;
  category: string | null;
  total: number;
  byCategory: Record<string, number>;
  topItems: MapItem[];
  loading: boolean;
  onPickCategory: (slug: string | null) => void;
  className?: string;
}) {
  const rows = CATEGORIES.map((c) => ({ c, n: byCategory[c.slug] ?? 0 }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...rows.map((r) => r.n));

  return (
    <section className={cn("card p-4 sm:p-5", className)} aria-label="Hudud statistikasi">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="eyebrow">Hudud statistikasi</span>
          <h3 className="mt-2 truncate font-display text-[18px] font-semibold text-fg">{regionInfo ? regionInfo.name : "Butun O'zbekiston"}</h3>
        </div>
        <IconTile icon={BarChart3} tone="soft" size="sm" />
      </div>

      <div className="mt-4 flex items-end gap-2">
        <span className="font-display text-[40px] font-semibold leading-none tracking-tight text-fg tabular-nums">{total}</span>
        <span className="pb-1 text-[13px] text-fg-3">ta mutaxassis{regionInfo ? ` · markaz ${regionInfo.capital}` : ` · ${REGIONS.length} hudud`}</span>
      </div>

      {/* Yo'nalishlar bo'yicha */}
      {rows.length > 0 ? (
        <ul className="mt-5 space-y-1" aria-label="Yo'nalishlar bo'yicha">
          {rows.map(({ c, n }) => {
            const on = category === c.slug;
            const dim = Boolean(category) && !on;
            return (
              <li key={c.slug}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onPickCategory(on ? null : c.slug)}
                  className={cn("group block min-h-10 w-full rounded-[10px] py-1.5 text-left transition", dim && "opacity-55 hover:opacity-100")}
                >
                  <span className="flex items-center justify-between gap-3 text-[13px]">
                    <span className={cn("inline-flex min-w-0 items-center gap-1.5 font-medium", on ? "text-accent-text" : "text-fg-2 group-hover:text-fg")}>
                      <CategoryIcon icon={c.icon} size={16} className="shrink-0" />
                      <span className="truncate">{c.plural}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-fg">{n}</span>
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-fg/8">
                    <span
                      className={cn("block h-full rounded-full transition-[width,background-color] duration-500", on ? "bg-accent" : "bg-fg/30 group-hover:bg-fg/45")}
                      style={{ width: `${Math.max(4, Math.round((n / max) * 100))}%` }}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-5 text-[13px] text-fg-3">Bu hududda hali mutaxassislar ro'yxatdan o'tmagan.</p>
      )}

      {/* Top-3 */}
      <div className="mt-5 border-t border-line pt-4">
        <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">
          <Trophy size={12} /> Eng yuqori reyting
        </p>
        {loading ? (
          <ul className="mt-3 space-y-2" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="skeleton h-9 w-9 shrink-0 !rounded-full" />
                <span className="flex-1 space-y-1.5">
                  <span className="skeleton block h-3 w-1/2" />
                  <span className="skeleton block h-2.5 w-1/3" />
                </span>
              </li>
            ))}
          </ul>
        ) : topItems.length > 0 ? (
          <ol className="mt-3 space-y-1">
            {topItems.map((it, i) => (
              <li key={it.id}>
                <Link href={`/mutaxassislar/${it.slug}`} className="-mx-2 flex min-h-11 items-center gap-3 rounded-[10px] px-2 py-1.5 transition hover:bg-fg/4">
                  <span className="w-4 shrink-0 text-center text-[12px] font-bold tabular-nums text-fg-4">{i + 1}</span>
                  <Avatar name={it.user.name} src={it.user.avatarUrl} size={34} decorative />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-[13.5px] font-semibold text-fg">
                      <span className="truncate">{it.user.name}</span>
                      {it.isVerified && <VerifiedBadge size={13} />}
                    </span>
                    <span className="block truncate text-[12px] text-fg-3">{it.title}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <Stars value={it.rating} count={it.reviewCount} size={10} />
                    <span className="block whitespace-nowrap text-[11px] font-semibold text-fg-2">{priceLine(it.priceFrom, it.priceTo)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-[13px] text-fg-3">Hozircha reytinglar yo'q.</p>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* "Ishlar" rejimi paneli: tanlangan hudud (yoki butun O'zbekiston) e'lonlari */
/* ------------------------------------------------------------------ */
function JobsPanel({
  region,
  regionInfo,
  jobsByRegion,
  count,
  onClear,
}: {
  region: string | null;
  regionInfo: Region | null;
  jobsByRegion: Record<string, MapJobLite[]>;
  count: number;
  onClear: () => void;
}) {
  const items = useMemo(() => {
    if (region) return jobsByRegion[region] ?? [];
    return Object.values(jobsByRegion)
      .flat()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8);
  }, [region, jobsByRegion]);
  const listHref = `/ishlar${region ? `?region=${region}` : ""}`;

  return (
    <div className={cn("card overflow-hidden transition-shadow duration-500", region && "ring-2 ring-accent/30")}>
      <header className="flex items-start justify-between gap-3 px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile icon={Briefcase} />
          <div className="min-w-0">
            <h2 className="break-words font-display text-[18px] font-semibold leading-tight text-fg sm:text-[20px]">
              {regionInfo ? regionInfo.name : "Butun O'zbekiston"}
            </h2>
            <p className="mt-1 text-[13px] text-fg-3" aria-live="polite">
              <span className="font-semibold text-fg-2 tabular-nums">{count}</span> ta ochiq e'lon
            </p>
          </div>
        </div>
        {region ? (
          <Button variant="outline" size="sm" className="shrink-0" onClick={onClear}>
            <X size={16} /> Tozalash
          </Button>
        ) : (
          <span className="hidden shrink-0 pt-2 text-[12px] text-fg-4 sm:block">Hududni bosing</span>
        )}
      </header>

      {items.length > 0 ? (
        <ul className="divide-y divide-line border-t border-line animate-fade-up" style={{ animationDuration: "0.35s" }}>
          {items.map((j) => {
            const c = CATEGORY_BY_SLUG[j.category];
            return (
              <li key={j.id}>
                <Link href={`/ishlar/${j.id}`} className="group flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-fg/4 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold leading-tight text-fg">{j.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-fg-3">
                      {c && (
                        <span className="inline-flex items-center gap-1">
                          <CategoryIcon icon={c.icon} size={12} /> {c.name}
                        </span>
                      )}
                      <span className="whitespace-nowrap font-semibold text-fg-2">{budgetLine(j)}</span>
                      <time suppressHydrationWarning>{timeAgo(j.createdAt)}</time>
                    </p>
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-fg-3 transition group-hover:border-fg group-hover:text-fg">
                    <ArrowUpRight size={16} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center border-t border-line px-6 py-12 text-center">
          <IconTile icon={SearchX} tone="soft" size="lg" className="mb-4" />
          <p className="font-display text-[17px] font-semibold text-fg">Bu hududda ochiq e'lon yo'q</p>
          <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-fg-3">Birinchi e'lonni siz joylashingiz mumkin — mutaxassislar o'zi taklif yuboradi.</p>
          <ButtonLink href="/ishlar/yangi" size="sm" className="mt-5">
            E'lon joylash
          </ButtonLink>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
        <p className="min-w-0 text-[12px] leading-snug text-fg-3">Eng yangilari ko'rsatildi</p>
        <ButtonLink href={listHref} variant="accent" size="sm" className="shrink-0 !h-10">
          Barchasini ko'rish <ArrowRight size={16} />
        </ButtonLink>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Asosiy komponent                                                    */
/* ------------------------------------------------------------------ */
export function MapExplorer({
  stats,
  categoryStats,
  initialRegion,
  initialCategory,
  initialGender = null,
  initialMode = "mutaxassis",
  jobCounts,
  jobsByRegion = {},
  onlineCounts,
  topByRegion,
  topSkills,
}: MapExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [region, setRegion] = useState<string | null>(initialRegion);
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [gender, setGender] = useState<Gender | null>(initialGender);
  const [mode, setMode] = useState<MapMode>(initialMode);
  const [sheetOpen, setSheetOpen] = useState(false);
  /** Sana filtri: shu kunga bo'sh mutaxassislar (faqat mutaxassis rejimida) */
  const [sana, setSana] = useState<string | null>(null);
  const [avail, setAvail] = useState<{ counts: Record<string, number>; total: number } | null>(null);
  const [availLoading, setAvailLoading] = useState(false);

  /** URL: filtr + rejim ("ish" bo'lsa ?rejim=ish qo'shiladi) */
  const fullQs = (r: string | null, c: string | null, g: Gender | null, m: MapMode) => {
    const base = qsOf(r, c, g);
    if (m !== "ish") return base;
    return base ? `${base}&rejim=ish` : "rejim=ish";
  };

  /** Biz so'ragan oxirgi URL holati (o'z yangilanishimizni tashqi navigatsiyadan ajratish uchun) */
  const wanted = useRef(fullQs(initialRegion, initialCategory, initialGender, initialMode));

  const apply = (r: string | null, c: string | null, g: Gender | null = gender, m: MapMode = mode) => {
    setRegion(r);
    setCategory(c);
    setGender(g);
    setMode(m);
    const qs = fullQs(r, c, g, m);
    if (qs === wanted.current) return;
    wanted.current = qs;
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  /* "Menga yaqin": javob kelguncha foydalanuvchi yo'nalish/jinsni o'zgartirgan bo'lishi mumkin — eng so'nggi holatga qo'llaymiz */
  const latest = useRef({ apply, category });
  useEffect(() => {
    latest.current = { apply, category };
  });
  const nearMe = useNearMe((slug) => latest.current.apply(slug, latest.current.category));

  // Tashqi navigatsiya (orqaga/oldinga, menyudagi havola) → holatni URL'dan olamiz
  useEffect(() => {
    if (isPending) return;
    const r = validRegion(searchParams.get("region"));
    const c = validCategory(searchParams.get("category"));
    const g = validGender(searchParams.get("gender"));
    const m: MapMode = searchParams.get("rejim") === "ish" ? "ish" : "mutaxassis";
    const qs = fullQs(r, c, g, m);
    if (qs === wanted.current) return;
    wanted.current = qs;
    setRegion(r);
    setCategory(c);
    setGender(g);
    setMode(m);
  }, [searchParams, isPending]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- Sana bo'yicha bo'shlar: API dan hudud kesimi ---------- */
  useEffect(() => {
    if (!sana || mode !== "mutaxassis") {
      setAvail(null);
      return;
    }
    const ctrl = new AbortController();
    setAvailLoading(true);
    fetch(`/api/map/availability?date=${sana}${category ? `&category=${category}` : ""}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => setAvail(j?.ok ? j.data : null))
      .catch(() => {})
      .finally(() => setAvailLoading(false));
    return () => ctrl.abort();
  }, [sana, category, mode]);

  /* ---------- Hisoblar ---------- */
  const total = useMemo(() => REGIONS.reduce((a, r) => a + (stats[r.slug]?.total ?? 0), 0), [stats]);

  const jobRegionCounts = useMemo(() => Object.fromEntries(REGIONS.map((r) => [r.slug, jobCounts?.[r.slug] ?? 0])), [jobCounts]);
  const jobsTotal = useMemo(() => REGIONS.reduce((a, r) => a + (jobRegionCounts[r.slug] ?? 0), 0), [jobRegionCounts]);
  const remoteJobs = jobCounts?.remote ?? 0;

  /** Xarita ranglari: rejim (ishlar) > sana (bo'shlar) > yo'nalish > umumiy */
  const counts = useMemo(() => {
    if (mode === "ish") return jobRegionCounts;
    if (avail) return avail.counts;
    if (!category) return undefined;
    return Object.fromEntries(REGIONS.map((r) => [r.slug, stats[r.slug]?.byCategory[category] ?? 0]));
  }, [mode, jobRegionCounts, avail, category, stats]);

  const countFor = (slug: string) => (counts ? (counts[slug] ?? 0) : (stats[slug]?.total ?? 0));
  const scopeTotal = counts ? REGIONS.reduce((a, r) => a + (counts[r.slug] ?? 0), 0) : total;
  const categoryCount = (c: string) => (region ? (stats[region]?.byCategory[c] ?? 0) : (categoryStats[c] ?? 0));
  const regionTotalAll = region ? (stats[region]?.total ?? 0) : total;
  const scopeByCategory: Record<string, number> = region ? (stats[region]?.byCategory ?? {}) : categoryStats;

  const regionsByCount = useMemo(
    () => [...REGIONS].sort((a, b) => countFor(b.slug) - countFor(a.slug)),
    [counts, stats], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /* ---------- Ro'yxat: umumiy hook (kesh + abort + xato/qayta urinish) — HomeMapSection bilan bitta kod ---------- */
  const { key, list, loading, error, retry } = useSpecialistList(region, category, gender, LIMIT);

  const regionInfo = region ? REGION_BY_SLUG[region] : null;
  const cat = category ? CATEGORY_BY_SLUG[category] : null;
  const genderInfo = gender ? GENDERS.find((g) => g.value === gender) : undefined;
  /* Jins tanlanganda hudud statistikasida son yo'q — faqat ro'yxat javobidan olamiz */
  const shown: number | null = list && !loading ? list.total : gender ? null : region ? countFor(region) : scopeTotal;
  const shownLabel = shown == null ? "…" : String(shown);
  /** Jins tanlanganda son hudud statistikasidan emas, ro'yxat javobidan — shuni aniq aytamiz */
  const shownUnit = genderInfo ? `${genderInfo.label.toLowerCase()} mutaxassis ko'rsatilgan` : "mutaxassis";
  const listHref = `/mutaxassislar${key ? `?${key}` : ""}`;
  const topItems = list?.items.slice(0, 3) ?? [];

  const statsPanel = (className: string) => (
    <RegionStatsPanel
      className={className}
      regionInfo={regionInfo}
      category={category}
      total={regionTotalAll}
      byCategory={scopeByCategory}
      topItems={topItems}
      loading={loading}
      onPickCategory={(c) => apply(region, c)}
    />
  );

  return (
    // grid-cols-1 + min-w-0: gorizontal aylanadigan chip qatorlari ustunni kengaytirib yubormasligi uchun
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
      {/* ================= XARITA + STATISTIKA ================= */}
      <section className="flex min-w-0 flex-col gap-5 lg:col-span-7" aria-label="Interaktiv xarita">
        <div className="card p-3 sm:p-5">
          {/* Rejim (talab/taklif) + sana filtri */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="segment" role="radiogroup" aria-label="Xarita rejimi">
              <button type="button" role="radio" aria-checked={mode === "mutaxassis"} data-active={mode === "mutaxassis"} onClick={() => apply(region, category, gender, "mutaxassis")} className="segment-item min-h-[38px] !px-3.5 !py-1 text-[12.5px]">
                <Users size={15} /> Mutaxassislar
              </button>
              <button type="button" role="radio" aria-checked={mode === "ish"} data-active={mode === "ish"} onClick={() => apply(region, category, gender, "ish")} className="segment-item min-h-[38px] !px-3.5 !py-1 text-[12.5px]">
                <Briefcase size={15} /> Ishlar{jobsTotal + remoteJobs > 0 && <span className="tabular-nums opacity-75">{jobsTotal + remoteJobs}</span>}
              </button>
            </div>
            {mode === "mutaxassis" && (
              <label
                className={cn(
                  "inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition",
                  sana ? "border-accent/60 bg-accent-soft text-accent-text" : "border-line bg-surface text-fg-2 hover:border-line-2",
                )}
                title="Shu kunga bo'sh mutaxassislarni xaritada ko'rsatish"
              >
                <CalendarDays size={15} className="shrink-0" />
                <span className="hidden whitespace-nowrap sm:inline">{sana ? "Bo'sh:" : "Qaysi kunga?"}</span>
                <input
                  type="date"
                  value={sana ?? ""}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setSana(e.target.value || null)}
                  aria-label="Sana bo'yicha bo'sh mutaxassislar"
                  className="h-8 w-[8.2rem] bg-transparent text-[12.5px] font-semibold outline-none"
                />
                {sana && (
                  <button type="button" onClick={() => setSana(null)} aria-label="Sanani tozalash" className="-mr-1 flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-fg/10">
                    <X size={13} />
                  </button>
                )}
              </label>
            )}
          </div>

          {/* Sarlavha qatori */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 sm:mb-3">
            <div className="flex items-center gap-2.5 text-[12px] font-semibold text-fg-2 sm:text-[13px]">
              <LiveDot />
              <span>
                {mode === "ish" ? (
                  <>
                    <span className="text-fg">{jobsTotal}</span>&nbsp;ta ochiq e'lon xaritada
                    {remoteJobs > 0 && <span className="text-fg-3"> · {remoteJobs} tasi masofaviy</span>}
                  </>
                ) : sana ? (
                  <>
                    {availLoading ? "Hisoblanmoqda…" : <><span className="text-fg">{avail?.total ?? "…"}</span>&nbsp;ta {sana} kuni bo'sh</>}
                    {cat && (
                      <>
                        {" "}
                        · <span className="text-accent-text">{cat.plural}</span>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {REGIONS.length}&nbsp;hudud · <span className="text-fg">{scopeTotal}</span>&nbsp;mutaxassis
                    {cat && (
                      <>
                        {" "}
                        · <span className="text-accent-text">{cat.plural}</span>
                      </>
                    )}
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-fg-3">
              {region && <ShareRegionButton slug={region} />}
              <span className="flex items-center gap-2">
                kam
                <span className="map-legend-ramp h-2 w-20 rounded-full sm:w-28" aria-hidden="true" />
                ko'p
              </span>
            </div>
          </div>

          <UzbekistanMap
            variant="panel"
            stats={stats}
            counts={counts}
            selected={region}
            onSelect={(slug) => apply(slug, category)}
            unitLabel={mode === "ish" ? "ochiq e'lon" : sana ? "bo'sh mutaxassis" : cat ? unitOf(cat.name) : "mutaxassis"}
            onlineCounts={mode === "mutaxassis" ? onlineCounts : undefined}
            topByRegion={mode === "mutaxassis" && !sana ? topByRegion : undefined}
            topSkills={mode === "mutaxassis" ? topSkills : undefined}
            zoomable
            className="px-1 sm:px-2"
          />

          {/* Geolokatsiya holati */}
          {nearMe.status && (
            <div
              className={cn(
                "mt-2 flex items-start gap-2 rounded-tile px-3 py-2 text-[12.5px] leading-snug",
                nearMe.status.tone === "error" ? "bg-warning-soft text-fg" : nearMe.status.tone === "ok" ? "bg-accent-soft text-fg" : "bg-fg/5 text-fg-2",
              )}
              role="status"
            >
              <LocateFixed size={16} className={cn("mt-px shrink-0", nearMe.status.tone === "error" ? "text-warning" : "text-accent-text")} />
              <span className="flex-1">{nearMe.status.text}</span>
              <button type="button" onClick={nearMe.dismiss} aria-label="Yopish" className="-my-1 -mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Hudud chiplari: 2 qatorli gorizontal lenta (snap) — kichik hududlarni bosish oson; klaviaturadan ham */}
          <ScrollRow
            label="Hududlar"
            className="-mx-3 mt-2 sm:-mx-5"
            rowClassName="grid auto-cols-max grid-flow-col grid-rows-2 gap-1.5 px-3 pb-1 sm:px-5"
          >
            <Chip size="sm" active={false} onClick={nearMe.locate} className="snap-start">
              <LocateFixed size={16} className={nearMe.busy ? "animate-pulse text-accent" : "text-accent-text"} /> Menga yaqin
            </Chip>
            <Chip size="sm" active={false} onClick={() => setSheetOpen(true)} className="snap-start !border-dashed">
              <List size={16} /> Barcha hududlar
            </Chip>
            {regionsByCount.map((r) => {
              const on = region === r.slug;
              return (
                <Chip key={r.slug} size="sm" active={on} onClick={() => apply(on ? null : r.slug, category)} className="snap-start">
                  {r.short}
                  <Count n={countFor(r.slug)} active={on} />
                </Chip>
              );
            })}
          </ScrollRow>
        </div>

        {mode === "mutaxassis" && statsPanel("hidden lg:block")}
      </section>

      {/* ================= PANEL ================= */}
      <aside className="flex min-w-0 flex-col gap-4 lg:col-span-5" aria-label="Natijalar paneli">
        {mode === "ish" ? (
          <JobsPanel region={region} regionInfo={regionInfo} jobsByRegion={jobsByRegion} count={region ? (jobRegionCounts[region] ?? 0) : jobsTotal + remoteJobs} onClear={() => apply(null, category)} />
        ) : (
          <>
        {/* Yo'nalish filtri — ko'pi bilan 2 qator, gorizontal aylanadi */}
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">
              Yo'nalish
              {isPending && <span className="ml-2 hidden font-medium normal-case tracking-normal text-fg-4 sm:inline">Yangilanmoqda…</span>}
            </p>
            {/* Jins — faqat ro'yxatni filtrlaydi (xarita ranglari umumiy) */}
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
                    onClick={() => apply(region, category, g.value ? g.value : null)}
                    className="segment-item min-h-[38px] !px-3 !py-1 text-[12px]"
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </div>
          <ScrollRow label="Yo'nalishlar" className="-mx-4 sm:mx-0" rowClassName="grid auto-cols-max grid-flow-col grid-rows-2 gap-1.5 px-4 pb-1 sm:px-0">
            <Chip active={!category} onClick={() => apply(region, null)} className="snap-start">
              Barchasi <Count n={regionTotalAll} active={!category} />
            </Chip>
            {topCategories(Object.fromEntries(CATEGORIES.map((c) => [c.slug, categoryCount(c.slug)])), category, 12).map((c) => {
              const on = category === c.slug;
              return (
                <Chip key={c.slug} active={on} onClick={() => apply(region, on ? null : c.slug)} className="snap-start">
                  <CategoryIcon icon={c.icon} size={16} className={on ? undefined : "text-fg-3"} />
                  {c.name}
                  <Count n={categoryCount(c.slug)} active={on} />
                </Chip>
              );
            })}
          </ScrollRow>
        </div>

        {/* Natijalar */}
        <div className={cn("card overflow-hidden transition-shadow duration-500", region && "ring-2 ring-accent/30")}>
          <header className="flex items-start justify-between gap-3 px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
            <div className="flex min-w-0 items-start gap-3">
              <IconTile icon={regionInfo ? MapPin : Sparkles} />
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
                  {genderInfo && (
                    <Badge tone="neutral" className="shrink-0">
                      {genderInfo.label}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-[13px] text-fg-3" aria-live="polite">
                  {regionInfo ? `Markaz: ${regionInfo.capital} · ` : "Eng yuqori reytinglilar · "}
                  <span className="font-semibold text-fg-2 tabular-nums">{shownLabel}</span> ta {shownUnit}
                </p>
              </div>
            </div>
            {region ? (
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => apply(null, category)}>
                <X size={16} /> Tozalash
              </Button>
            ) : (
              <span className="hidden shrink-0 pt-2 text-[12px] text-fg-4 sm:block">Hududni bosing</span>
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
                <RotateCcw size={16} /> Qayta urinish
              </Button>
            </div>
          ) : list && list.items.length > 0 ? (
            <ul key={key} className="divide-y divide-line border-t border-line animate-fade-up" style={{ animationDuration: "0.35s" }}>
              {list.items.map((it) => {
                const c = CATEGORY_BY_SLUG[it.category];
                const price = priceLine(it.priceFrom, it.priceTo);
                return (
                  <li key={it.id}>
                    <Link
                      href={`/mutaxassislar/${it.slug}`}
                      className="group flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-fg/4 sm:px-5"
                    >
                      <Avatar name={it.user.name} src={it.user.avatarUrl} size={46} decorative />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-[15px] font-semibold leading-tight text-fg">
                          <span className="truncate">{it.user.name}</span>
                          {it.isVerified && <VerifiedBadge size={15} />}
                          {isRecent(it.createdAt, 7) && <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent-text">Yangi</span>}
                          {!it.isAvailable && <span className="shrink-0 rounded-full bg-warning-soft px-1.5 py-0.5 text-[11px] font-semibold text-warning-text">Band</span>}
                        </p>
                        <p className="mt-0.5 truncate text-[13px] text-fg-2">{it.title}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-fg-3">
                          {c && (
                            <span className="inline-flex items-center gap-1">
                              <CategoryIcon icon={c.icon} size={12} />
                              {c.name}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={11} /> {it.city}
                          </span>
                          <span className="whitespace-nowrap font-display text-[12px] font-semibold text-fg sm:hidden">{price}</span>
                        </p>
                      </div>
                      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                        <p className="whitespace-nowrap font-display text-[13px] font-semibold leading-none text-fg">{price}</p>
                        <Stars value={it.rating} count={it.reviewCount} size={11} />
                      </div>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-fg-3 transition group-hover:border-fg group-hover:text-fg">
                        <ArrowUpRight size={16} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center border-t border-line px-6 py-12 text-center">
              <IconTile icon={SearchX} tone="soft" size="lg" className="mb-4" />
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
                {gender && (
                  <Button variant="outline" size="sm" onClick={() => apply(region, category, null)}>
                    Barcha jinslar
                  </Button>
                )}
                <ButtonLink href="/auth/royxat?role=specialist" size="sm">
                  <UserPlus size={16} /> Birinchi bo'lish
                </ButtonLink>
              </div>
            </div>
          )}

          {/* Pastki qator — matn va tugma bir chiziqda */}
          {!error && (
            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
              <p className="min-w-0 text-[12px] leading-snug text-fg-3">
                {list && list.total > LIMIT ? `Eng yaxshi ${LIMIT} tasi ko'rsatildi` : "Reyting bo'yicha saralangan"}
              </p>
              <ButtonLink href={listHref} variant="accent" size="sm" className="shrink-0 !h-10">
                Barchasini ko'rish ({shownLabel}) <ArrowRight size={16} />
              </ButtonLink>
            </div>
          )}
        </div>
          </>
        )}
      </aside>

      {/* Mobil/planshetda statistika ro'yxatdan keyin */}
      {mode === "mutaxassis" && statsPanel("lg:hidden")}

      <RegionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} selected={region} countFor={countFor} onPick={(slug) => apply(slug, category)} />
    </div>
  );
}

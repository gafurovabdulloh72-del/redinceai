import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Megaphone, RotateCcw, UserPlus, Wand2 } from "lucide-react";
import { ButtonLink, PageHeader } from "@/components/ui";
import { SpecialistCard } from "@/components/specialists/SpecialistCard";
import { SpecialistRow } from "@/components/specialists/SpecialistRow";
import { Filters, MobileFilters, PerPage, SortSelect, ViewToggle } from "@/components/specialists/Filters";
import { ActiveFilters } from "@/components/specialists/ActiveFilters";
import { Pagination, buildHref } from "@/components/specialists/Pagination";
import { RecentlyViewed } from "@/components/specialists/RecentlyViewed";
import { SaveSearchButton } from "@/components/specialists/SaveSearchButton";
import { CompareTray } from "@/components/specialists/CompareTray";
import { describeSavedQuery, pickSavedParams } from "@/components/specialists/saved-search-label";
import { REGIONS } from "@/lib/constants";
import { getSession } from "@/lib/auth";
import { tr } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { KATALOG, KATALOG_X } from "@/lib/i18n/dict/catalog";
import { getCategoryStats, getRegionStats, getSkillStats, listSpecialists } from "@/lib/queries";
import { specialistFilterSchema, type SpecialistFilter } from "@/lib/validators";

export const dynamic = "force-dynamic";

const BASE = "/mutaxassislar";
const DEFAULT_LIMIT = 24;
/** Ko'rinish (to'r/ro'yxat) cookie'si — ViewToggle yozadi, URL'da view bo'lmasa shu o'qiladi */
const VIEW_COOKIE = "katalog_korinish";

type RawSearchParams = Record<string, string | string[] | undefined>;

/** Filtr/qidiruv kalitlari — birortasi bo'lsa sahifa indekslanmaydi (kanonik /mutaxassislar bilan dublikat) */
const FILTER_KEYS = ["q", "category", "region", "priceMin", "priceMax", "experience", "gender", "verified", "available", "skill", "equipment", "workType", "openNow", "sort", "page"] as const;

export async function generateMetadata({ searchParams }: { searchParams: Promise<RawSearchParams> }): Promise<Metadata> {
  const flat = flatten(await searchParams);
  const filtered = FILTER_KEYS.some((k) => k in flat);
  return {
    title: "Mutaxassislar",
    description: "O'zbekistonning barcha hududlaridagi videograf, montajor, dizayner va boshqa ijodkorlar — filtrlang, solishtiring va buyurtma bering.",
    alternates: { canonical: BASE },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

type View = "grid" | "list";

/** Next searchParams'ni oddiy {key: string} ko'rinishiga keltiradi */
function flatten(raw: RawSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (typeof s === "string" && s !== "") out[k] = s;
  }
  return out;
}

/** Zod bilan tekshiradi; xato bo'lgan kalitlarni tashlab yuborib qayta urinadi, bo'lmasa standart qiymatlar */
function parseFilter(flat: Record<string, string>): SpecialistFilter {
  let res = specialistFilterSchema.safeParse(flat);
  if (!res.success) {
    const bad = new Set(res.error.issues.map((i) => String(i.path[0])));
    res = specialistFilterSchema.safeParse(Object.fromEntries(Object.entries(flat).filter(([k]) => !bad.has(k))));
  }
  const f: SpecialistFilter = res.success ? res.data : specialistFilterSchema.parse({});

  // Noma'lum slug'lar sxemada 422 beradi — yuqorida shunchaki tashlab yuborilgan (bo'sh natija o'rniga)
  if (f.verified === "0") f.verified = undefined;
  if (f.priceMax === 0) f.priceMax = undefined;
  // Teskari oraliq (min >= max) — listSpecialists kabi e'tiborsiz; chip ham chiqmasin
  if (f.priceMin === 0 || (f.priceMin && f.priceMax && f.priceMin >= f.priceMax)) f.priceMin = undefined;
  if (f.q === "") f.q = undefined;
  if (f.skill === "") f.skill = undefined;
  if (f.equipment === "") f.equipment = undefined;
  return f;
}

/** Kanonik URL parametrlari (standart qiymatlar yozilmaydi) */
function filterToQuery(f: SpecialistFilter, extra: { view: View; viewInUrl: boolean }): Record<string, string | undefined> {
  return {
    q: f.q || undefined,
    category: f.category || undefined,
    region: f.region || undefined,
    priceMin: f.priceMin ? String(f.priceMin) : undefined,
    priceMax: f.priceMax ? String(f.priceMax) : undefined,
    experience: f.experience || undefined,
    gender: f.gender || undefined,
    verified: f.verified === "1" ? "1" : undefined,
    available: f.available === "1" ? "1" : undefined,
    skill: f.skill || undefined,
    equipment: f.equipment || undefined,
    workType: f.workType || undefined,
    openNow: f.openNow === "1" ? "1" : undefined,
    sort: f.sort !== "rating" ? f.sort : undefined,
    // Cookie'dan kelgan ko'rinish URL'ga yozilmaydi (havolalar toza qoladi)
    view: extra.viewInUrl && extra.view === "list" ? "list" : undefined,
    limit: f.limit !== DEFAULT_LIMIT ? String(f.limit) : undefined,
    page: f.page > 1 ? String(f.page) : undefined,
  };
}

function FiltersFallback() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-6 w-28 skeleton" />
      <div className="h-11 w-full skeleton" />
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-24 skeleton !rounded-full" />
        ))}
      </div>
      <div className="h-11 w-full skeleton" />
      <div className="h-11 w-full skeleton" />
    </div>
  );
}

/** Bo'sh holat illyustratsiyasi: xarita belgisi + lupa (inline SVG, tokenlar bilan bo'yalgan) */
function EmptyIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 140" width={200} height={140} className={className} aria-hidden="true" focusable="false">
      <ellipse cx="100" cy="124" rx="78" ry="8" fill="var(--fg)" opacity="0.06" />
      <path d="M30 96 L70 76 L120 90 L170 68" stroke="var(--line-2)" strokeWidth="2" strokeDasharray="5 6" fill="none" strokeLinecap="round" />
      <path d="M100 18c-18 0-32 14-32 32 0 24 32 56 32 56s32-32 32-56c0-18-14-32-32-32z" fill="var(--accent)" />
      <circle cx="100" cy="50" r="13" fill="var(--surface)" />
      <circle cx="146" cy="92" r="19" fill="var(--surface)" stroke="var(--fg)" strokeWidth="4" />
      <circle cx="146" cy="92" r="11" fill="var(--accent-soft)" />
      <path d="M160 106 L178 124" stroke="var(--fg)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="44" cy="60" r="4" fill="var(--accent)" opacity="0.45" />
      <circle cx="166" cy="40" r="3" fill="var(--accent)" opacity="0.35" />
      <circle cx="60" cy="30" r="2.5" fill="var(--fg)" opacity="0.2" />
    </svg>
  );
}

function EmptyBlock({ title, description, action }: { title: string; description: string; action: React.ReactNode }) {
  return (
    <div className="card-outline flex flex-col items-center justify-center px-6 py-12 text-center sm:py-16">
      <div data-reveal="scale">
        <EmptyIllustration className="mb-5 h-auto w-[180px] sm:w-[200px]" />
      </div>
      <h3 className="font-display text-[18px] font-semibold text-fg">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-fg-3">{description}</p>
      <div className="mt-6">{action}</div>
    </div>
  );
}

export default async function SpecialistsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const [til, flatRaw, jar] = await Promise.all([getLocale(), searchParams, cookies()]);
  const flat = flatten(flatRaw);
  const filter = parseFilter(flat);
  // Ko'rinish: URL ustun; bo'lmasa cookie (ViewToggle yozgan); standart — to'r
  const viewInUrl = flat.view === "list" || flat.view === "grid";
  const cookieView: View = jar.get(VIEW_COOKIE)?.value === "list" ? "list" : "grid";
  const view: View = viewInUrl ? (flat.view as View) : cookieView;

  // Kirgan foydalanuvchiga "faqat ro'yxatdan o'tganlarga" darajadagi shahar ko'rinadi
  const session = await getSession();
  const viewer = { userId: session?.sub ?? null, role: session?.role ?? null };
  const [result, regionStats, categoryStats, skillStats] = await Promise.all([listSpecialists(filter, viewer), getRegionStats(), getCategoryStats(), getSkillStats(12).catch(() => [])]);

  // Mavjud bo'lmagan sahifa so'ralsa — oxirgi sahifaga; natija umuman yo'q bo'lsa — 1-sahifaga (bo'sh holat matni to'g'ri bo'lsin)
  if (filter.page > 1 && (result.total === 0 || filter.page > result.pages)) {
    redirect(buildHref(BASE, { ...filterToQuery(filter, { view, viewInUrl }), page: result.total > 0 && result.pages > 1 ? String(result.pages) : undefined }));
  }

  const query = filterToQuery(filter, { view, viewInUrl });
  const regionCounts = Object.fromEntries(Object.values(regionStats).map((s) => [s.slug, s.total]));
  const hasFilters = !!(
    filter.q ||
    filter.category ||
    filter.region ||
    filter.priceMin ||
    filter.priceMax ||
    filter.experience ||
    filter.gender ||
    filter.verified === "1" ||
    filter.available === "1" ||
    filter.skill ||
    filter.equipment ||
    filter.workType ||
    filter.openNow === "1"
  );
  // Saqlanadigan qidiruv (F53): faqat filtr kalitlari (sahifa/ko'rinishsiz)
  const savedQuery = pickSavedParams(new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => Boolean(e[1])))).toString();
  const { items, total, page, pages } = result;
  const from = total === 0 ? 0 : (page - 1) * filter.limit + 1;
  const to = Math.min(total, page * filter.limit);
  const gridKey = JSON.stringify(query);
  // Bo'sh natijadagi "Tozalash" — ActiveFilters bilan bir xil: saralash, ko'rinish va sahifa hajmi saqlanadi
  const clearHref = buildHref(BASE, { sort: query.sort, view: query.view, limit: query.limit });

  return (
    <div className="container-x">
      {/* ---------- Sarlavha ---------- */}
      <PageHeader
        size="lg"
        eyebrow={KATALOG.eyebrow[til](REGIONS.length)}
        title={
          <>
            {tr(til, KATALOG.titleStart)} <span className="accent-serif text-accent">{tr(til, KATALOG.titleAccent)}</span>
          </>
        }
        description={tr(til, KATALOG_X.descriptionShort)}
        action={
          <ButtonLink href="/buyurtma-berish" variant="outline" size="md" className="self-start sm:self-auto">
            <Wand2 size={16} className="text-accent" /> {tr(til, KATALOG.wizard)}
          </ButtonLink>
        }
      />

      <div className="mt-8 grid grid-cols-1 gap-6 sm:mt-10 lg:grid-cols-12 lg:items-start">
        {/* ---------- Yon panel (desktop) ---------- */}
        <aside className="hidden min-w-0 lg:col-span-3 lg:block">
          <div className="card sticky top-24 overflow-hidden">
            <div className="max-h-[calc(100dvh-7.5rem)] overflow-y-auto px-5 pb-2 pt-5">
              <Suspense fallback={<FiltersFallback />}>
                <Filters categoryCounts={categoryStats} regionCounts={regionCounts} skillStats={skillStats} />
              </Suspense>
            </div>
          </div>
        </aside>

        {/* ---------- Natijalar ---------- */}
        <section className="min-w-0 lg:col-span-9" aria-labelledby="sp-results-title">
          {/* Asboblar qatori: natija soni (+ oraliq) · filtr/ko'rinish/sahifa hajmi/saralash */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p id="sp-results-title" className="text-[15px] text-fg-2" aria-live="polite">
              <span className="font-display text-[22px] font-semibold tabular-nums text-fg">{total}</span>
              {KATALOG.resultSuffix[til](total)}
              {total > 0 && pages > 1 && (
                <span className="text-fg-3 max-sm:hidden">
                  {" "}
                  · {from}–{to}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2 max-sm:w-full">
              <Suspense fallback={<div className="h-11 w-28 skeleton !rounded-full lg:hidden" />}>
                <MobileFilters categoryCounts={categoryStats} regionCounts={regionCounts} skillStats={skillStats} total={total} className="lg:hidden" />
              </Suspense>
              <Suspense fallback={<div className="h-11 w-24 skeleton !rounded-full max-sm:hidden" />}>
                <ViewToggle className="max-sm:hidden" initial={cookieView} />
              </Suspense>
              <Suspense fallback={<div className="h-11 w-28 skeleton !rounded-full max-sm:hidden" />}>
                <PerPage className="max-sm:hidden" />
              </Suspense>
              <Suspense fallback={<div className="h-11 w-48 skeleton !rounded-full max-sm:flex-1" />}>
                <SortSelect className="max-sm:flex-1 sm:w-52" />
              </Suspense>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <ActiveFilters filter={filter} query={query} basePath={BASE} className="min-w-0 flex-1" />
            {hasFilters && (
              <SaveSearchButton
                query={savedQuery}
                defaultName={describeSavedQuery(savedQuery)}
                loggedIn={Boolean(session)}
                loginHref={`/auth/kirish?next=${encodeURIComponent(buildHref(BASE, query))}`}
              />
            )}
          </div>

          {/* Natijalar — `.stagger` tokeni (inline kechikishlar o'rniga), reduced-motion'da o'chadi */}
          {items.length > 0 ? (
            view === "list" ? (
              <ul key={gridKey} className="stagger mt-5 space-y-2.5">
                {items.map((sp) => (
                  <li key={sp.id}>
                    <SpecialistRow sp={sp} showCompare />
                  </li>
                ))}
              </ul>
            ) : (
              <div key={gridKey} className="stagger mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((sp, i) => (
                  <div key={sp.id}>
                    <SpecialistCard sp={sp} priority={i < 3} showCompare />
                  </div>
                ))}
              </div>
            )
          ) : hasFilters ? (
            <div className="mt-5">
              <EmptyBlock
                title={tr(til, KATALOG.emptyFilteredTitle)}
                description={tr(til, KATALOG.emptyFilteredDesc)}
                action={
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <ButtonLink href={clearHref} variant="outline" size="md">
                      <RotateCcw size={15} /> {tr(til, KATALOG.clearFilters)}
                    </ButtonLink>
                    <ButtonLink href="/buyurtma-berish" variant="accent" size="md">
                      <Wand2 size={15} /> {tr(til, KATALOG.findViaWizard)}
                    </ButtonLink>
                    <ButtonLink href="/ishlar/yangi" variant="outline" size="md">
                      <Megaphone size={15} /> {tr(til, KATALOG.postJobCta)}
                    </ButtonLink>
                  </div>
                }
              />
            </div>
          ) : (
            <div className="mt-5">
              <EmptyBlock
                title={tr(til, KATALOG.emptyNoneTitle)}
                description={tr(til, KATALOG.emptyNoneDesc)}
                action={
                  <ButtonLink href="/auth/royxat?role=specialist" variant="accent" size="md">
                    <UserPlus size={15} /> {tr(til, KATALOG.joinAsSpecialist)}
                  </ButtonLink>
                }
              />
            </div>
          )}

          <Pagination page={page} pages={pages} query={query} basePath={BASE} className="mt-10" />

          {/* Yaqinda ko'rilganlar (localStorage) — bo'sh bo'lsa chiqmaydi */}
          <RecentlyViewed className="mt-10" />
        </section>
      </div>
      {/* Taqqoslash paneli (F54) */}
      <CompareTray />
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { RotateCcw, UserPlus } from "lucide-react";
import { ButtonLink, PageHeader } from "@/components/ui";
import { SpecialistCard } from "@/components/specialists/SpecialistCard";
import { SpecialistRow } from "@/components/specialists/SpecialistRow";
import { Filters, MobileFilters, SortSelect, ViewToggle } from "@/components/specialists/Filters";
import { ActiveFilters } from "@/components/specialists/ActiveFilters";
import { Pagination, buildHref } from "@/components/specialists/Pagination";
import { CATEGORY_BY_SLUG, EXPERIENCE_LEVELS, REGION_BY_SLUG, REGIONS } from "@/lib/constants";
import { getSession } from "@/lib/auth";
import { getCategoryStats, getRegionStats, listSpecialists } from "@/lib/queries";
import { specialistFilterSchema, type SpecialistFilter } from "@/lib/validators";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mutaxassislar",
  description: "O'zbekistonning barcha hududlaridagi videograf, montajor, dizayner va boshqa ijodkorlar — filtrlang, solishtiring va buyurtma bering.",
};

const BASE = "/mutaxassislar";
const DEFAULT_LIMIT = 24;

type RawSearchParams = Record<string, string | string[] | undefined>;
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

  // Noma'lum slug'larni e'tiborsiz qoldiramiz (bo'sh natija o'rniga)
  if (f.region && !REGION_BY_SLUG[f.region]) f.region = undefined;
  if (f.category && !CATEGORY_BY_SLUG[f.category]) f.category = undefined;
  if (f.experience && !EXPERIENCE_LEVELS.some((e) => e.value === f.experience)) f.experience = undefined;
  if (f.verified === "0") f.verified = undefined;
  if (f.priceMax === 0) f.priceMax = undefined;
  if (f.q === "") f.q = undefined;
  return f;
}

/**
 * Minimal narx (?priceMin=) — sxema hali uni bilmaydi, shuning uchun alohida o'qiladi.
 * Sxemaga qo'shilgach listSpecialists ham uni hisobga oladi; UI va URL allaqachon tayyor.
 */
function parsePriceMin(flat: Record<string, string>, priceMax?: number): number | undefined {
  const n = Math.floor(Number(flat.priceMin));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (priceMax && n >= priceMax) return undefined;
  return n;
}

/** Kanonik URL parametrlari (standart qiymatlar yozilmaydi) */
function filterToQuery(f: SpecialistFilter, extra: { priceMin?: number; view: View }): Record<string, string | undefined> {
  return {
    q: f.q || undefined,
    category: f.category || undefined,
    region: f.region || undefined,
    priceMin: extra.priceMin ? String(extra.priceMin) : undefined,
    priceMax: f.priceMax ? String(f.priceMax) : undefined,
    experience: f.experience || undefined,
    gender: f.gender || undefined,
    verified: f.verified === "1" ? "1" : undefined,
    sort: f.sort !== "rating" ? f.sort : undefined,
    view: extra.view === "list" ? "list" : undefined,
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
      <EmptyIllustration className="mb-5 h-auto w-[180px] sm:w-[200px]" />
      <h3 className="font-display text-[18px] font-semibold text-fg">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-fg-3">{description}</p>
      <div className="mt-6">{action}</div>
    </div>
  );
}

export default async function SpecialistsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const flat = flatten(await searchParams);
  const filter = parseFilter(flat);
  const priceMin = parsePriceMin(flat, filter.priceMax);
  const view: View = flat.view === "list" ? "list" : "grid";

  // Kirgan foydalanuvchiga "faqat ro'yxatdan o'tganlarga" darajadagi shahar ko'rinadi
  const session = await getSession();
  const viewer = { userId: session?.sub ?? null, role: session?.role ?? null };
  const [result, regionStats, categoryStats] = await Promise.all([listSpecialists(filter, viewer), getRegionStats(), getCategoryStats()]);

  // Mavjud bo'lmagan sahifa so'ralsa — oxirgi sahifaga qaytaramiz
  if (result.total > 0 && filter.page > result.pages) {
    redirect(buildHref(BASE, { ...filterToQuery(filter, { priceMin, view }), page: result.pages > 1 ? String(result.pages) : undefined }));
  }

  const query = filterToQuery(filter, { priceMin, view });
  const regionCounts = Object.fromEntries(Object.values(regionStats).map((s) => [s.slug, s.total]));
  const hasFilters = !!(filter.q || filter.category || filter.region || priceMin || filter.priceMax || filter.experience || filter.gender || filter.verified === "1");
  const { items, total, page, pages } = result;
  const from = total === 0 ? 0 : (page - 1) * filter.limit + 1;
  const to = Math.min(total, page * filter.limit);
  const gridKey = JSON.stringify(query);

  return (
    <div className="container-x">
      {/* ---------- Sarlavha ---------- */}
      <PageHeader
        size="lg"
        eyebrow={`O'zbekiston bo'ylab · ${REGIONS.length} ta hudud`}
        title={
          <>
            Mutaxassislar <span className="accent-serif text-accent">ro'yxati</span>
          </>
        }
        description="Videograf, montajor, dizayner va boshqa ijodkorlar — hudud, narx, tajriba va jins bo'yicha filtrlang, o'zingizga mosini toping."
      />

      <div className="mt-8 grid grid-cols-1 gap-6 sm:mt-10 lg:grid-cols-12 lg:items-start">
        {/* ---------- Yon panel (desktop) ---------- */}
        <aside className="hidden min-w-0 lg:col-span-3 lg:block">
          <div className="card sticky top-24 overflow-hidden">
            <div className="max-h-[calc(100dvh-7.5rem)] overflow-y-auto px-5 pb-2 pt-5">
              <Suspense fallback={<FiltersFallback />}>
                <Filters categoryCounts={categoryStats} regionCounts={regionCounts} />
              </Suspense>
            </div>
          </div>
        </aside>

        {/* ---------- Natijalar ---------- */}
        <section className="min-w-0 lg:col-span-9" aria-labelledby="sp-results-title">
          {/* Asboblar qatori: natija soni + ko'rinish + saralash */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p id="sp-results-title" className="text-[15px] text-fg-2">
              <span className="font-display text-[22px] font-semibold tabular-nums text-fg">{total}</span> ta mutaxassis
              {total > 0 && pages > 1 && (
                <span className="text-fg-3">
                  {" "}
                  · {from}–{to}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2 max-sm:w-full">
              <Suspense fallback={<div className="h-11 w-28 skeleton !rounded-full lg:hidden" />}>
                <MobileFilters categoryCounts={categoryStats} regionCounts={regionCounts} total={total} className="lg:hidden" />
              </Suspense>
              <Suspense fallback={<div className="h-11 w-24 skeleton !rounded-full max-sm:hidden" />}>
                <ViewToggle className="max-sm:hidden" />
              </Suspense>
              <Suspense fallback={<div className="h-11 w-48 skeleton !rounded-full max-sm:flex-1" />}>
                <SortSelect className="max-sm:flex-1 sm:w-52" />
              </Suspense>
            </div>
          </div>

          <ActiveFilters filter={{ ...filter, priceMin }} query={query} basePath={BASE} className="mt-4" />

          {/* Natijalar */}
          {items.length > 0 ? (
            view === "list" ? (
              <ul key={gridKey} className="mt-5 space-y-2.5">
                {items.map((sp, i) => (
                  <li key={sp.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 11) * 30}ms`, animationDuration: "0.4s" }}>
                    <SpecialistRow sp={sp} />
                  </li>
                ))}
              </ul>
            ) : (
              <div key={gridKey} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((sp, i) => (
                  <div key={sp.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 11) * 35}ms`, animationDuration: "0.45s" }}>
                    <SpecialistCard sp={sp} priority={i < 3} />
                  </div>
                ))}
              </div>
            )
          ) : hasFilters ? (
            <div className="mt-5">
              <EmptyBlock
                title="Hech narsa topilmadi"
                description="Bu shartlarga mos mutaxassis yo'q. Filtrlarni yumshating yoki boshqa hududni tanlab ko'ring."
                action={
                  <ButtonLink href={buildHref(BASE, { sort: query.sort, view: query.view })} variant="outline" size="md">
                    <RotateCcw size={15} /> Filtrlarni tozalash
                  </ButtonLink>
                }
              />
            </div>
          ) : (
            <div className="mt-5">
              <EmptyBlock
                title="Hali mutaxassislar yo'q"
                description="Birinchi bo'lib profil oching — mijozlar sizni shu yerda topsin."
                action={
                  <ButtonLink href="/auth/royxat?role=specialist" variant="accent" size="md">
                    <UserPlus size={15} /> Mutaxassis sifatida qo'shilish
                  </ButtonLink>
                }
              />
            </div>
          )}

          <Pagination page={page} pages={pages} query={query} basePath={BASE} className="mt-10" />
        </section>
      </div>
    </div>
  );
}

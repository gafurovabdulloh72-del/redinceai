import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { RotateCcw, SearchX, Sparkles, UserPlus } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { SpecialistCard } from "@/components/specialists/SpecialistCard";
import { Filters, MobileFilters, SortSelect } from "@/components/specialists/Filters";
import { ActiveFilters } from "@/components/specialists/ActiveFilters";
import { Pagination, buildHref } from "@/components/specialists/Pagination";
import { CATEGORY_BY_SLUG, EXPERIENCE_LEVELS, REGION_BY_SLUG, REGIONS } from "@/lib/constants";
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

/** Kanonik URL parametrlari (standart qiymatlar yozilmaydi) */
function filterToQuery(f: SpecialistFilter): Record<string, string | undefined> {
  return {
    q: f.q || undefined,
    category: f.category || undefined,
    region: f.region || undefined,
    priceMax: f.priceMax ? String(f.priceMax) : undefined,
    experience: f.experience || undefined,
    verified: f.verified === "1" ? "1" : undefined,
    sort: f.sort !== "rating" ? f.sort : undefined,
    limit: f.limit !== DEFAULT_LIMIT ? String(f.limit) : undefined,
    page: f.page > 1 ? String(f.page) : undefined,
  };
}

function FiltersFallback() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-6 w-28 skeleton" />
      <div className="h-11 w-full skeleton !rounded-[18px]" />
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-24 skeleton !rounded-full" />
        ))}
      </div>
      <div className="h-11 w-full skeleton !rounded-[18px]" />
      <div className="h-11 w-full skeleton !rounded-[18px]" />
    </div>
  );
}

export default async function SpecialistsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const filter = parseFilter(flatten(await searchParams));

  const [result, regionStats, categoryStats] = await Promise.all([listSpecialists(filter), getRegionStats(), getCategoryStats()]);

  // Mavjud bo'lmagan sahifa so'ralsa — oxirgi sahifaga qaytaramiz
  if (result.total > 0 && filter.page > result.pages) {
    redirect(buildHref(BASE, { ...filterToQuery(filter), page: result.pages > 1 ? String(result.pages) : undefined }));
  }

  const query = filterToQuery(filter);
  const regionCounts = Object.fromEntries(Object.values(regionStats).map((s) => [s.slug, s.total]));
  const hasFilters = !!(filter.q || filter.category || filter.region || filter.priceMax || filter.experience || filter.verified === "1");
  const { items, total, page, pages } = result;
  const from = total === 0 ? 0 : (page - 1) * filter.limit + 1;
  const to = Math.min(total, page * filter.limit);
  const gridKey = JSON.stringify(query);

  return (
    <div className="container-x">
      {/* ---------- Sarlavha ---------- */}
      <header className="max-w-3xl">
        <span className="glass-weak glass-pill inline-flex items-center gap-2 px-3.5 py-1.5 text-[12px] font-semibold text-tint">
          <Sparkles size={14} /> O'zbekiston bo'ylab · {REGIONS.length} ta hudud
        </span>
        <h1 className="mt-4 text-[28px] font-bold leading-[1.05] tracking-tight text-fg sm:text-4xl">Mutaxassislar</h1>
        <p className="mt-2.5 text-[15px] leading-relaxed text-fg-2 sm:text-[17px]">
          Videograf, montajor, dizayner va boshqa ijodkorlar — hudud, narx va tajriba bo'yicha filtrlang, o'zingizga mosini toping.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        {/* ---------- Yon panel (desktop) ---------- */}
        <aside className="hidden lg:col-span-3 lg:block">
          <div className="glass sticky top-24 overflow-hidden">
            <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto p-5">
              <Suspense fallback={<FiltersFallback />}>
                <Filters categoryCounts={categoryStats} regionCounts={regionCounts} />
              </Suspense>
            </div>
          </div>
        </aside>

        {/* ---------- Natijalar ---------- */}
        <section className="lg:col-span-9" aria-labelledby="sp-results-title">
          {/* Asboblar qatori */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p id="sp-results-title" className="text-[15px] text-fg-2">
              <span className="text-[22px] font-bold tabular-nums text-fg">{total}</span> ta mutaxassis
              {total > 0 && pages > 1 && (
                <span className="text-fg-3">
                  {" "}
                  · {from}–{to}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2 max-sm:w-full">
              <Suspense fallback={<div className="h-10 w-28 skeleton !rounded-full lg:hidden" />}>
                <MobileFilters categoryCounts={categoryStats} regionCounts={regionCounts} total={total} className="lg:hidden" />
              </Suspense>
              <Suspense fallback={<div className="h-10 w-48 skeleton !rounded-full max-sm:flex-1" />}>
                <SortSelect className="max-sm:flex-1 sm:w-56" />
              </Suspense>
            </div>
          </div>

          <ActiveFilters filter={filter} query={query} basePath={BASE} className="mt-4" />

          {/* Kartalar */}
          {items.length > 0 ? (
            <div key={gridKey} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((sp, i) => (
                <div key={sp.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 11) * 35}ms`, animationDuration: "0.45s" }}>
                  <SpecialistCard sp={sp} priority={i < 3} />
                </div>
              ))}
            </div>
          ) : hasFilters ? (
            <div className="mt-5">
              <EmptyState
                icon={SearchX}
                title="Hech narsa topilmadi"
                description="Bu shartlarga mos mutaxassis yo'q. Filtrlarni yumshating yoki boshqa hududni tanlab ko'ring."
                action={
                  <ButtonLink href={buildHref(BASE, { sort: query.sort })} variant="glass" size="sm">
                    <RotateCcw size={14} /> Filtrlarni tozalash
                  </ButtonLink>
                }
              />
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                icon={UserPlus}
                title="Hali mutaxassislar yo'q"
                description="Birinchi bo'lib profil oching — mijozlar sizni xaritadan topsin."
                action={
                  <ButtonLink href="/auth/royxat?role=specialist" size="sm">
                    <UserPlus size={14} /> Mutaxassis sifatida qo'shilish
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

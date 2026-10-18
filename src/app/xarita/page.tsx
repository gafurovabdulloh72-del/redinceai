import type { Metadata } from "next";
import { MapExplorer } from "@/components/map/MapExplorer";
import { PageHeader } from "@/components/ui";
import { CATEGORY_BY_SLUG, GENDERS, REGIONS, REGION_BY_SLUG } from "@/lib/constants";
import { getCategoryStats, getRegionStats } from "@/lib/queries";
import { getJobsByRegion, getRegionJobCounts, getRegionOnlineCounts, getRegionTopSkills, getTopByRegion } from "@/lib/map-stats";
import { tr } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { XARITA } from "@/lib/i18n/dict/search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Xarita",
  description:
    "O'zbekistonning 14 ta hududi bo'ylab videograf, montajor, dizayner va boshqa ijodkorlarni interaktiv xaritadan toping. Hududni bosing — mutaxassislar ro'yxati chiqadi.",
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined) {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && s !== "" ? s : null;
}

export default async function MapPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const [stats, categoryStats, jobCounts, jobsByRegion, onlineCounts, topByRegion, topSkills, til] = await Promise.all([
    getRegionStats(),
    getCategoryStats(),
    getRegionJobCounts(),
    getJobsByRegion(5),
    getRegionOnlineCounts(),
    getTopByRegion(3),
    getRegionTopSkills(3).catch(() => ({})),
    getLocale(),
  ]);

  // Noma'lum slug'lar e'tiborsiz qoldiriladi; ?hudud= — o'zbekcha chuqur havola (?region= bilan teng)
  const regionParam = first(sp.hudud) ?? first(sp.region);
  const categoryParam = first(sp.category);
  const initialRegion = regionParam && REGION_BY_SLUG[regionParam] ? regionParam : null;
  const initialCategory = categoryParam && CATEGORY_BY_SLUG[categoryParam] ? categoryParam : null;
  const genderParam = first(sp.gender);
  const initialGender = GENDERS.find((g) => g.value === genderParam)?.value ?? null;
  const initialMode = first(sp.rejim) === "ish" ? ("ish" as const) : ("mutaxassis" as const);

  const total = REGIONS.reduce((acc, r) => acc + (stats[r.slug]?.total ?? 0), 0);

  return (
    <div className="container-x">
      <PageHeader
        size="lg"
        eyebrow={XARITA.eyebrow[til](REGIONS.length, total)}
        title={
          <>
            {tr(til, XARITA.titleStart)} <span className="accent-serif text-accent">{tr(til, XARITA.titleAccent)}</span> {tr(til, XARITA.titleEnd)}
          </>
        }
        description={tr(til, XARITA.description)}
      />

      <div className="mt-8 sm:mt-10">
        <MapExplorer
          stats={stats}
          categoryStats={categoryStats}
          initialRegion={initialRegion}
          initialCategory={initialCategory}
          initialGender={initialGender}
          initialMode={initialMode}
          jobCounts={jobCounts}
          jobsByRegion={jobsByRegion}
          onlineCounts={onlineCounts}
          topByRegion={topByRegion}
          topSkills={topSkills}
        />
      </div>
    </div>
  );
}

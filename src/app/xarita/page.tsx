import type { Metadata } from "next";
import { MapExplorer } from "@/components/map/MapExplorer";
import { CATEGORY_BY_SLUG, REGIONS, REGION_BY_SLUG } from "@/lib/constants";
import { getCategoryStats, getRegionStats } from "@/lib/queries";

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
  const [stats, categoryStats] = await Promise.all([getRegionStats(), getCategoryStats()]);

  // Noma'lum slug'lar e'tiborsiz qoldiriladi
  const regionParam = first(sp.region);
  const categoryParam = first(sp.category);
  const initialRegion = regionParam && REGION_BY_SLUG[regionParam] ? regionParam : null;
  const initialCategory = categoryParam && CATEGORY_BY_SLUG[categoryParam] ? categoryParam : null;

  const total = REGIONS.reduce((acc, r) => acc + (stats[r.slug]?.total ?? 0), 0);

  return (
    <div className="container-x">
      <header className="max-w-3xl">
        <span className="glass-weak glass-pill inline-flex items-center gap-2 px-3.5 py-1.5 text-[12px] font-semibold text-tint">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-tint opacity-70 animate-pulse-ring" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-tint" />
          </span>
          Jonli xarita · {REGIONS.length} hudud · {total} mutaxassis
        </span>
        <h1 className="mt-4 text-[28px] font-bold leading-[1.05] tracking-tight text-fg sm:text-4xl">Xarita</h1>
        <p className="mt-2.5 text-[15px] leading-relaxed text-fg-2 sm:text-[17px]">
          Hududni bosing — o'sha yerdagi eng yaxshi ijodkorlar chiqadi. Yo'nalishni tanlasangiz, xarita ranglari ham shu yo'nalish bo'yicha o'zgaradi.
        </p>
      </header>

      <div className="mt-6 sm:mt-8">
        <MapExplorer stats={stats} categoryStats={categoryStats} initialRegion={initialRegion} initialCategory={initialCategory} />
      </div>
    </div>
  );
}

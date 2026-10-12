import type { Metadata } from "next";
import { LandingPage, landingMetadata, resolveLanding } from "../../landing";

/** Kategoriya × hudud SEO sahifa (F59): /yonalish/videograf/toshkent-shahri — "Toshkentdagi videograflar" */
export const revalidate = 3600;

type Params = Promise<{ category: string; region: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { category, region: regionSlug } = await params;
  const { cat, region } = resolveLanding(category, regionSlug);
  return landingMetadata(cat, region);
}

export default async function CategoryRegionLandingPage({ params }: { params: Params }) {
  const { category, region: regionSlug } = await params;
  const { cat, region } = resolveLanding(category, regionSlug);
  return <LandingPage cat={cat} region={region} />;
}

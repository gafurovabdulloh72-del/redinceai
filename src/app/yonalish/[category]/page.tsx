import type { Metadata } from "next";
import { LandingPage, landingMetadata, resolveLanding } from "../landing";

/** Kategoriya bo'yicha SEO sahifa (F59): /yonalish/videograf — ma'lumot soatiga bir yangilanadi */
export const revalidate = 3600;

type Params = Promise<{ category: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { category } = await params;
  const { cat, region } = resolveLanding(category);
  return landingMetadata(cat, region);
}

export default async function CategoryLandingPage({ params }: { params: Params }) {
  const { category } = await params;
  const { cat, region } = resolveLanding(category);
  return <LandingPage cat={cat} region={region} />;
}

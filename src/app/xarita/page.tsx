import { redirect } from "next/navigation";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";

export const dynamic = "force-dynamic";

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined) {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && s !== "" ? s : null;
}

/** Xarita olib tashlandi — eski /xarita havolalari ro'yxatga (filtrlar saqlangan holda) yo'naltiriladi */
export default async function MapRedirect({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  const region = first(sp.region);
  const category = first(sp.category);
  if (region && REGION_BY_SLUG[region]) p.set("region", region);
  if (category && CATEGORY_BY_SLUG[category]) p.set("category", category);
  const qs = p.toString();
  redirect(qs ? `/mutaxassislar?${qs}` : "/mutaxassislar");
}

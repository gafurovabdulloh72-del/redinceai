import { handler, ok } from "@/lib/api";
import { getCategoryStats, getRegionStats } from "@/lib/queries";

/** Hudud/yo'nalish bo'yicha sonlar — ko'ruvchiga bog'liq emas, qisqa umumiy kesh (E30) */
export const GET = handler(async () => {
  const [regions, categories] = await Promise.all([getRegionStats(), getCategoryStats()]);
  return ok({ regions, categories }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
});

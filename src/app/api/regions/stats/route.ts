import { handler, ok } from "@/lib/api";
import { getCategoryStats, getRegionStats } from "@/lib/queries";

export const GET = handler(async () => {
  const [regions, categories] = await Promise.all([getRegionStats(), getCategoryStats()]);
  return ok({ regions, categories });
});

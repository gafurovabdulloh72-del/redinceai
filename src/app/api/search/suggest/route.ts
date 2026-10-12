import { handler, ok } from "@/lib/api";
import { suggestSearch } from "@/lib/queries";
import { suggestQuerySchema } from "@/lib/validators";

/**
 * Qidiruv takliflari (F49): ism, ko'nikma, shahar, yo'nalish, hudud — 8 tagacha.
 * Javob ko'ruvchiga bog'liq EMAS (faqat ommaviy ma'lumot: shahar faqat "public" darajadagi profillardan),
 * shuning uchun umumiy kesh 60 soniya.
 */
export const GET = handler(async (req) => {
  const parsed = suggestQuerySchema.safeParse({ q: new URL(req.url).searchParams.get("q") ?? "" });
  const items = parsed.success ? await suggestSearch(parsed.data.q, 8) : [];
  return ok({ items }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
});

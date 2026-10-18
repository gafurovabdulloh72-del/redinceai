/** /vakansiyalar va /vakansiyalar/kasb/[slug] uchun umumiy filtr yordamchilari (sahifa fayllaridan eksport qilib bo'lmaydi) */
import { vacancyFilterSchema, type VacancyFilter } from "@/lib/vacancies/validators";
import { cn } from "@/lib/utils";

export type RawSearch = Record<string, string | string[] | undefined>;

export function flatSearch(raw: RawSearch): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (typeof s === "string" && s !== "") out[k] = s;
  }
  return out;
}

/** Noto'g'ri kalitlar tashlab yuboriladi (422 o'rniga bo'sh filtr) */
export function parseVacancyFilter(flatQ: Record<string, string>): VacancyFilter {
  let res = vacancyFilterSchema.safeParse(flatQ);
  if (!res.success) {
    const bad = new Set(res.error.issues.map((i) => String(i.path[0])));
    res = vacancyFilterSchema.safeParse(Object.fromEntries(Object.entries(flatQ).filter(([k]) => !bad.has(k))));
  }
  return res.success ? res.data : vacancyFilterSchema.parse({});
}

export function vacancyQuery(f: VacancyFilter): Record<string, string | undefined> {
  return {
    q: f.q || undefined,
    profession: f.profession || undefined,
    format: f.format || undefined,
    employment: f.employment || undefined,
    experience: f.experience || undefined,
    region: f.region || undefined,
    min: f.min ? String(f.min) : undefined,
    pay: f.pay || undefined,
    fresh: f.fresh || undefined,
    sort: f.sort !== "newest" ? f.sort : undefined,
    page: f.page > 1 ? String(f.page) : undefined,
  };
}

export const filterChip = (active: boolean) =>
  cn("press inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition", active ? "border-transparent bg-ink text-ink-fg" : "border-line-2 text-fg-2 hover:border-fg hover:text-fg");

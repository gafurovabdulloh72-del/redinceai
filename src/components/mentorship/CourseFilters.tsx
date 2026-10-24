import Link from "next/link";
import { cn } from "@/lib/utils";
import { COURSE_LEVELS, MENTOR_CATEGORIES } from "@/lib/mentorship/format";

export interface FilterState {
  category?: string;
  level?: string;
  price?: "free" | "paid";
  sort: string;
  q?: string;
}

export const COURSE_SORTS = [
  ["new", "Yangilari"],
  ["popular", "Ommabop"],
  ["rating", "Yuqori baho"],
  ["cheap", "Arzonlari"],
  ["expensive", "Qimmatlari"],
] as const;

/** Joriy holatdan bitta kalitni o'zgartirib yangi manzil yasaydi */
export function filterHref(s: FilterState, key: string, val: string | undefined): string {
  const p = new URLSearchParams();
  const put = (k: string, v: string | undefined) => {
    if (v) p.set(k, v);
  };
  put("kasb", key === "kasb" ? val : s.category);
  put("daraja", key === "daraja" ? val : s.level);
  put("q", s.q);
  const price = key === "narx" ? val : s.price === "free" ? "bepul" : s.price === "paid" ? "pulli" : undefined;
  put("narx", price);
  const sort = key === "tartib" ? val : s.sort;
  put("tartib", sort === "new" ? undefined : sort);
  const qs = p.toString();
  return `/mentorlik${qs ? `?${qs}` : ""}`;
}

const pill = (href: string, label: string, active: boolean, key: string) => (
  <Link
    key={key}
    href={href}
    scroll={false}
    className={cn(
      "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[12.5px] font-semibold transition",
      active ? "border-fg bg-fg text-ink-fg" : "border-line text-fg-2 hover:border-fg hover:text-fg",
    )}
  >
    {label}
  </Link>
);

/**
 * Kurs filtrlari (v6): oldin 12 ta chip ikki qatorda edi — endi bitta qator.
 * Yo'nalish — `<details>` menyusi (klient JS'siz), qolgani ixcham pill.
 * Faol filtr bo'lsa «Tozalash» ko'rinadi.
 */
export function CourseFilters({ state, total }: { state: FilterState; total: number }) {
  const { category, level, price, sort } = state;
  const activeCat = MENTOR_CATEGORIES.find((c) => c.key === category);
  const dirty = Boolean(category || level || price || sort !== "new");

  return (
    <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
      {/* Yo'nalish — menyu (chip toshqini bo'lmasin) */}
      <details className="group relative shrink-0">
        <summary
          className={cn(
            "inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-full border px-3 text-[12.5px] font-semibold transition [&::-webkit-details-marker]:hidden",
            activeCat ? "border-fg bg-fg text-ink-fg" : "border-line text-fg-2 hover:border-fg hover:text-fg",
          )}
        >
          {activeCat?.label ?? "Yo'nalish"}
          <span aria-hidden className="text-[10px] opacity-70 transition group-open:rotate-180">▾</span>
        </summary>
        <div className="pop-in absolute left-0 top-full z-20 mt-1 w-[200px] rounded-[14px] bg-surface p-1 shadow-[var(--shadow-3)]">
          <Link href={filterHref(state, "kasb", undefined)} scroll={false} className={cn("block rounded-[10px] px-2.5 py-2 text-[13px] transition hover:bg-fg/5", !category && "font-bold")}>
            Barchasi
          </Link>
          {MENTOR_CATEGORIES.filter((c) => c.key !== "boshqa").map((c) => (
            <Link
              key={c.key}
              href={filterHref(state, "kasb", c.key)}
              scroll={false}
              className={cn("block rounded-[10px] px-2.5 py-2 text-[13px] transition hover:bg-fg/5", category === c.key && "font-bold")}
            >
              {c.label}
            </Link>
          ))}
        </div>
      </details>

      <span className="h-5 w-px shrink-0 bg-line" aria-hidden />
      {pill(filterHref(state, "narx", price === "free" ? undefined : "bepul"), "Bepul", price === "free", "free")}
      {COURSE_LEVELS.map((l) => pill(filterHref(state, "daraja", level === l.key ? undefined : l.key), l.label, level === l.key, `lv-${l.key}`))}

      <span className="h-5 w-px shrink-0 bg-line" aria-hidden />
      <details className="group relative shrink-0">
        <summary
          className={cn(
            "inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-full border px-3 text-[12.5px] font-semibold transition [&::-webkit-details-marker]:hidden",
            sort !== "new" ? "border-fg bg-fg text-ink-fg" : "border-line text-fg-2 hover:border-fg hover:text-fg",
          )}
        >
          {COURSE_SORTS.find(([k]) => k === sort)?.[1] ?? "Yangilari"}
          <span aria-hidden className="text-[10px] opacity-70 transition group-open:rotate-180">▾</span>
        </summary>
        <div className="pop-in absolute right-0 top-full z-20 mt-1 w-[170px] rounded-[14px] bg-surface p-1 shadow-[var(--shadow-3)]">
          {COURSE_SORTS.map(([k, label]) => (
            <Link key={k} href={filterHref(state, "tartib", k)} scroll={false} className={cn("block rounded-[10px] px-2.5 py-2 text-[13px] transition hover:bg-fg/5", sort === k && "font-bold")}>
              {label}
            </Link>
          ))}
        </div>
      </details>

      <span className="ml-auto shrink-0 pl-2 text-[12.5px] text-fg-4">{total} kurs</span>
      {dirty && (
        <Link href="/mentorlik" scroll={false} className="shrink-0 text-[12.5px] font-semibold text-fg-3 transition hover:text-fg">
          Tozalash
        </Link>
      )}
    </div>
  );
}

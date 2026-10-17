import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, FileUser, Plus, Search } from "lucide-react";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { VacancyCard } from "@/components/vacancies/VacancyCard";
import { Pagination, buildHref } from "@/components/specialists/Pagination";
import { getCurrentUser } from "@/lib/auth";
import { REGIONS } from "@/lib/constants";
import { EMPLOYMENT, EXPERIENCE, PROFESSIONS, REMOTE_REGION, WORK_FORMAT } from "@/lib/vacancies/format";
import { listVacancies, vacancyCountsByProfession } from "@/lib/vacancies/service";
import { vacancyFilterSchema, type VacancyFilter } from "@/lib/vacancies/validators";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vakansiyalar — onlayn ish o'rinlari",
  description: "Masofaviy va ofis vakansiyalari: IT, dizayn, video, marketing, kontent, sotuv, moliya, ta'lim. Joylash ham, ariza berish ham bepul.",
  alternates: { canonical: "/vakansiyalar" },
};

const BASE = "/vakansiyalar";
type Raw = Record<string, string | string[] | undefined>;

function flat(raw: Raw): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (typeof s === "string" && s !== "") out[k] = s;
  }
  return out;
}

/** Noto'g'ri kalitlar tashlab yuboriladi (422 o'rniga bo'sh filtr) */
function parseFilter(flatQ: Record<string, string>): VacancyFilter {
  let res = vacancyFilterSchema.safeParse(flatQ);
  if (!res.success) {
    const bad = new Set(res.error.issues.map((i) => String(i.path[0])));
    res = vacancyFilterSchema.safeParse(Object.fromEntries(Object.entries(flatQ).filter(([k]) => !bad.has(k))));
  }
  return res.success ? res.data : vacancyFilterSchema.parse({});
}

function toQuery(f: VacancyFilter): Record<string, string | undefined> {
  return {
    q: f.q || undefined,
    profession: f.profession || undefined,
    format: f.format || undefined,
    employment: f.employment || undefined,
    experience: f.experience || undefined,
    region: f.region || undefined,
    min: f.min ? String(f.min) : undefined,
    sort: f.sort !== "newest" ? f.sort : undefined,
    page: f.page > 1 ? String(f.page) : undefined,
  };
}

const chip = (active: boolean) =>
  cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition", active ? "border-transparent bg-ink text-ink-fg" : "border-line-2 text-fg-2 hover:border-fg hover:text-fg");

/** Vakansiyalar katalogi — barcha onlayn kasblar; filtr GET forma (JS'siz ishlaydi) + kasb chiplari */
export default async function VacanciesPage({ searchParams }: { searchParams: Promise<Raw> }) {
  const f = parseFilter(flat(await searchParams));
  const [result, counts, user] = await Promise.all([listVacancies(f), vacancyCountsByProfession(), getCurrentUser()]);
  const totalOpen = Object.values(counts).reduce((a, b) => a + b, 0);
  const query = toQuery(f);
  const hasFilters = Boolean(f.q || f.profession || f.format || f.employment || f.experience || f.region || f.min);

  return (
    <div className="container-x animate-fade-up">
      <PageHeader
        size="lg"
        eyebrow={`${totalOpen} ta ochiq vakansiya · joylash va ariza bepul`}
        title={
          <>
            Onlayn <span className="accent-serif text-accent">vakansiyalar</span>
          </>
        }
        description="Masofaviy va ofis ish o'rinlari: IT, dizayn, video, marketing, kontent, sotuv, moliya, ta'lim va boshqa onlayn kasblar. Rezyume bilan bir bosishda ariza yuboring."
        action={
          <>
            <ButtonLink href="/vakansiyalar/yangi" variant="accent" size="lg">
              <Plus size={18} /> Vakansiya joylash
            </ButtonLink>
            <ButtonLink href="/rezyumelar" variant="outline" size="lg">
              <FileUser size={18} /> Rezyumelar
            </ButtonLink>
          </>
        }
      />

      <form action={BASE} method="get" className="card mt-8 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_repeat(4,minmax(0,160px))_auto]">
        {f.profession && <input type="hidden" name="profession" value={f.profession} />}
        <label className="relative min-w-0 sm:col-span-2 lg:col-span-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden />
          <input name="q" defaultValue={f.q} maxLength={80} placeholder="Lavozim, kompaniya, ko'nikma…" aria-label="Qidirish" className="field h-11 w-full pl-10 text-[14px]" />
        </label>
        <select name="format" defaultValue={f.format} aria-label="Ish formati" className="field h-11 text-[14px]">
          <option value="">Har qanday format</option>
          {(Object.keys(WORK_FORMAT) as Array<keyof typeof WORK_FORMAT>).map((k) => (
            <option key={k} value={k}>
              {WORK_FORMAT[k]}
            </option>
          ))}
        </select>
        <select name="employment" defaultValue={f.employment} aria-label="Bandlik" className="field h-11 text-[14px]">
          <option value="">Har qanday bandlik</option>
          {(Object.keys(EMPLOYMENT) as Array<keyof typeof EMPLOYMENT>).map((k) => (
            <option key={k} value={k}>
              {EMPLOYMENT[k]}
            </option>
          ))}
        </select>
        <select name="experience" defaultValue={f.experience} aria-label="Tajriba" className="field h-11 text-[14px]">
          <option value="">Har qanday tajriba</option>
          {(Object.keys(EXPERIENCE) as Array<keyof typeof EXPERIENCE>).map((k) => (
            <option key={k} value={k}>
              {EXPERIENCE[k]}
            </option>
          ))}
        </select>
        <select name="region" defaultValue={f.region} aria-label="Hudud" className="field h-11 text-[14px]">
          <option value="">Butun O&apos;zbekiston</option>
          <option value={REMOTE_REGION}>Faqat masofaviy</option>
          {REGIONS.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <select name="sort" defaultValue={f.sort} aria-label="Saralash" className="field h-11 flex-1 text-[14px] lg:hidden">
            <option value="newest">Yangi</option>
            <option value="salary_high">Maosh ↓</option>
          </select>
          <button type="submit" className="btn-ink inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-semibold">
            Qidirish
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={buildHref(BASE, { ...query, profession: undefined, page: undefined })} className={chip(!f.profession)}>
          Barcha kasblar <span className={!f.profession ? "opacity-70" : "text-fg-4"}>{totalOpen}</span>
        </Link>
        {PROFESSIONS.map((p) => {
          const active = f.profession === p.slug;
          const n = counts[p.slug] ?? 0;
          return (
            <Link key={p.slug} href={buildHref(BASE, { ...query, profession: active ? undefined : p.slug, page: undefined })} className={chip(active)}>
              {p.short} {n > 0 && <span className={active ? "opacity-70" : "text-fg-4"}>{n}</span>}
            </Link>
          );
        })}
        <span className="ml-auto hidden items-center gap-2 text-[13px] text-fg-3 lg:inline-flex">
          Saralash:
          <Link href={buildHref(BASE, { ...query, sort: undefined, page: undefined })} className={cn("font-semibold", f.sort === "newest" ? "text-fg" : "hover:text-fg")}>
            Yangi
          </Link>
          <Link href={buildHref(BASE, { ...query, sort: "salary_high", page: undefined })} className={cn("font-semibold", f.sort === "salary_high" ? "text-fg" : "hover:text-fg")}>
            Maosh bo&apos;yicha
          </Link>
        </span>
      </div>

      <section className="mt-6" aria-live="polite">
        {result.items.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={hasFilters ? "Bunday vakansiya topilmadi" : "Hali vakansiyalar yo'q"}
            description={hasFilters ? "Filtrlarni kengaytiring yoki rezyume qoldiring — ish beruvchilar o'zlari topadi." : "Birinchi vakansiyani siz joylang — bepul, 30 kun ro'yxatda turadi."}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {hasFilters && (
                  <ButtonLink href={BASE} variant="outline" size="md">
                    Barcha vakansiyalar
                  </ButtonLink>
                )}
                <ButtonLink href="/vakansiyalar/yangi" variant="accent" size="md">
                  <Plus size={16} /> Vakansiya joylash
                </ButtonLink>
              </div>
            }
          />
        ) : (
          <>
            <p className="mb-3 text-[13px] text-fg-3">
              {result.total} ta vakansiya{hasFilters ? " (filtr bo'yicha)" : ""} · {result.page}/{result.pages}-sahifa
            </p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((v) => (
                <li key={v.id} className="min-w-0">
                  <VacancyCard v={v} />
                </li>
              ))}
            </ul>
            <Pagination page={result.page} pages={result.pages} query={query} basePath={BASE} className="mt-8" />
          </>
        )}
      </section>

      {/* Ikki tomon uchun CTA */}
      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="card flex flex-col gap-3 p-5">
          <span className="icon-tile-soft !rounded-full">
            <FileUser size={18} />
          </span>
          <h2 className="font-display text-[18px] font-semibold text-fg">Ish qidiryapsizmi?</h2>
          <p className="text-[13.5px] leading-relaxed text-fg-2">Rezyume to&apos;ldiring — har bir vakansiyaga bir bosishda ariza yuborasiz, ish beruvchilar esa sizni katalogdan topadi. Kontaktingiz ochiq ko&apos;rsatilmaydi.</p>
          <ButtonLink href={user ? "/kabinet/rezyume" : "/auth/royxat?next=/kabinet/rezyume"} variant="primary" size="md" className="w-fit">
            Rezyume yaratish
          </ButtonLink>
        </div>
        <div className="card flex flex-col gap-3 p-5">
          <span className="icon-tile-soft !rounded-full">
            <Briefcase size={18} />
          </span>
          <h2 className="font-display text-[18px] font-semibold text-fg">Xodim kerakmi?</h2>
          <p className="text-[13.5px] leading-relaxed text-fg-2">Vakansiyani 2 daqiqada joylang — bepul. Arizalar kabinetingizga keladi: nomzodning rezyumesi, xati va kontakti bilan. Holatlarni bir bosishda boshqarasiz.</p>
          <ButtonLink href="/vakansiyalar/yangi" variant="accent" size="md" className="w-fit">
            Vakansiya joylash
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}

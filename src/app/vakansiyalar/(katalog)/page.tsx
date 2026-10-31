import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, Plus, Search, SlidersHorizontal } from "lucide-react";
import { AutoSubmitSelect } from "@/components/ui/AutoSubmitSelect";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { FeedLink } from "@/components/ui/FeedLink";
import { VacancyAlertButton } from "@/components/vacancies/VacancyAlertButton";
import { VacancyCard } from "@/components/vacancies/VacancyCard";
import { Pagination, buildHref } from "@/components/specialists/Pagination";
import { getCurrentUser } from "@/lib/auth";
import { REGIONS } from "@/lib/constants";
import { tr, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { employmentTr, experienceTr, professionLabelTr, workFormatTr } from "@/lib/i18n/dict/vacancies";
import { VAK_KATALOG, VAK_SORT, payFilterTr, salaryChipTr } from "@/lib/i18n/dict/vacancies-catalog";
import { EMPLOYMENT, EXPERIENCE, PAY_FILTER, PROFESSIONS, REMOTE_REGION, SALARY_CHIPS, WORK_FORMAT } from "@/lib/vacancies/format";
import { listVacancies, vacancyCountsByProfession } from "@/lib/vacancies/service";
import type { VacancyFilter } from "@/lib/vacancies/validators";
import { cn } from "@/lib/utils";
import { filterChip as chip, flatSearch as flat, parseVacancyFilter as parseFilter, toQueryString, vacancyQuery as toQuery, type RawSearch as Raw } from "../_shared";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return {
    title: tr(til, VAK_KATALOG.metaTitle),
    other: { "m-title": tr(til, VAK_KATALOG.mTitle) },
    description: tr(til, VAK_KATALOG.metaDescription),
    alternates: { canonical: "/vakansiyalar" },
  };
}

const BASE = "/vakansiyalar";

/** Faol filtrlardan saqlanadigan qidiruv nomi: "Video · Masofaviy" */
function alertName(til: Locale, f: VacancyFilter): string {
  const parts = [f.profession && professionLabelTr(til, f.profession, true), f.format && workFormatTr(til, f.format), f.q && `«${f.q}»`].filter(Boolean) as string[];
  return parts.length ? parts.join(" · ") : tr(til, VAK_KATALOG.alertAll);
}

/** Vakansiyalar katalogi — barcha onlayn kasblar; filtr GET forma (JS'siz ishlaydi) + kasb va tez chiplar */
export default async function VacanciesPage({ searchParams }: { searchParams: Promise<Raw> }) {
  const til = await getLocale();
  const f = parseFilter(flat(await searchParams));
  const [result, counts, user] = await Promise.all([listVacancies(f), vacancyCountsByProfession(), getCurrentUser()]);
  const query = toQuery(f);
  // Sahifa diapazondan tashqarida — oxirgi sahifaga (bo'sh «topilmadi» o'rniga)
  if (result.total > 0 && f.page > result.pages) redirect(buildHref(BASE, { ...query, page: result.pages > 1 ? String(result.pages) : undefined }));
  const totalOpen = Object.values(counts).reduce((a, b) => a + b, 0);
  const hasFilters = Boolean(f.q || f.profession || f.format || f.employment || f.experience || f.region || f.min || f.pay || f.fresh);
  const advancedActive = Boolean(f.employment || f.experience || f.region);
  const alertQuery = toQueryString({ ...query, page: undefined, sort: undefined, fresh: undefined });
  const postLabel = tr(til, VAK_KATALOG.postVacancy);

  return (
    <div className="container-x animate-fade-up">
      <PageHeader
        size="lg"
        eyebrow={VAK_KATALOG.eyebrow[til](totalOpen)}
        title={
          <>
            {tr(til, VAK_KATALOG.titleStart)} <span className="accent-serif text-accent">{tr(til, VAK_KATALOG.titleAccent)}</span>
          </>
        }
        description={tr(til, VAK_KATALOG.description)}
        action={
          <>
            <ButtonLink href="/vakansiyalar/yangi" variant="accent" size="lg">
              <Plus size={18} /> {postLabel}
            </ButtonLink>
            <FeedLink href="/vakansiyalar/feed.xml" title={tr(til, VAK_KATALOG.rssTitle)} className="max-sm:hidden" />
            <ButtonLink href="/rezyumelar" variant="outline" size="lg">
              {tr(til, VAK_KATALOG.resumes)}
            </ButtonLink>
          </>
        }
      />

      {/* Telefonda: ixcham — «Qidirish» tugmasi yo'q (Enter/klaviatura «Qidirish»), format tanlansa darhol qidiradi */}
      <form action={BASE} method="get" className="card mt-8 grid gap-3 p-3 m-flat max-sm:mt-4 max-sm:px-0 max-sm:pb-3 lg:grid-cols-[1fr_minmax(0,160px)_auto]">
        {f.profession && <input type="hidden" name="profession" value={f.profession} />}
        {f.min > 0 && <input type="hidden" name="min" value={f.min} />}
        {f.pay && <input type="hidden" name="pay" value={f.pay} />}
        <label className="relative min-w-0">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden />
          <input name="q" defaultValue={f.q} maxLength={80} enterKeyHint="search" placeholder={tr(til, VAK_KATALOG.searchPlaceholder)} aria-label={tr(til, VAK_KATALOG.searchAria)} className="field h-11 w-full pl-10 text-[14px]" />
        </label>
        <AutoSubmitSelect name="format" defaultValue={f.format} aria-label={tr(til, VAK_KATALOG.formatAria)} className="field h-11 text-[14px]">
          <option value="">{tr(til, VAK_KATALOG.anyFormat)}</option>
          {(Object.keys(WORK_FORMAT) as Array<keyof typeof WORK_FORMAT>).map((k) => (
            <option key={k} value={k}>
              {workFormatTr(til, k)}
            </option>
          ))}
        </AutoSubmitSelect>
        <button type="submit" className="btn-ink press inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-semibold max-sm:hidden">
          {tr(til, VAK_KATALOG.searchBtn)}
        </button>
        {/* Qo'shimcha filtrlar — telefonda yig'ilgan (details), faol bo'lsa ochiq */}
        <details className="group min-w-0 lg:col-span-3" open={advancedActive}>
          <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-fg-2 hover:text-fg [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal size={14} aria-hidden /> {tr(til, VAK_KATALOG.moreFilters)}
            {advancedActive && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
          </summary>
          <div className="expand-in mt-2 grid gap-3 sm:grid-cols-3">
            <select name="employment" defaultValue={f.employment} aria-label={tr(til, VAK_KATALOG.employmentAria)} className="field h-11 text-[14px]">
              <option value="">{tr(til, VAK_KATALOG.anyEmployment)}</option>
              {(Object.keys(EMPLOYMENT) as Array<keyof typeof EMPLOYMENT>).map((k) => (
                <option key={k} value={k}>
                  {employmentTr(til, k)}
                </option>
              ))}
            </select>
            <select name="experience" defaultValue={f.experience} aria-label={tr(til, VAK_KATALOG.experienceAria)} className="field h-11 text-[14px]">
              <option value="">{tr(til, VAK_KATALOG.anyExperience)}</option>
              {(Object.keys(EXPERIENCE) as Array<keyof typeof EXPERIENCE>).map((k) => (
                <option key={k} value={k}>
                  {experienceTr(til, k)}
                </option>
              ))}
            </select>
            <select name="region" defaultValue={f.region} aria-label={tr(til, VAK_KATALOG.regionAria)} className="field h-11 text-[14px]">
              <option value="">{tr(til, VAK_KATALOG.wholeUz)}</option>
              <option value={REMOTE_REGION}>{tr(til, VAK_KATALOG.remoteOnly)}</option>
              {REGIONS.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </details>
      </form>

      {/* Kasb chiplari */}
      <nav aria-label={tr(til, VAK_KATALOG.professionsAria)} className="-mx-4 mt-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          <li>
            <Link href={buildHref(BASE, { ...query, profession: undefined, page: undefined })} className={chip(!f.profession)} aria-current={!f.profession ? "page" : undefined}>
              {tr(til, VAK_KATALOG.allProfessions)} <span className={!f.profession ? "opacity-70" : "text-fg-4"}>{totalOpen}</span>
            </Link>
          </li>
          {PROFESSIONS.map((p) => {
            const active = f.profession === p.slug;
            const n = counts[p.slug] ?? 0;
            return (
              <li key={p.slug}>
                <Link href={buildHref(BASE, { ...query, profession: active ? undefined : p.slug, page: undefined })} className={chip(active)} aria-current={active ? "page" : undefined}>
                  {professionLabelTr(til, p.slug, true)} {n > 0 && <span className={active ? "opacity-70" : "text-fg-4"}>{n}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Tez filtrlar: masofaviy, yangi, maosh, kelishiladi */}
      <div className="-mx-4 mt-2 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
        <div className="flex w-max items-center gap-2 sm:w-auto sm:flex-wrap" role="group" aria-label={tr(til, VAK_KATALOG.quickFiltersAria)}>
          <Link href={buildHref(BASE, { ...query, format: f.format === "remote" ? undefined : "remote", page: undefined })} className={chip(f.format === "remote")} aria-pressed={f.format === "remote"}>
            {tr(til, VAK_KATALOG.remote)}
          </Link>
          <Link href={buildHref(BASE, { ...query, fresh: f.fresh ? undefined : "1", page: undefined })} className={chip(f.fresh === "1")} aria-pressed={f.fresh === "1"}>
            {tr(til, VAK_KATALOG.fresh)}
          </Link>
          {SALARY_CHIPS.map((c) => {
            const on = f.min === c.min;
            return (
              <Link key={c.min} href={buildHref(BASE, { ...query, min: on ? undefined : String(c.min), pay: undefined, page: undefined })} className={chip(on)} aria-pressed={on}>
                {salaryChipTr(til, c.label)}
              </Link>
            );
          })}
          {(Object.keys(PAY_FILTER) as Array<keyof typeof PAY_FILTER>).map((k) => {
            const on = f.pay === k;
            return (
              <Link key={k} href={buildHref(BASE, { ...query, pay: on ? undefined : k, min: k === "neg" ? undefined : query.min, page: undefined })} className={chip(on)} aria-pressed={on}>
                {payFilterTr(til, k)}
              </Link>
            );
          })}
        </div>
      </div>

      <section className="mt-6" aria-live="polite">
        {result.items.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={hasFilters ? tr(til, VAK_KATALOG.emptyFilteredTitle) : tr(til, VAK_KATALOG.emptyNoneTitle)}
            description={hasFilters ? tr(til, VAK_KATALOG.emptyFilteredDesc) : tr(til, VAK_KATALOG.emptyNoneDesc)}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {hasFilters && (
                  <ButtonLink href={BASE} variant="outline" size="md">
                    {tr(til, VAK_KATALOG.allVacancies)}
                  </ButtonLink>
                )}
                {hasFilters && <VacancyAlertButton query={alertQuery} defaultName={alertName(til, f)} loggedIn={Boolean(user)} />}
                {!hasFilters && (
                  <ButtonLink href="/vakansiyalar/yangi" variant="accent" size="md">
                    <Plus size={16} /> {postLabel}
                  </ButtonLink>
                )}
              </div>
            }
          />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-fg-3">
              <p>
                {VAK_KATALOG.resultCount[til](result.total)}
                {hasFilters ? tr(til, VAK_KATALOG.byFilter) : ""}
                {result.pages > 1 ? VAK_KATALOG.pageOf[til](result.page, result.pages) : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2">
                  {tr(til, VAK_KATALOG.sortLabel)}
                  {(["newest", "salary_high", "applications"] as const).map((k) => (
                    <Link key={k} href={buildHref(BASE, { ...query, sort: k === "newest" ? undefined : k, page: undefined })} className={cn("font-semibold", f.sort === k ? "text-fg underline underline-offset-4" : "hover:text-fg")} aria-current={f.sort === k ? "true" : undefined}>
                      {tr(til, VAK_SORT[k])}
                    </Link>
                  ))}
                </span>
                <VacancyAlertButton query={alertQuery} defaultName={alertName(til, f)} loggedIn={Boolean(user)} />
              </div>
            </div>
            <ul className="stagger grid gap-4 max-sm:gap-0 max-sm:divide-y max-sm:divide-line max-sm:border-y max-sm:border-line sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="card flex flex-col gap-2 p-5">
          <h2 className="font-display text-[18px] font-semibold text-fg">{tr(til, VAK_KATALOG.seekerTitle)}</h2>
          <p className="text-[13.5px] leading-relaxed text-fg-2">{tr(til, VAK_KATALOG.seekerDesc)}</p>
          <ButtonLink href={user ? "/kabinet/rezyume" : "/auth/royxat?next=/kabinet/rezyume"} variant="primary" size="md" className="mt-2 w-fit">
            {tr(til, VAK_KATALOG.createResume)}
          </ButtonLink>
        </div>
        <div className="card flex flex-col gap-2 p-5">
          <h2 className="font-display text-[18px] font-semibold text-fg">{tr(til, VAK_KATALOG.employerTitle)}</h2>
          <p className="text-[13.5px] leading-relaxed text-fg-2">{tr(til, VAK_KATALOG.employerDesc)}</p>
          <ButtonLink href="/vakansiyalar/yangi" variant="accent" size="md" className="mt-2 w-fit">
            {postLabel}
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}

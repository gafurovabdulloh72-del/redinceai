import type { Metadata } from "next";
import { AutoSubmitSelect } from "@/components/ui/AutoSubmitSelect";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileUser, Search } from "lucide-react";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { ResumeCard } from "@/components/vacancies/ResumeCard";
import { Pagination, buildHref } from "@/components/specialists/Pagination";
import { getCurrentUser } from "@/lib/auth";
import { REGIONS } from "@/lib/constants";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { VAK, professionLabelTr, resumeExperienceTr, resumeFormatTr } from "@/lib/i18n/dict/vacancies";
import { REZ_KATALOG, candidatesCountTr } from "@/lib/i18n/dict/vacancies-kabinet";
import { PROFESSIONS, REMOTE_REGION, RESUME_EXPERIENCE, RESUME_FORMAT } from "@/lib/vacancies/format";
import { getResume, listResumes } from "@/lib/vacancies/service";
import { resumeFilterSchema, type ResumeFilter } from "@/lib/vacancies/validators";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return {
    title: tr(til, REZ_KATALOG.metaTitle),
    other: { "m-title": tr(til, REZ_KATALOG.mTitle) },
    description: tr(til, REZ_KATALOG.metaDescription),
    alternates: { canonical: "/rezyumelar" },
  };
}

const BASE = "/rezyumelar";
type Raw = Record<string, string | string[] | undefined>;

function flat(raw: Raw): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (typeof s === "string" && s !== "") out[k] = s;
  }
  return out;
}
function parseFilter(flatQ: Record<string, string>): ResumeFilter {
  let res = resumeFilterSchema.safeParse(flatQ);
  if (!res.success) {
    const bad = new Set(res.error.issues.map((i) => String(i.path[0])));
    res = resumeFilterSchema.safeParse(Object.fromEntries(Object.entries(flatQ).filter(([k]) => !bad.has(k))));
  }
  return res.success ? res.data : resumeFilterSchema.parse({});
}
const chip = (active: boolean) =>
  cn("press inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition", active ? "border-transparent bg-ink text-ink-fg" : "border-line-2 text-fg-2 hover:border-fg hover:text-fg");

/** Rezyumelar katalogi — ish beruvchilar uchun; kontaktsiz, aloqa sayt ichidagi chat orqali */
export default async function ResumesPage({ searchParams }: { searchParams: Promise<Raw> }) {
  const f = parseFilter(flat(await searchParams));
  const [user, til] = await Promise.all([getCurrentUser(), getLocale()]);
  const [result, mine] = await Promise.all([listResumes(f), user ? getResume(user.id) : Promise.resolve(null)]);
  const query = { q: f.q || undefined, profession: f.profession || undefined, experience: f.experience || undefined, format: f.format || undefined, region: f.region || undefined, page: f.page > 1 ? String(f.page) : undefined };
  const hasFilters = Boolean(f.q || f.profession || f.experience || f.format || f.region);
  // Sahifa diapazondan tashqarida — oxirgi sahifaga
  if (result.total > 0 && f.page > result.pages) redirect(buildHref(BASE, { ...query, page: result.pages > 1 ? String(result.pages) : undefined }));

  return (
    <div className="container-x animate-fade-up">
      <PageHeader
        size="lg"
        eyebrow={candidatesCountTr(til, result.total)}
        title={
          <>
            {tr(til, REZ_KATALOG.titleStart)} <span className="accent-serif text-accent">{tr(til, REZ_KATALOG.titleAccent)}</span>
          </>
        }
        description={tr(til, REZ_KATALOG.description)}
        action={
          <>
            <ButtonLink href={user ? "/kabinet/rezyume" : "/auth/royxat?next=/kabinet/rezyume"} variant="accent" size="lg">
              <FileUser size={18} /> {mine ? tr(til, REZ_KATALOG.updateResume) : tr(til, REZ_KATALOG.createResume)}
            </ButtonLink>
            <ButtonLink href="/vakansiyalar" variant="outline" size="lg">
              {tr(til, VAK.vacancies)}
            </ButtonLink>
          </>
        }
      />

      <form action={BASE} method="get" className="card mt-8 grid gap-3 p-3 max-sm:mt-4 max-sm:!border-0 max-sm:!bg-transparent max-sm:!p-0 sm:grid-cols-2 lg:grid-cols-[1fr_repeat(3,minmax(0,170px))_auto]">
        {f.profession && <input type="hidden" name="profession" value={f.profession} />}
        <label className="relative min-w-0 sm:col-span-2 lg:col-span-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden />
          <input name="q" defaultValue={f.q} maxLength={80} enterKeyHint="search" placeholder={tr(til, REZ_KATALOG.searchPlaceholder)} aria-label={tr(til, VAK.search)} className="field h-11 w-full pl-10 text-[14px]" />
        </label>
        {/* Telefon: uch tanlov bitta qatorda, o'zgarganda avtomatik yuboriladi (tugma yashirin) */}
        <div className="grid grid-cols-3 gap-2 sm:contents">
        <AutoSubmitSelect name="experience" defaultValue={f.experience} aria-label={tr(til, VAK.experience)} className="field h-11 min-w-0 text-[14px] max-sm:pl-2.5 max-sm:text-[13px]">
          <option value="">{tr(til, VAK.experience)}</option>
          {(Object.keys(RESUME_EXPERIENCE) as Array<keyof typeof RESUME_EXPERIENCE>).map((k) => (
            <option key={k} value={k}>
              {resumeExperienceTr(til, k)}
            </option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="format" defaultValue={f.format} aria-label={tr(til, VAK.format)} className="field h-11 min-w-0 text-[14px] max-sm:pl-2.5 max-sm:text-[13px]">
          <option value="">{tr(til, REZ_KATALOG.formatAny)}</option>
          {(Object.keys(RESUME_FORMAT) as Array<keyof typeof RESUME_FORMAT>).map((k) => (
            <option key={k} value={k}>
              {resumeFormatTr(til, k)}
            </option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="region" defaultValue={f.region} aria-label={tr(til, VAK.region)} className="field h-11 min-w-0 text-[14px] max-sm:pl-2.5 max-sm:text-[13px]">
          <option value="">{tr(til, VAK.region)}</option>
          <option value={REMOTE_REGION}>{tr(til, REZ_KATALOG.remoteOnly)}</option>
          {REGIONS.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </AutoSubmitSelect>
        </div>
        <button type="submit" className="btn-ink inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-semibold max-sm:hidden sm:col-span-2 lg:col-span-1">
          {tr(til, VAK.search)}
        </button>
      </form>

      <nav aria-label={tr(til, REZ_KATALOG.professionsAria)} className="-mx-4 mt-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          <li>
            <Link href={buildHref(BASE, { ...query, profession: undefined, page: undefined })} className={chip(!f.profession)} aria-current={!f.profession ? "page" : undefined}>
              {tr(til, REZ_KATALOG.allProfessions)}
            </Link>
          </li>
          {PROFESSIONS.map((p) => (
            <li key={p.slug}>
              <Link href={buildHref(BASE, { ...query, profession: f.profession === p.slug ? undefined : p.slug, page: undefined })} className={chip(f.profession === p.slug)} aria-current={f.profession === p.slug ? "page" : undefined}>
                {professionLabelTr(til, p.slug, true)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="mt-6" aria-live="polite">
        {result.items.length === 0 ? (
          <EmptyState
            icon={FileUser}
            title={hasFilters ? tr(til, REZ_KATALOG.emptyFilteredTitle) : tr(til, REZ_KATALOG.emptyNoneTitle)}
            description={hasFilters ? tr(til, REZ_KATALOG.emptyFilteredDesc) : tr(til, REZ_KATALOG.emptyNoneDesc)}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {hasFilters && (
                  <ButtonLink href={BASE} variant="outline" size="md">
                    {tr(til, REZ_KATALOG.allResumes)}
                  </ButtonLink>
                )}
                <ButtonLink href={user ? "/kabinet/rezyume" : "/auth/royxat?next=/kabinet/rezyume"} variant="accent" size="md">
                  {tr(til, REZ_KATALOG.createResume)}
                </ButtonLink>
              </div>
            }
          />
        ) : (
          <>
            <p className="mb-3 text-[13px] text-fg-3">
              {candidatesCountTr(til, result.total)}
              {hasFilters ? tr(til, REZ_KATALOG.byFilter) : ""}
              {result.pages > 1 ? REZ_KATALOG.pageOf[til](result.page, result.pages) : ""}
            </p>
            <ul className="stagger grid gap-4 max-sm:gap-0 max-sm:divide-y max-sm:divide-line max-sm:border-y max-sm:border-line sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((r) => (
                <li key={r.id} className="min-w-0">
                  <ResumeCard r={r} />
                </li>
              ))}
            </ul>
            <Pagination page={result.page} pages={result.pages} query={query} basePath={BASE} className="mt-8" />
          </>
        )}
      </section>
    </div>
  );
}

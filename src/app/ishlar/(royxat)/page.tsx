import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, BriefcaseBusiness, ClipboardList, Plus, RotateCcw } from "lucide-react";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { JobCard } from "@/components/jobs/JobCard";
import { JobFilters } from "@/components/jobs/JobFilters";
import { Pagination, buildHref } from "@/components/specialists/Pagination";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORIES, CATEGORY_BY_SLUG } from "@/lib/constants";
import { tr } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { localizePrice, priceFromLabel, priceToLabel } from "@/lib/i18n/dict/catalog";
import { ISHLAR } from "@/lib/i18n/dict/jobs";
import { getProposerContext, listJobs, openJobCategoryCounts } from "@/lib/jobs/queries";
import { jobRegionLabel } from "@/lib/jobs/format";
import { jobFilterSchema, type JobFilter } from "@/lib/jobs/validators";
import { SUBSCRIPTION_HREF } from "@/lib/jobs/service";
import { cn, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ishlar — ochiq e'lonlar",
  description: "Mijozlarning ochiq loyihalari: videosyomka, montaj, dizayn, animatsiya va boshqalar. Mos e'lonni toping va taklif yuboring.",
  alternates: { canonical: "/ishlar" },
};

const BASE = "/ishlar";
const DEFAULT_LIMIT = 12;
type RawSearchParams = Record<string, string | string[] | undefined>;

function flatten(raw: RawSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (typeof s === "string" && s !== "") out[k] = s;
  }
  return out;
}

/** Noto'g'ri kalitlar tashlab yuboriladi (422 o'rniga) */
function parseFilter(flat: Record<string, string>): JobFilter {
  let res = jobFilterSchema.safeParse(flat);
  if (!res.success) {
    const bad = new Set(res.error.issues.map((i) => String(i.path[0])));
    res = jobFilterSchema.safeParse(Object.fromEntries(Object.entries(flat).filter(([k]) => !bad.has(k))));
  }
  const f: JobFilter = res.success ? res.data : jobFilterSchema.parse({});
  if (f.q === "") f.q = undefined;
  if (f.min === 0) f.min = undefined;
  if (f.max === 0) f.max = undefined;
  return f;
}

function toQuery(f: JobFilter): Record<string, string | undefined> {
  return {
    q: f.q || undefined,
    category: f.category || undefined,
    region: f.region || undefined,
    min: f.min ? String(f.min) : undefined,
    max: f.max ? String(f.max) : undefined,
    sort: f.sort !== "newest" ? f.sort : undefined,
    limit: f.limit !== DEFAULT_LIMIT ? String(f.limit) : undefined,
    page: f.page > 1 ? String(f.page) : undefined,
  };
}

export default async function JobsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const til = await getLocale();
  const filter = parseFilter(flatten(await searchParams));
  const user = await getCurrentUser();
  const isSpecialist = user?.role === "specialist";
  const [result, catCounts, proposer] = await Promise.all([
    listJobs(filter),
    openJobCategoryCounts(),
    isSpecialist && user ? getProposerContext(user.id) : Promise.resolve(null),
  ]);

  if (result.total > 0 && filter.page > result.pages) {
    redirect(buildHref(BASE, { ...toQuery(filter), page: result.pages > 1 ? String(result.pages) : undefined }));
  }

  const query = toQuery(filter);
  const totalOpen = Object.values(catCounts).reduce((a, b) => a + b, 0);
  const hasFilters = Boolean(filter.q || filter.category || filter.region || filter.min || filter.max);
  const chipHref = (category?: string) => buildHref(BASE, { ...query, category, page: undefined });
  const postHref = "/ishlar/yangi";
  const canPost = !user || user.role === "client";

  const summary: string[] = [];
  if (filter.category) summary.push(CATEGORY_BY_SLUG[filter.category]?.name ?? filter.category);
  if (filter.region) summary.push(filter.region === "remote" ? tr(til, ISHLAR.f.remote) : jobRegionLabel(filter.region, true));
  if (filter.min || filter.max) {
    summary.push(
      filter.min && filter.max
        ? localizePrice(til, `${formatPrice(filter.min, { compact: true })} – ${formatPrice(filter.max, { compact: true })}`)
        : filter.min
          ? priceFromLabel(til, formatPrice(filter.min, { compact: true }))
          : priceToLabel(til, formatPrice(filter.max!, { compact: true })),
    );
  }

  return (
    <div className="container-x">
      <PageHeader
        size="lg"
        eyebrow={ISHLAR.eyebrow[til](totalOpen)}
        title={
          <>
            {tr(til, ISHLAR.titleStart)} <span className="accent-serif text-accent">{tr(til, ISHLAR.titleAccent)}</span>
          </>
        }
        description={tr(til, ISHLAR.description)}
        action={
          canPost ? (
            <ButtonLink href={postHref} variant="accent" size="lg">
              <Plus size={18} /> {tr(til, ISHLAR.postJob)}
            </ButtonLink>
          ) : isSpecialist ? (
            <ButtonLink href="/kabinet/takliflar" variant="outline" size="lg">
              <ClipboardList size={18} /> {tr(til, ISHLAR.myProposals)}
            </ButtonLink>
          ) : undefined
        }
      />

      {proposer && !proposer.canPropose && (
        <div role="status" className="mt-6 flex flex-col gap-3 rounded-[var(--r-md)] border border-warning/30 bg-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2.5 text-[14px] font-medium text-warning-text">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            {tr(til, ISHLAR.subInactiveBanner)}
          </p>
          <ButtonLink href={SUBSCRIPTION_HREF} variant="primary" size="md" className="shrink-0">
            {tr(til, ISHLAR.renewSub)}
          </ButtonLink>
        </div>
      )}

      {/* Yo'nalish chiplari */}
      <nav aria-label={tr(til, ISHLAR.categoriesAria)} className="-mx-4 mt-8 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:mt-10 sm:px-0">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          <li>
            <Link
              href={chipHref(undefined)}
              aria-current={!filter.category ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold transition",
                !filter.category ? "btn-ink border-transparent" : "border-line bg-surface text-fg-2 hover:border-line-2 hover:text-fg",
              )}
            >
              {tr(til, ISHLAR.all)} <span className={cn("tabular-nums", filter.category ? "text-fg-4" : "opacity-70")}>{totalOpen}</span>
            </Link>
          </li>
          {CATEGORIES.map((c) => {
            const on = filter.category === c.slug;
            const n = catCounts[c.slug] ?? 0;
            return (
              <li key={c.slug}>
                <Link
                  href={chipHref(on ? undefined : c.slug)}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-[13px] font-semibold transition",
                    on ? "btn-ink border-transparent" : "border-line bg-surface text-fg-2 hover:border-line-2 hover:text-fg",
                  )}
                >
                  <CategoryIcon icon={c.icon} size={14} aria-hidden="true" />
                  {c.name}
                  <span className={cn("tabular-nums", on ? "opacity-70" : "text-fg-4")}>{n}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-4">
        <JobFilters key={JSON.stringify(query)} values={{ q: filter.q, category: filter.category, region: filter.region, min: filter.min, max: filter.max, sort: filter.sort }} />
      </div>

      <section aria-labelledby="jobs-results" className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p id="jobs-results" className="text-[15px] text-fg-2" aria-live="polite">
            <span className="font-display text-[22px] font-semibold tabular-nums text-fg">{result.total}</span>
            {ISHLAR.resultSuffix[til](result.total)}
            {summary.length > 0 && <span className="text-fg-3"> · {summary.join(" · ")}</span>}
            {filter.q && <span className="text-fg-3"> · «{filter.q}»</span>}
          </p>
          {proposer?.canPropose && (
            <p className="text-[13px] font-medium text-fg-3">
              {ISHLAR.proposalsLeft[til](proposer.remaining, proposer.limit).pre}
              <span className="font-semibold tabular-nums text-fg">{ISHLAR.proposalsLeft[til](proposer.remaining, proposer.limit).strong}</span>
              {ISHLAR.proposalsLeft[til](proposer.remaining, proposer.limit).post}
            </p>
          )}
        </div>

        {result.items.length > 0 ? (
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.items.map((job, i) => (
              <li key={job.id} className="animate-fade-up min-w-0" style={{ animationDelay: `${Math.min(i, 11) * 30}ms`, animationDuration: "0.4s" }}>
                <JobCard job={job} til={til} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState
              icon={BriefcaseBusiness}
              title={hasFilters ? tr(til, ISHLAR.emptyFilteredTitle) : tr(til, ISHLAR.emptyNoneTitle)}
              description={hasFilters ? tr(til, ISHLAR.emptyFilteredDesc) : tr(til, ISHLAR.emptyNoneDesc)}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {canPost && (
                    <ButtonLink href={postHref} variant="accent" size="md">
                      <Plus size={15} /> {tr(til, ISHLAR.postJob)}
                    </ButtonLink>
                  )}
                  {hasFilters && (
                    <ButtonLink href={BASE} variant="outline" size="md">
                      <RotateCcw size={15} /> {tr(til, ISHLAR.clearFilters)}
                    </ButtonLink>
                  )}
                </div>
              }
            />
          </div>
        )}

        <Pagination page={result.page} pages={result.pages} query={query} basePath={BASE} className="mt-10" />
      </section>
    </div>
  );
}

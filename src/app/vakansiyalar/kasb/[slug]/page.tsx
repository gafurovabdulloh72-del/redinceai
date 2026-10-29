import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Briefcase, Plus } from "lucide-react";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { FeedLink } from "@/components/ui/FeedLink";
import { VacancyAlertButton } from "@/components/vacancies/VacancyAlertButton";
import { VacancyCard } from "@/components/vacancies/VacancyCard";
import { Pagination, buildHref } from "@/components/specialists/Pagination";
import { getCurrentUser } from "@/lib/auth";
import { PROFESSIONS, PROFESSION_BY_SLUG, WORK_FORMAT } from "@/lib/vacancies/format";
import { listVacancies, vacancyCountsByProfession } from "@/lib/vacancies/service";
import { SITE_URL } from "@/lib/site-url";
import { filterChip, flatSearch, parseVacancyFilter, toQueryString, vacancyQuery, type RawSearch } from "../../_shared";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return PROFESSIONS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const p = PROFESSION_BY_SLUG[slug];
  if (!p) return { title: "Kasb topilmadi", robots: { index: false } };
  return {
    title: `${p.name} — vakansiyalar`,
    description: `${p.name} bo'yicha ochiq vakansiyalar: masofaviy va ofis ish o'rinlari, maosh va talablar bilan. Ariza berish bepul.`,
    alternates: { canonical: `/vakansiyalar/kasb/${p.slug}` },
  };
}

/** Kasb bo'yicha SEO sahifa: /vakansiyalar?profession=<slug> bilan bir xil ro'yxat, lekin alohida sarlavha, canonical va ItemList JSON-LD */
export default async function ProfessionVacanciesPage({ params, searchParams }: { params: Params; searchParams: Promise<RawSearch> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const p = PROFESSION_BY_SLUG[slug];
  if (!p) notFound();
  const base = `/vakansiyalar/kasb/${p.slug}`;
  const f = parseVacancyFilter({ ...flatSearch(sp), profession: p.slug });
  const [result, counts, user] = await Promise.all([listVacancies(f), vacancyCountsByProfession(), getCurrentUser()]);
  const query = { ...vacancyQuery(f), profession: undefined };
  if (result.total > 0 && f.page > result.pages) redirect(buildHref(base, { ...query, page: result.pages > 1 ? String(result.pages) : undefined }));

  const itemList = result.items.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `${p.name} — vakansiyalar`,
        itemListElement: result.items.map((v, i) => ({ "@type": "ListItem", position: (f.page - 1) * f.limit + i + 1, url: `${SITE_URL}/vakansiyalar/${v.id}`, name: v.title })),
      }
    : null;

  return (
    <div className="container-x animate-fade-up">
      {itemList && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList).replace(/</g, "\\u003c") }} />}
      <nav aria-label="Yo'l" className="text-[13px] text-fg-3">
        <Link href="/vakansiyalar" className="transition hover:text-fg">
          Vakansiyalar
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-fg-2">{p.short}</span>
      </nav>
      <PageHeader
        size="lg"
        className="mt-4"
        eyebrow={`${counts[p.slug] ?? 0} ta ochiq vakansiya`}
        title={
          <>
            {p.name} <span className="accent-serif text-accent">vakansiyalari</span>
          </>
        }
        description={`${p.name} bo'yicha masofaviy va ofis ish o'rinlari — maosh va talablar bilan. Ariza berish bepul.`}
        action={
          <ButtonLink href="/vakansiyalar/yangi" variant="accent" size="lg">
            <Plus size={18} /> Vakansiya joylash
          </ButtonLink>
        }
      />

      <nav aria-label="Kasblar" className="-mx-4 mt-6 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {PROFESSIONS.map((x) => (
            <li key={x.slug}>
              <Link href={`/vakansiyalar/kasb/${x.slug}`} className={filterChip(x.slug === p.slug)} aria-current={x.slug === p.slug ? "page" : undefined}>
                {x.short} {(counts[x.slug] ?? 0) > 0 && <span className={x.slug === p.slug ? "opacity-70" : "text-fg-4"}>{counts[x.slug]}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Tez filtrlar">
        {(Object.keys(WORK_FORMAT) as Array<keyof typeof WORK_FORMAT>).map((k) => (
          <Link key={k} href={buildHref(base, { ...query, format: f.format === k ? undefined : k, page: undefined })} className={filterChip(f.format === k)} aria-pressed={f.format === k}>
            {WORK_FORMAT[k]}
          </Link>
        ))}
        <VacancyAlertButton query={toQueryString({ profession: p.slug, format: f.format || undefined })} defaultName={`${p.short}${f.format ? ` · ${WORK_FORMAT[f.format]}` : ""}`} loggedIn={Boolean(user)} className="ml-auto" />
        {/* Faqat shu kasb bo'yicha RSS — umumiy lentada boshqa yo'nalishlar shovqin bo'ladi */}
        <FeedLink href={`/vakansiyalar/kasb/${p.slug}/feed.xml`} label="RSS" title={`${p.name} vakansiyalari RSS lentasi`} />
      </div>

      <section className="mt-6" aria-live="polite">
        {result.items.length === 0 ? (
          <EmptyState icon={Briefcase} title={`${p.short} bo'yicha ochiq vakansiya yo'q`} description="Qidiruvni saqlang — mos vakansiya chiqsa xabar beramiz, yoki boshqa kasbni tanlang." action={<ButtonLink href="/vakansiyalar" variant="outline" size="md">Barcha vakansiyalar</ButtonLink>} />
        ) : (
          <>
            <ul className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((v) => (
                <li key={v.id} className="min-w-0">
                  <VacancyCard v={v} />
                </li>
              ))}
            </ul>
            <Pagination page={result.page} pages={result.pages} query={query} basePath={base} className="mt-8" />
          </>
        )}
      </section>
    </div>
  );
}

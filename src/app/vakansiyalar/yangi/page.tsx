import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { VacancyForm, type VacancyFormInitial } from "@/components/vacancies/VacancyForm";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { tr } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { VAK_YANGI } from "@/lib/i18n/dict/vacancies-catalog";
import { loadVacancy } from "@/lib/vacancies/service";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, VAK_YANGI.metaTitle), robots: { index: false, follow: false } };
}

/**
 * Yangi vakansiya — har qanday kirgan foydalanuvchi (kompaniya ham, shaxs ham), bepul.
 * `?nusxa=<id>` — o'z vakansiyasidan nusxa: maydonlar to'ldirilgan holda yangi e'lon (admin ham).
 */
export default async function NewVacancyPage({ searchParams }: { searchParams: Promise<{ nusxa?: string | string[] }> }) {
  const [user, sp, til] = await Promise.all([getCurrentUser(), searchParams, getLocale()]);
  if (!user) redirect(await loginRedirectPath("/vakansiyalar/yangi"));
  const nusxa = Array.isArray(sp.nusxa) ? sp.nusxa[0] : sp.nusxa;
  let initial: VacancyFormInitial | undefined;
  if (nusxa) {
    const src = await loadVacancy(nusxa);
    if (src && (src.authorId === user.id || user.role === "admin")) {
      initial = { ...src, salaryMin: src.salaryMin, salaryMax: src.salaryMax, expired: false, status: "open" };
    }
  }
  return (
    <div className="container-x animate-fade-up">
      <nav aria-label={tr(til, VAK_YANGI.breadcrumbAria)} className="mb-5 text-[13px] text-fg-3">
        <Link href="/vakansiyalar" className="transition hover:text-fg">
          {tr(til, VAK_YANGI.vacancies)}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-fg-2">{tr(til, VAK_YANGI.newVacancy)}</span>
      </nav>
      <PageHeader
        eyebrow={initial ? tr(til, VAK_YANGI.eyebrowCopy) : tr(til, VAK_YANGI.eyebrowFree)}
        title={
          <>
            {tr(til, VAK_YANGI.titleStart)} <span className="accent-serif text-accent">{tr(til, VAK_YANGI.titleAccent)}</span>
          </>
        }
        description={tr(til, VAK_YANGI.description)}
      />
      <div className="mt-8 max-w-3xl">
        <VacancyForm mode="create" initial={initial} />
      </div>
    </div>
  );
}

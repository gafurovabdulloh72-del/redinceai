import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { VacancyForm } from "@/components/vacancies/VacancyForm";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getVacancyView } from "@/lib/vacancies/service";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { VAK_AI } from "@/lib/i18n/dict/vacancies-ai";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, VAK_AI.editTitle), robots: { index: false, follow: false } };
}

export default async function EditVacancyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, til] = await Promise.all([getCurrentUser(), getLocale()]);
  if (!user) redirect(await loginRedirectPath(`/vakansiyalar/${id}/tahrir`));
  const v = await getVacancyView(id, { id: user.id, role: user.role });
  if (!v) notFound();
  if (!v.isOwner) redirect(`/vakansiyalar/${id}`);
  return (
    <div className="container-x animate-fade-up">
      <nav aria-label={tr(til, VAK_AI.editCrumb)} className="mb-5 text-[13px] text-fg-3">
        <Link href="/kabinet/vakansiyalar" className="transition hover:text-fg">
          {tr(til, VAK_AI.editMine)}
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/vakansiyalar/${v.id}`} className="transition hover:text-fg">
          {v.title}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-fg-2">{tr(til, VAK_AI.editCrumb)}</span>
      </nav>
      <PageHeader eyebrow="Vakansiya" title={v.title} description={VAK_AI.editStats[til](v.applicationsCount, v.viewCount, v.expired ? tr(til, VAK_AI.stateExpired) : v.status === "closed" ? tr(til, VAK_AI.stateClosed) : "")} />
      <div className="mt-8 max-w-3xl">
        <VacancyForm
          mode="edit"
          initial={{
            id: v.id,
            title: v.title,
            company: v.company,
            profession: v.profession,
            description: v.description,
            requirements: v.requirements,
            format: v.format,
            employment: v.employment,
            experience: v.experience,
            salaryMin: v.salaryMin,
            salaryMax: v.salaryMax,
            regionSlug: v.regionSlug,
            skills: v.skills,
            applyUrl: v.applyUrl,
            status: v.status,
            expired: v.expired,
            screening: v.screeningFull,
          }}
        />
      </div>
    </div>
  );
}

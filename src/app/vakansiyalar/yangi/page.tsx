import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { VacancyForm, type VacancyFormInitial } from "@/components/vacancies/VacancyForm";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { loadVacancy } from "@/lib/vacancies/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vakansiya joylash", robots: { index: false, follow: false } };

/**
 * Yangi vakansiya — har qanday kirgan foydalanuvchi (kompaniya ham, shaxs ham), bepul.
 * `?nusxa=<id>` — o'z vakansiyasidan nusxa: maydonlar to'ldirilgan holda yangi e'lon (admin ham).
 */
export default async function NewVacancyPage({ searchParams }: { searchParams: Promise<{ nusxa?: string | string[] }> }) {
  const [user, sp] = await Promise.all([getCurrentUser(), searchParams]);
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
      <nav aria-label="Yo'l" className="mb-5 text-[13px] text-fg-3">
        <Link href="/vakansiyalar" className="transition hover:text-fg">
          Vakansiyalar
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-fg-2">Yangi vakansiya</span>
      </nav>
      <PageHeader
        eyebrow={initial ? "Nusxa · maydonlar to'ldirilgan" : "Bepul · 30 kun ro'yxatda"}
        title={
          <>
            Vakansiya <span className="accent-serif text-accent">joylash</span>
          </>
        }
        description="Lavozim, format, maosh va talablarni yozing. Arizalar rezyume va kontakt bilan kabinetingizga keladi."
      />
      <div className="mt-8 max-w-3xl">
        <VacancyForm mode="create" initial={initial} />
      </div>
    </div>
  );
}

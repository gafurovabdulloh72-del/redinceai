import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { VacancyForm } from "@/components/vacancies/VacancyForm";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vakansiya joylash", robots: { index: false, follow: false } };

/** Yangi vakansiya — har qanday kirgan foydalanuvchi (kompaniya ham, shaxs ham), bepul */
export default async function NewVacancyPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/vakansiyalar/yangi"));
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
        eyebrow="Bepul · 30 kun ro'yxatda"
        title={
          <>
            Vakansiya <span className="accent-serif text-accent">joylash</span>
          </>
        }
        description="Lavozim, format, maosh va talablarni yozing. Arizalar rezyume, xat va nomzod kontakti bilan kabinetingizga keladi — sizga Telegram va sayt bildirishnomasi boradi."
      />
      <div className="mt-8 max-w-3xl">
        <VacancyForm mode="create" />
      </div>
    </div>
  );
}

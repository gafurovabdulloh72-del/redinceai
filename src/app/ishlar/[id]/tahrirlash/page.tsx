import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ButtonLink, PageHeader } from "@/components/ui";
import { JobForm } from "@/components/jobs/JobForm";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getJobRow } from "@/lib/jobs/queries";
import { firstName } from "@/lib/jobs/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "E'lonni tahrirlash", robots: { index: false, follow: false } };

/** Faqat egasi; mutaxassis tanlangan (hired) e'lon tahrirlanmaydi */
export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath(`/ishlar/${id}/tahrirlash`));
  const job = await getJobRow(id);
  if (!job || job.clientId !== user.id) notFound();
  if (job.status === "hired") redirect(`/ishlar/${id}`);

  return (
    <div className="container-x">
      <ButtonLink href={`/ishlar/${id}`} variant="ghost" size="sm" className="-ml-3 mb-4 !h-10">
        <ArrowLeft size={15} /> E'longa qaytish
      </ButtonLink>
      <PageHeader
        title={
          <>
            E'lonni <span className="accent-serif text-accent">tahrirlash</span>
          </>
        }
        description="O'zgarishlar darhol ko'rinadi. Yuborilgan takliflar saqlanib qoladi."
      />
      <div className="mt-8 max-w-3xl">
        <JobForm
          initial={{
            id: job.id,
            title: job.title,
            description: job.description,
            category: job.category,
            regionSlug: job.regionSlug,
            budgetType: job.budgetType,
            budgetMin: job.budgetMin,
            budgetMax: job.budgetMax,
            deadline: job.deadline,
            skills: job.skills,
          }}
          clientFirstName={firstName(user.name)}
          emailVerified={user.emailVerified}
        />
      </div>
    </div>
  );
}

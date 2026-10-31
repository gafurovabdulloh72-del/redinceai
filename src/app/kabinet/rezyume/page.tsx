import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
import { KAB_REZ, KAB_VAK } from "@/lib/i18n/dict/vacancies-kabinet";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { ResumeForm } from "@/components/vacancies/ResumeForm";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getResume } from "@/lib/vacancies/service";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, KABINET_NAV.titles["Rezyumem"])  };
}

/** Rezyume tahriri — bitta rezyume; ommaviy bo'lsa /rezyumelar katalogida */
export default async function MyResumePage() {
  const [user, til] = await Promise.all([getCurrentUser(), getLocale()]);
  if (!user) redirect(await loginRedirectPath("/kabinet/rezyume"));
  const r = await getResume(user.id);
  return (
    <div className="animate-fade-up">
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="eyebrow">{tr(til, KAB_VAK.kabinet)}</span>
          <h1 className="display-xl mt-4 text-[32px] text-fg sm:text-[40px]">
            {tr(til, KAB_REZ.titleStart)} <span className="accent-serif text-accent">{tr(til, KAB_REZ.titleAccent)}</span>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-2">
            {r ? (r.isPublic ? KAB_REZ.publicSummary[til](r.viewCount) : tr(til, KAB_REZ.privateSummary)) : tr(til, KAB_REZ.intro)}
          </p>
        </div>
        {r && (
          <Link href={`/rezyumelar/${r.id}`} className="press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg-2 hover:text-fg">
            <ExternalLink size={14} /> {tr(til, KAB_REZ.preview)}
          </Link>
        )}
      </header>
      <div className="max-w-3xl">
        <ResumeForm
          initial={
            r
              ? { id: r.id, title: r.title, profession: r.profession, summary: r.summary, skills: r.skills, experience: r.experience, expectedSalary: r.expectedSalary, format: r.format, regionSlug: r.regionSlug, links: r.links, isPublic: r.isPublic }
              : null
          }
        />
      </div>
    </div>
  );
}

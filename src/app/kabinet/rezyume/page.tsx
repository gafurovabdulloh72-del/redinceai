import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
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
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/rezyume"));
  const r = await getResume(user.id);
  return (
    <div className="animate-fade-up">
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="eyebrow">Kabinet</span>
          <h1 className="display-xl mt-4 text-[32px] text-fg sm:text-[40px]">
            Mening <span className="accent-serif text-accent">rezyumem</span>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-2">
            {r ? (r.isPublic ? `Katalogda ko'rinadi va arizalaringizga biriktiriladi · ${r.viewCount} marta ko'rilgan.` : "Faqat arizalaringizga biriktiriladi (katalogda ko'rinmaydi).") : "Bir marta to'ldiring — har vakansiyaga bir bosishda ariza yuborasiz, ish beruvchilar sizni katalogdan topadi."}
          </p>
        </div>
        {r && (
          <Link href={`/rezyumelar/${r.id}`} className="press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg-2 hover:text-fg">
            <ExternalLink size={14} /> Qanday ko&apos;rinadi
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

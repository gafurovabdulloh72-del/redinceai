import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, FileUser, Send } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/vacancies/ApplicantsList";
import { WithdrawButton } from "@/components/vacancies/WithdrawButton";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { professionLabel, salaryLabel, WORK_FORMAT } from "@/lib/vacancies/format";
import { getResume, myApplications } from "@/lib/vacancies/service";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Arizalarim" };

/** Nomzod kabineti: yuborilgan arizalar va holatlari */
export default async function MyApplicationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/arizalarim"));
  const [items, resume] = await Promise.all([myApplications(user.id), getResume(user.id)]);
  const active = items.filter((a) => a.status !== "rejected").length;

  return (
    <div className="animate-fade-up">
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="eyebrow">
            <Send size={13} className="text-accent" /> Kabinet
          </span>
          <h1 className="display-xl mt-4 text-[32px] text-fg sm:text-[40px]">
            Mening <span className="accent-serif text-accent">arizalarim</span>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-2">
            {items.length > 0 ? `${active} ta faol ariza. Ish beruvchi javobi shu yerda va bildirishnomada ko'rinadi.` : "Vakansiyalarga yuborgan arizalaringiz va holatlari shu yerda."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {!resume && (
            <ButtonLink href="/kabinet/rezyume" variant="outline" size="md">
              <FileUser size={16} /> Rezyume yaratish
            </ButtonLink>
          )}
          <ButtonLink href="/vakansiyalar" variant="accent" size="md">
            <Briefcase size={16} /> Vakansiyalar
          </ButtonLink>
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon={Send}
          title="Hali ariza yubormagansiz"
          description={resume ? "Vakansiyalarni ko'ring — rezyumeingiz bilan bir bosishda ariza yuborasiz." : "Avval rezyume to'ldiring (2 daqiqa) — keyin har vakansiyaga bir bosishda ariza yuborasiz."}
          action={
            <ButtonLink href={resume ? "/vakansiyalar" : "/kabinet/rezyume"} variant="accent" size="md">
              {resume ? "Vakansiyalarga o'tish" : "Rezyume yaratish"}
            </ButtonLink>
          }
        />
      ) : (
        <ul className="grid gap-3">
          {items.map((a) => (
            <li key={a.id} className="card p-4 sm:p-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={a.status} />
                    {(a.vacancy.status !== "open" || a.vacancy.expired) && <span className="text-[12px] text-fg-3">· vakansiya yopilgan</span>}
                    <span className="text-[12px] text-fg-4" suppressHydrationWarning>
                      {timeAgo(a.createdAt)}
                    </span>
                  </div>
                  <h2 className="mt-1.5 font-display text-[17px] font-semibold leading-snug text-fg">
                    <Link href={`/vakansiyalar/${a.vacancy.id}`} className="underline-offset-4 hover:underline">
                      {a.vacancy.title}
                    </Link>
                  </h2>
                  <p className="mt-1 text-[13px] text-fg-2">
                    {a.vacancy.company || "Shaxsiy ish beruvchi"} · {professionLabel(a.vacancy.profession, true)} · {WORK_FORMAT[a.vacancy.format]} · {salaryLabel(a.vacancy.salaryMin, a.vacancy.salaryMax)}
                  </p>
                  {a.coverLetter && <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-fg-3">{a.coverLetter}</p>}
                </div>
                {a.status === "new" && (
                  <div className="shrink-0">
                    <WithdrawButton applicationId={a.id} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

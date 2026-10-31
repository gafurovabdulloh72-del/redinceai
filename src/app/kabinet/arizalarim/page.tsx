import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, FileUser, Send } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/vacancies/ApplicantsList";
import { WithdrawButton } from "@/components/vacancies/WithdrawButton";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { APPLICATION_TABS, applicationTabOf, professionLabel, salaryLabel, slaHint, WORK_FORMAT, type ApplicationTab } from "@/lib/vacancies/format";
import { getResume, myApplications, mySavedVacancies, suggestedVacanciesForUser } from "@/lib/vacancies/service";
import { VacancyCard } from "@/components/vacancies/VacancyCard";
import { cn, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, KABINET_NAV.titles["Arizalarim"])  };
}

/** Nomzod kabineti: yuborilgan arizalar (holat bo'limlari, «ko'rildi» vaqti, javobsizlik ishorasi), mos vakansiyalar, saqlanganlar */
export default async function MyApplicationsPage({ searchParams }: { searchParams: Promise<{ holat?: string | string[] }> }) {
  const [user, sp] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect(await loginRedirectPath("/kabinet/arizalarim"));
  const holat = Array.isArray(sp.holat) ? sp.holat[0] : sp.holat;
  const tab: ApplicationTab = APPLICATION_TABS.some((t) => t.key === holat) ? (holat as ApplicationTab) : "";
  const [items, resume, saved] = await Promise.all([myApplications(user.id), getResume(user.id), mySavedVacancies(user.id)]);
  const suggested = resume ? await suggestedVacanciesForUser(user.id, resume.profession, 3) : [];
  const counts: Record<ApplicationTab, number> = { "": items.length, faol: 0, qabul: 0, rad: 0 };
  for (const a of items) counts[applicationTabOf(a.status)] += 1;
  const list = tab ? items.filter((a) => applicationTabOf(a.status) === tab) : items;

  return (
    <div className="animate-fade-up">
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="eyebrow">Kabinet</span>
          <h1 className="display-xl mt-4 text-[32px] text-fg sm:text-[40px]">
            Mening <span className="accent-serif text-accent">arizalarim</span>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-2">
            {items.length > 0 ? `${counts.faol} ta faol ariza. Ish beruvchi javobi shu yerda va bildirishnomada ko'rinadi.` : "Vakansiyalarga yuborgan arizalaringiz va holatlari shu yerda."}
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
        <>
          <nav aria-label="Arizalar holati" className="mb-4 -mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
            <div className="segment w-max">
              {APPLICATION_TABS.map((t) => (
                <Link key={t.key || "all"} href={t.key ? `/kabinet/arizalarim?holat=${t.key}` : "/kabinet/arizalarim"} data-active={tab === t.key} aria-current={tab === t.key ? "page" : undefined} className="segment-item inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap">
                  {t.label} <span className="tabular-nums opacity-70">{counts[t.key]}</span>
                </Link>
              ))}
            </div>
          </nav>
          {list.length === 0 ? (
            <EmptyState icon={Send} title="Bu bo'limda ariza yo'q" description="Boshqa bo'limni tanlang." />
          ) : (
            <ul className="stagger grid gap-3 max-sm:gap-0">
              {list.map((a) => {
                const closed = a.vacancy.status !== "open" || a.vacancy.expired;
                const waiting = slaHint(a.status, a.createdAt);
                return (
                  <li key={a.id} className={cn("card m-flat min-w-0 p-4 sm:p-5", a.status === "rejected" && "opacity-80")}>
                    <div className="flex min-w-0 flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1 basis-[240px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={a.status} />
                          {closed && <span className="text-[12px] text-fg-3">· vakansiya yopilgan</span>}
                          <span className="text-[12px] text-fg-4" suppressHydrationWarning>
                            {timeAgo(a.createdAt)}
                          </span>
                          {a.viewedAt && a.status !== "new" && (
                            <span className="text-[12px] text-fg-3" suppressHydrationWarning>
                              · ko&apos;rildi {timeAgo(a.viewedAt)}
                            </span>
                          )}
                          {waiting && !closed && <span className="text-[12px] font-semibold text-warning-text">· {waiting}</span>}
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
                      {(a.status === "new" || a.status === "viewed") && !closed && (
                        <div className="shrink-0">
                          <WithdrawButton applicationId={a.id} />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {suggested.length > 0 && (
        <section className="mt-10" aria-labelledby="suggest-h">
          <h2 id="suggest-h" className="font-display text-[20px] font-semibold text-fg">
            Sizga mos yangi vakansiyalar <span className="text-[14px] font-semibold text-fg-3">{professionLabel(resume!.profession, true)}</span>
          </h2>
          <ul className="stagger mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {suggested.map((v) => (
              <li key={v.id} className="min-w-0">
                <VacancyCard v={v} headingLevel="h3" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {saved.length > 0 && (
        <section className="mt-10" aria-labelledby="saved-h">
          <h2 id="saved-h" className="font-display text-[20px] font-semibold text-fg">
            Saqlangan vakansiyalar <span className="text-[14px] font-semibold text-fg-3">{saved.length}</span>
          </h2>
          <ul className="stagger mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((v) => {
              const off = v.expired || v.status !== "open";
              return (
                <li key={v.id} className="relative min-w-0">
                  <VacancyCard v={v} headingLevel="h3" className={off ? "opacity-70" : undefined} />
                  {off && <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-fg/6 px-2 py-0.5 text-[11px] font-bold text-fg-2">{v.status !== "open" ? "Yopilgan" : "Muddati o'tgan"}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

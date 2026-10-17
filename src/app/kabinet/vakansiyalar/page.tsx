import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, ChevronDown, Clock3, Eye, Pencil, Plus, Users } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { ApplicantsList } from "@/components/vacancies/ApplicantsList";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { professionLabel, salaryLabel, WORK_FORMAT } from "@/lib/vacancies/format";
import { listApplicants, myVacancies } from "@/lib/vacancies/service";
import { cn, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vakansiyalarim" };

/** Ish beruvchi kabineti: vakansiyalar, holat, arizalar (?v=<id> — nomzodlar ochiq) */
export default async function MyVacanciesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, sp] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect(await loginRedirectPath("/kabinet/vakansiyalar"));
  const list = await myVacancies(user.id);
  const openId = typeof sp.v === "string" && list.some((v) => v.id === sp.v) ? sp.v : (list[0]?.id ?? null);
  const applicants = openId ? await listApplicants(openId) : [];
  const live = list.filter((v) => v.status === "open" && !v.expired);
  const newTotal = list.reduce((a, v) => a + v.newApplications, 0);

  return (
    <div className="animate-fade-up">
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="eyebrow">
            <Briefcase size={13} className="text-accent" /> Kabinet
          </span>
          <h1 className="display-xl mt-4 text-[32px] text-fg sm:text-[40px]">
            Mening <span className="accent-serif text-accent">vakansiyalarim</span>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-2">
            {list.length > 0 ? `${live.length} ta ochiq vakansiya${newTotal > 0 ? ` · ${newTotal} ta yangi ariza ko'rib chiqishni kutmoqda` : ""}.` : "Vakansiya joylang — arizalar rezyume va kontakt bilan shu yerga keladi. Bepul."}
          </p>
        </div>
        <ButtonLink href="/vakansiyalar/yangi" variant="accent" size="md" className="shrink-0">
          <Plus size={16} /> Yangi vakansiya
        </ButtonLink>
      </header>

      {list.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Hali vakansiya joylamagansiz"
          description="2 daqiqada joylang: lavozim, format, maosh, talablar. 30 kun ro'yxatda turadi, keyin bir bosishda uzaytiriladi."
          action={
            <ButtonLink href="/vakansiyalar/yangi" variant="accent" size="md">
              <Plus size={16} /> Vakansiya joylash
            </ButtonLink>
          }
        />
      ) : (
        <ul className="grid gap-3">
          {list.map((v) => {
            const open = v.id === openId;
            const state = v.status === "closed" ? "Yopilgan" : v.expired ? "Muddati o'tgan" : "Ochiq";
            const tone = v.status === "closed" ? "bg-fg/6 text-fg-2" : v.expired ? "bg-warning-soft text-warning-text" : "bg-success-soft text-success-text";
            const daysLeft = v.expiresAt && !v.expired && v.status === "open" ? Math.max(0, Math.ceil((v.expiresAt - Date.now()) / 86_400_000)) : null;
            return (
              <li key={v.id} className={cn("card p-4 sm:p-5", open && "ring-1 ring-accent/40")}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-[11.5px] font-bold", tone)}>{state}</span>
                      <span className="text-[12px] text-fg-3">
                        {professionLabel(v.profession, true)} · {WORK_FORMAT[v.format]} · {salaryLabel(v.salaryMin, v.salaryMax)}
                      </span>
                    </div>
                    <h2 className="mt-1.5 font-display text-[18px] font-semibold leading-snug text-fg">
                      <Link href={`/vakansiyalar/${v.id}`} className="underline-offset-4 hover:underline">
                        {v.title}
                      </Link>
                    </h2>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-fg-3">
                      <span className="inline-flex items-center gap-1">
                        <Users size={13} /> {v.applicationsCount} ta ariza
                        {v.newApplications > 0 && <span className="ml-1 rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">{v.newApplications} yangi</span>}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Eye size={13} /> {v.viewCount}
                      </span>
                      <span className="inline-flex items-center gap-1" suppressHydrationWarning>
                        <Clock3 size={13} /> {daysLeft !== null ? `${daysLeft} kun qoldi` : timeAgo(v.createdAt)}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <Link href={`/vakansiyalar/${v.id}/tahrir`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3 text-[12.5px] font-semibold text-fg-2 hover:text-fg">
                      <Pencil size={13} /> Tahrirlash
                    </Link>
                    <Link href={open ? "/kabinet/vakansiyalar" : `/kabinet/vakansiyalar?v=${v.id}`} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold", open ? "bg-fg/6 text-fg" : "btn-ink")} aria-expanded={open}>
                      <Users size={13} /> Nomzodlar <ChevronDown size={13} className={cn("transition", open && "rotate-180")} />
                    </Link>
                  </div>
                </div>
                {open && (
                  <div className="mt-4 border-t border-line pt-4">
                    <ApplicantsList vacancyId={v.id} initial={applicants} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

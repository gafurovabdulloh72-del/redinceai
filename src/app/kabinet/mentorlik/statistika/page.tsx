import Link from "next/link";
import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
import { MK, countTa, formatSomTr } from "@/lib/i18n/dict/mentorship";
import { timeAgoLabel } from "@/lib/i18n/dict/catalog";
import type { Locale } from "@/lib/i18n";
import { redirect } from "next/navigation";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getMentorForUser } from "@/lib/mentorship/service";
import { ChevronRight, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui";
import { MentorNav } from "@/components/mentorship/MentorNav";
import { mentorAnalytics } from "@/lib/mentorship/growth";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, KABINET_NAV.titles["Tahlil"]), robots: { index: false, follow: false }  };
}

const somOf = (til: Locale, n: number) => (n ? formatSomTr(til, n) : tr(til, MK.zeroSom));

/** Mentor tahlili: kurs ko'rilishi → yozilish, o'rtacha progress, qaysi darsda talabalar to'xtaydi, efir va daromad manbalari */
export default async function MentorAnalyticsPage() {
  const til = await getLocale();
  const som = (n: number) => somOf(til, n);
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/mentorlik/statistika"));
  const m = await getMentorForUser(user.id);
  if (!m?.isApproved) redirect("/kabinet/mentorlik");
  const a = await mentorAnalytics(m.id, m.channelId);
  return (
    <div>
      {/* Tahlil — Daromad tabining ichki sahifasi (MentorNav 4 tabga qisqartirilgan) */}
      <MentorNav active="daromad" />
      <div className="space-y-5">
        <header>
          <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight text-fg max-sm:hidden">{tr(til, MK.analyticsTitle)}</h1>
          <p className="mt-0.5 text-[13px] text-fg-3 max-sm:hidden">{tr(til, MK.analyticsLead)}</p>
        </header>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={tr(til, MK.lives)} value={countTa(til, a.live.count)} hint={a.live.count ? MK.livesHint[til](a.live.avgPeak, a.live.maxPeak) : tr(til, MK.noLivesYet)} />
          <Stat label={tr(til, MK.ticketSales)} value={countTa(til, a.live.tickets)} hint={som(a.live.ticketRevenue)} />
          <Stat label={tr(til, MK.activeSubs)} value={countTa(til, a.activeSubs)} hint={MK.incomeOf[til](som(a.subRevenue))} />
          <Stat label={tr(til, MK.consultIncome)} value={som(a.consultRevenue)} />
        </section>

        {a.courses.length === 0 && <p className="card p-6 text-center text-[14px] text-fg-3">{tr(til, MK.noCoursesYet)}</p>}
        {a.courses.map((c) => (
          <section key={c.id} className="card m-flat p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="min-w-0 flex-1 truncate text-[15.5px] font-bold text-fg">{c.title}</h2>
              {!c.published && <span className="rounded bg-fg/8 px-2 py-0.5 text-[11px] font-bold text-fg-3">{tr(til, MK.unpublished)}</span>}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-5">
              <Kpi k={tr(til, MK.kpiViews)} v={String(c.views)} />
              <Kpi k={tr(til, MK.kpiEnrolled)} v={`${c.students}${c.conversion ? ` (${c.conversion}%)` : ""}`} />
              <Kpi k={tr(til, MK.kpiAvgProgress)} v={`${c.avgProgress}%`} />
              <Kpi k={tr(til, MK.kpiCompleted)} v={`${c.completed} / ${c.certificates}`} />
              <Kpi k={tr(til, MK.kpiIncome)} v={`${som(c.revenue)}${c.sales ? ` · ${countTa(til, c.sales)}` : ""}`} />
            </dl>
            {c.lessons.length > 0 && c.students > 0 && (
              <div className="mt-4">
                <p className="mb-1.5 text-[12.5px] font-semibold text-fg-3">{tr(til, MK.lessonCompletion)}</p>
                <ul className="space-y-1.5">
                  {c.lessons.map((l, i) => {
                    const prev = i > 0 ? c.lessons[i - 1].pct : 100;
                    const drop = prev - l.pct;
                    return (
                      <li key={l.id} className="flex items-center gap-2.5 text-[12.5px]">
                        <span className="w-5 shrink-0 text-right tabular-nums text-fg-4">{i + 1}</span>
                        <span className="w-40 shrink-0 truncate text-fg-2 sm:w-56">{l.title}</span>
                        <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-fg/8"><span className="block h-full rounded-full bg-accent" style={{ width: `${l.pct}%` }} /></span>
                        <span className="w-9 shrink-0 text-right font-semibold tabular-nums text-fg">{l.pct}%</span>
                        <span className={cn("w-12 shrink-0 text-right text-[11.5px] font-semibold tabular-nums", drop >= 25 ? "text-danger" : "text-fg-4")}>{i > 0 && drop > 0 ? `−${drop}%` : ""}</span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-[11.5px] text-fg-4">{tr(til, MK.dropHint)}</p>
              </div>
            )}
            {c.studentsList.length > 0 && (
              /* Talabalar ro'yxati — kimlar qayerda: progress chizig'i, oxirgi dars, «Yozish» (faqat ommaviy ism/avatar/username) */
              <details className="group mt-4">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-semibold text-fg-2 hover:text-fg [&::-webkit-details-marker]:hidden">
                  <ChevronRight size={14} className="transition group-open:rotate-90" aria-hidden /> {tr(til, MK.students)} · {c.studentsList.length}
                </summary>
                <ul className="mt-2 divide-y divide-line rounded-[14px] border border-line">
                  {c.studentsList.map((st) => (
                    <li key={st.userId} className="flex items-center gap-3 px-3 py-2.5">
                      <Avatar name={st.name} src={st.avatarUrl} size={32} decorative />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13.5px] font-semibold text-fg">{st.name}</span>
                          <span className="shrink-0 text-[12px] font-semibold tabular-nums text-fg-3">{st.progressPct}%</span>
                        </span>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-fg/8"><span className={cn("block h-full rounded-full", st.progressPct >= 100 ? "bg-success" : "bg-accent")} style={{ width: `${Math.max(2, st.progressPct)}%` }} /></span>
                        <span className="mt-1 block truncate text-[11.5px] text-fg-4">
                          {st.lastLesson ? MK.lastLesson[til](st.lastLesson) : tr(til, MK.notStarted)} · {MK.enrolledAgo[til](timeAgoLabel(til, st.enrolledAt))}
                        </span>
                      </span>
                      {st.username && (
                        <Link href={`/yozish/${st.username}`} aria-label={MK.writeTo[til](st.name)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-fg-3 transition hover:border-fg hover:text-fg">
                          <MessageCircle size={14} />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-[12px] font-semibold text-fg-3">{label}</p>
      <p className="mt-1 font-display text-[19px] font-extrabold tabular-nums text-fg">{value}</p>
      {hint && <p className="mt-0.5 text-[11.5px] text-fg-4">{hint}</p>}
    </div>
  );
}
function Kpi({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11.5px] text-fg-3">{k}</dt>
      <dd className="font-bold tabular-nums text-fg">{v}</dd>
    </div>
  );
}

import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
import { MK } from "@/lib/i18n/dict/mentorship";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, ChevronRight, GraduationCap, MessageSquareText, Radio, Route, Sparkles } from "lucide-react";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getMentorForUser, getMentorProfileForEditor, listCoursesOfMentor, listMyEnrollments } from "@/lib/mentorship/service";
import { ApplyBlock, MyEnrollments } from "@/components/mentorship/MentorDashboard";
import { MentorNav } from "@/components/mentorship/MentorNav";
import { MentorSections, MentorStats } from "@/components/mentorship/MentorStudio";
import { LearningStreakCard } from "@/components/mentorship/LearningStreak";
import { learningStreak } from "@/lib/mentorship/streak";
import { listMyWorkReviews, waitingWorkReviewsCount } from "@/lib/mentorship/work-review";
import { MyWorkReviews } from "@/components/mentorship/WorkReview";
import { WR } from "@/lib/i18n/dict/mentorship";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, KABINET_NAV.titles["Mentorlik"]), robots: { index: false, follow: false }  };
}

/**
 * Mentorlik kabineti (2026-11-01 soddalashtirildi).
 * O'QUVCHI (mentor emas): avval O'ZINING kurslari va seriyasi, pastda yig'ilgan «Ustoz bo'lish»
 * (<details>) — oldin katta ariza formasi tepada turib, «Mening kurslarim qani?» degan chalkashlik berardi.
 * USTOZ: 4 tabli MentorNav (Umumiy · Sahifam · Daromad · Vazifalar); Yo'l xaritasi — shu yerdagi havoladan.
 */
export default async function KabinetMentorlikPage() {
  const til = await getLocale();
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/mentorlik"));

  const [mentor, enrollments, streak, myReviews] = await Promise.all([getMentorForUser(user.id), listMyEnrollments(user.id), learningStreak(user.id), listMyWorkReviews(user.id)]);
  const profile = mentor?.isApproved ? await getMentorProfileForEditor(mentor.id, { id: user.id, admin: user.role === "admin" }) : null;
  const courses = profile ? await listCoursesOfMentor(profile.id) : [];
  const reviewsWaiting = profile ? await waitingWorkReviewsCount(profile.id) : 0;
  const pageHref = profile?.slug ? `/mentorlik/ustoz/${profile.slug}` : null;

  return (
    <div>
      {profile && <MentorNav active="umumiy" />}
      <div className="space-y-6">
        {profile ? (
          /* ------------------------- USTOZ ko'rinishi ------------------------- */
          <>
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight text-fg max-sm:hidden">{tr(til, MK.mentorshipTitle)}</h1>
                <p className="mt-0.5 text-[13px] text-fg-3 max-sm:hidden">{tr(til, MK.mentorshipLead)}</p>
              </div>
              {pageHref && (
                <div className="flex flex-wrap gap-2">
                  <Link href={pageHref} className="btn-ink inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold">
                    <Radio size={15} /> {tr(til, MK.postAndLive)}
                  </Link>
                  <Link href={pageHref} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
                    {tr(til, MK.viewPage)} <ArrowUpRight size={14} />
                  </Link>
                </div>
              )}
            </header>
            <MentorStats mentor={profile} courses={courses} />
            {reviewsWaiting > 0 && (
              <Link href="/kabinet/mentorlik/vazifalar#ish-sharhlari" className="card card-hover flex items-center gap-3 border-accent/40 p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><MessageSquareText size={16} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-fg">{WR.waitingCard[til](reviewsWaiting)}</span>
                  <span className="block text-[12.5px] text-fg-3">{tr(til, WR.waitingCardHint)}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-fg-4" />
              </Link>
            )}
            <MentorSections mentor={profile} courses={courses} />
            {/* Yo'l xaritasi — nav 4 tabga qisqargach shu yerdan ochiladi */}
            <Link href="/kabinet/mentorlik/yol-xaritasi" className="card card-hover flex items-center gap-3 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fg/6 text-fg-2"><Route size={16} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold text-fg">{tr(til, MK.roadmaps)}</span>
                <span className="block text-[12.5px] text-fg-3">{tr(til, MK.roadmapsHint)}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-fg-4" />
            </Link>
          </>
        ) : (
          /* ------------------------ O'QUVCHI ko'rinishi ------------------------ */
          <>
            <header>
              <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight text-fg max-sm:hidden">{tr(til, MK.myCourses)}</h1>
              <p className="mt-0.5 text-[13px] text-fg-3 max-sm:hidden">{tr(til, MK.myCoursesLead)}</p>
            </header>
            {enrollments.length === 0 && myReviews.length === 0 && (
              <div className="card grid place-items-center gap-2 p-10 text-center m-flat">
                <GraduationCap size={28} className="text-fg-4" />
                <p className="text-[15px] font-bold text-fg">{tr(til, MK.notEnrolled)}</p>
                <p className="max-w-sm text-[13.5px] text-fg-3">{tr(til, MK.notEnrolledHint)}</p>
                <Link href="/mentorlik" className="btn-accent mt-2 inline-flex h-11 items-center rounded-full px-6 text-[14.5px] font-semibold">
                  {tr(til, MK.browseCourses)}
                </Link>
              </div>
            )}
          </>
        )}

        {/* O'quv seriyasi — faqat kursga yozilganlarga (Duolingo/Coursera odati) */}
        {enrollments.length > 0 && <LearningStreakCard s={streak} />}
        <MyEnrollments
          enrollments={enrollments.map((e) => ({ progressPct: e.progressPct, lastLessonId: e.lastLessonId, title: e.course.title, slug: e.course.slug, coverUrl: e.course.coverUrl, mentorName: e.course.mentor.name, lessonsCount: e.course.lessonsCount }))}
        />
        {/* «Ishimni baholang» — talaba sifatida yuborgan ishlarim va ustoz sharhlari */}
        <MyWorkReviews items={myReviews} />

        {/* «Ustoz bo'lish» — endi yig'ilgan karta (ariza kutilayotganda ochiq turadi) */}
        {!profile && (
          <details open={Boolean(mentor)} className="group">
            <summary className="card flex cursor-pointer list-none items-center gap-3 p-4 transition hover:border-fg/25 [&::-webkit-details-marker]:hidden">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Sparkles size={16} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold text-fg">{tr(til, MK.wantMentor)}</span>
                <span className="block text-[12.5px] text-fg-3">{mentor ? tr(til, MK.applyPending) : tr(til, MK.applyInvite)}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-fg-4 transition group-open:rotate-90" />
            </summary>
            <div className="mt-3">
              <ApplyBlock status={mentor ? "pending" : "none"} mentor={mentor ? { headline: mentor.headline, bio: mentor.bio, expertise: mentor.expertise } : null} />
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

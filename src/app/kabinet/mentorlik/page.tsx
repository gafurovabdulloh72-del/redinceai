import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, ChevronRight, GraduationCap, Radio, Route, Sparkles } from "lucide-react";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getMentorForUser, getMentorProfileForEditor, listCoursesOfMentor, listMyEnrollments } from "@/lib/mentorship/service";
import { ApplyBlock, MyEnrollments } from "@/components/mentorship/MentorDashboard";
import { MentorNav } from "@/components/mentorship/MentorNav";
import { MentorSections, MentorStats } from "@/components/mentorship/MentorStudio";
import { LearningStreakCard } from "@/components/mentorship/LearningStreak";
import { learningStreak } from "@/lib/mentorship/streak";

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
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/mentorlik"));

  const [mentor, enrollments, streak] = await Promise.all([getMentorForUser(user.id), listMyEnrollments(user.id), learningStreak(user.id)]);
  const profile = mentor?.isApproved ? await getMentorProfileForEditor(mentor.id, { id: user.id, admin: user.role === "admin" }) : null;
  const courses = profile ? await listCoursesOfMentor(profile.id) : [];
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
                <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight text-fg max-sm:hidden">Mentorlik</h1>
                <p className="mt-0.5 text-[13px] text-fg-3 max-sm:hidden">Kurslaringiz, talabalar va daromad — hammasi shu yerda</p>
              </div>
              {pageHref && (
                <div className="flex flex-wrap gap-2">
                  <Link href={pageHref} className="btn-ink inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold">
                    <Radio size={15} /> Post va efir qo&apos;yish
                  </Link>
                  <Link href={pageHref} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
                    Sahifani ko&apos;rish <ArrowUpRight size={14} />
                  </Link>
                </div>
              )}
            </header>
            <MentorStats mentor={profile} courses={courses} />
            <MentorSections mentor={profile} courses={courses} />
            {/* Yo'l xaritasi — nav 4 tabga qisqargach shu yerdan ochiladi */}
            <Link href="/kabinet/mentorlik/yol-xaritasi" className="card card-hover flex items-center gap-3 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fg/6 text-fg-2"><Route size={16} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold text-fg">Yo&apos;l xaritalari</span>
                <span className="block text-[12.5px] text-fg-3">Kurslarni ketma-ketlikka yig&apos;ing — talaba keyingi qadamni ko&apos;radi</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-fg-4" />
            </Link>
          </>
        ) : (
          /* ------------------------ O'QUVCHI ko'rinishi ------------------------ */
          <>
            <header>
              <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight text-fg max-sm:hidden">Mening kurslarim</h1>
              <p className="mt-0.5 text-[13px] text-fg-3 max-sm:hidden">Yozilgan kurslaringiz va o&apos;qish jarayoni</p>
            </header>
            {enrollments.length === 0 && (
              <div className="card grid place-items-center gap-2 p-10 text-center m-flat">
                <GraduationCap size={28} className="text-fg-4" />
                <p className="text-[15px] font-bold text-fg">Hali kursga yozilmagansiz</p>
                <p className="max-w-sm text-[13.5px] text-fg-3">Tajribali ustozlardan amaliy kurslar — bepul namunalar bilan. Birini tanlab ko&apos;ring.</p>
                <Link href="/mentorlik" className="btn-accent mt-2 inline-flex h-11 items-center rounded-full px-6 text-[14.5px] font-semibold">
                  Kurslarni ko&apos;rish
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

        {/* «Ustoz bo'lish» — endi yig'ilgan karta (ariza kutilayotganda ochiq turadi) */}
        {!profile && (
          <details open={Boolean(mentor)} className="group">
            <summary className="card flex cursor-pointer list-none items-center gap-3 p-4 transition hover:border-fg/25 [&::-webkit-details-marker]:hidden">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Sparkles size={16} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold text-fg">Ustoz bo&apos;lmoqchimisiz?</span>
                <span className="block text-[12.5px] text-fg-3">{mentor ? "Arizangiz ko'rib chiqilmoqda" : "Bilimingizni ulashing va kurs ochib daromad qiling"}</span>
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

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Radio } from "lucide-react";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getMentorForUser, getMentorProfileForEditor, listCoursesOfMentor, listMyEnrollments } from "@/lib/mentorship/service";
import { ApplyBlock, MyEnrollments } from "@/components/mentorship/MentorDashboard";
import { MentorNav } from "@/components/mentorship/MentorNav";
import { MentorSections, MentorStats } from "@/components/mentorship/MentorStudio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mentorlik", robots: { index: false, follow: false } };

/**
 * Mentorlik kabineti — «Umumiy» (2026-10-24 qayta tuzildi).
 * Oldin bitta sahifada 4 ta navigatsiya kartasi + ko'rsatkichlar + katta tahrir formasi + bo'limlar bor edi
 * (telefonda 2700px+). Endi: navigatsiya — yuqoridagi tab qatori (MentorNav), bu sahifada faqat
 * ko'rsatkichlar va bo'limlar; sahifa ma'lumotlari — `/kabinet/mentorlik/sahifa`.
 */
export default async function KabinetMentorlikPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/mentorlik"));

  const [mentor, enrollments] = await Promise.all([getMentorForUser(user.id), listMyEnrollments(user.id)]);
  const profile = mentor?.isApproved ? await getMentorProfileForEditor(mentor.id, { id: user.id, admin: user.role === "admin" }) : null;
  const courses = profile ? await listCoursesOfMentor(profile.id) : [];
  const pageHref = profile?.slug ? `/mentorlik/ustoz/${profile.slug}` : null;

  return (
    <div>
      {profile && <MentorNav active="umumiy" />}
      <div className="space-y-6">
        {profile ? (
          <>
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight text-fg">Mentorlik</h1>
                <p className="mt-0.5 text-[13px] text-fg-3">Bo&apos;limlar, darslar, talabalar va daromad — hammasi shu bo&apos;limda</p>
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
          </>
        ) : (
          <>
            <header>
              <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight text-fg">Ustoz bo&apos;ling</h1>
            </header>
            <ApplyBlock status={mentor ? "pending" : "none"} mentor={mentor ? { headline: mentor.headline, bio: mentor.bio, expertise: mentor.expertise } : null} />
          </>
        )}
        <MyEnrollments
          enrollments={enrollments.map((e) => ({ progressPct: e.progressPct, lastLessonId: e.lastLessonId, title: e.course.title, slug: e.course.slug, coverUrl: e.course.coverUrl, mentorName: e.course.mentor.name, lessonsCount: e.course.lessonsCount }))}
        />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getMentorForUser, getMentorProfileForEditor, listCoursesOfMentor, listMyEnrollments } from "@/lib/mentorship/service";
import Link from "next/link";
import { BarChart3, ClipboardCheck, Route, Wallet } from "lucide-react";
import { ApplyBlock, MyEnrollments } from "@/components/mentorship/MentorDashboard";
import { MentorStudio } from "@/components/mentorship/MentorStudio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mentorlik", robots: { index: false, follow: false } };

/** Mentor: bitta studiya (sahifa + bo'limlar). Mentor bo'lmagan: qisqa ariza. Pastda — men o'qiyotgan kurslar */
export default async function KabinetMentorlikPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/mentorlik"));

  const [mentor, enrollments] = await Promise.all([getMentorForUser(user.id), listMyEnrollments(user.id)]);
  const profile = mentor?.isApproved ? await getMentorProfileForEditor(mentor.id, { id: user.id, admin: user.role === "admin" }) : null;
  const courses = profile ? await listCoursesOfMentor(profile.id) : [];

  return (
    <div className="space-y-8">
      {profile ? (
        <>
          <Link href="/kabinet/mentorlik/daromad" className="card card-hover flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-fg/6"><Wallet size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-bold text-fg">Daromad va sozlamalar</span>
              <span className="block text-[12.5px] text-fg-3">Balans, yechish, promokod, obuna narxi, 1:1 vaqtlar</span>
            </span>
          </Link>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/kabinet/mentorlik/vazifalar" className="card card-hover flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-fg/6"><ClipboardCheck size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-bold text-fg">Talabalar vazifalari</span>
                <span className="block text-[12.5px] text-fg-3">Baholash va izoh</span>
              </span>
            </Link>
            <Link href="/kabinet/mentorlik/statistika" className="card card-hover flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-fg/6"><BarChart3 size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-bold text-fg">Tahlil</span>
                <span className="block text-[12.5px] text-fg-3">Ko&apos;rilish, progress, efirlar, daromad</span>
              </span>
            </Link>
            <Link href="/kabinet/mentorlik/yol-xaritasi" className="card card-hover flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-fg/6"><Route size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-bold text-fg">Yo&apos;l xaritalari</span>
                <span className="block text-[12.5px] text-fg-3">Kurslarni ketma-ketlikka yig&apos;ish</span>
              </span>
            </Link>
          </div>
          <MentorStudio mentor={profile} courses={courses} />
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
  );
}

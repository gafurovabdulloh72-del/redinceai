import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getMentorForUser, getMentorProfileForEditor, listCoursesOfMentor, listMyEnrollments } from "@/lib/mentorship/service";
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
        <MentorStudio mentor={profile} courses={courses} />
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

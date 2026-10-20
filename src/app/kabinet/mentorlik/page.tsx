import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getMentorForUser, listMentorCourses, listMyEnrollments } from "@/lib/mentorship/service";
import { MentorDashboard } from "@/components/mentorship/MentorDashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mentorlik", robots: { index: false, follow: false } };

export default async function KabinetMentorlikPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/mentorlik"));

  const [mentor, courses, enrollments] = await Promise.all([getMentorForUser(user.id), listMentorCourses(user.id), listMyEnrollments(user.id)]);
  const status = mentor ? (mentor.isApproved ? "approved" : "pending") : "none";

  return (
    <MentorDashboard
      status={status}
      mentor={mentor ? { headline: mentor.headline, bio: mentor.bio, expertise: mentor.expertise } : null}
      courses={courses}
      enrollments={enrollments.map((e) => ({ progressPct: e.progressPct, lastLessonId: e.lastLessonId, title: e.course.title, slug: e.course.slug, coverUrl: e.course.coverUrl, mentorName: e.course.mentor.name, lessonsCount: e.course.lessonsCount }))}
    />
  );
}

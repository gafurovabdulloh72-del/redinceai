import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getCourseForOwner } from "@/lib/mentorship/service";
import { CourseEditor } from "@/components/mentorship/CourseEditor";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, KABINET_NAV.titles["Kursni tahrirlash"]), robots: { index: false, follow: false }  };
}

export default async function CourseEditorPage({ params }: { params: Promise<{ courseId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/mentorlik"));
  const { courseId } = await params;
  const data = await getCourseForOwner(user.id, courseId, user.role === "admin");
  if (!data) notFound();
  return <CourseEditor course={data.course} lessons={data.lessons} />;
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RemoveMentorButton } from "@/components/admin/RemoveMentorButton";
import { MentorStudio } from "@/components/mentorship/MentorStudio";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getMentorProfileForEditor, listCoursesOfMentor } from "@/lib/mentorship/service";
import { ADMIN_2FA_PATH, adminTwoFactorRequired } from "@/lib/security/admin-2fa";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mentorni sozlash", robots: { index: false, follow: false } };

/** Admin: mentor sahifasini uning nomidan sozlash (rasm, ma'lumotlar, bo'limlar, darslar) */
export default async function AdminMentorEditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/admin/mentorlik"));
  if (user.role !== "admin") redirect("/kabinet");
  if (adminTwoFactorRequired() && !user.totpEnabled) redirect(ADMIN_2FA_PATH);
  const { id } = await params;
  const profile = await getMentorProfileForEditor(id, { id: user.id, admin: true });
  if (!profile) notFound();
  const courses = await listCoursesOfMentor(id);
  return (
    <div className="container-x">
      <div className="mx-auto max-w-[860px] space-y-5 py-2">
        <div className="flex items-center justify-between gap-3">
          <Link href="/admin/mentorlik" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-3 hover:text-fg">
            <ArrowLeft size={14} /> Mentorlar
          </Link>
          {profile.isApproved && <RemoveMentorButton id={profile.id} name={profile.name} />}
        </div>
        <MentorStudio mentor={profile} courses={courses} admin />
      </div>
    </div>
  );
}

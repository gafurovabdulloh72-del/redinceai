import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { AdminMentorManager } from "@/components/admin/AdminMentorManager";
import { AdminMentors } from "@/components/admin/AdminMentors";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { adminListMentors } from "@/lib/mentorship/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mentorlik (admin)", robots: { index: false, follow: false } };

export default async function AdminMentorlikPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/admin/mentorlik"));
  if (user.role !== "admin") redirect("/kabinet");
  const mentors = await adminListMentors();
  return (
    <div className="container-x">
      <div className="mx-auto max-w-[860px] space-y-5 py-2">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-3 hover:text-fg">
          <ArrowLeft size={14} /> Boshqaruv markazi
        </Link>
        <h1 className="flex items-center gap-2 font-display text-[26px] font-semibold tracking-tight text-fg">
          <GraduationCap size={22} className="text-accent" /> Mentorlik
        </h1>
        <AdminMentorManager mentors={mentors} />
        <section>
          <h2 className="mb-2 font-display text-[16px] font-bold text-fg">Kelgan arizalar</h2>
          <AdminMentors />
        </section>
      </div>
    </div>
  );
}

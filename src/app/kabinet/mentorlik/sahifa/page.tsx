import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getMentorForUser, getMentorProfileForEditor } from "@/lib/mentorship/service";
import { MentorNav } from "@/components/mentorship/MentorNav";
import { MentorPageForm } from "@/components/mentorship/MentorStudio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mentorlik sahifam", robots: { index: false, follow: false } };

/** Mentorning ommaviy sahifasi ma'lumotlari — oldin «Umumiy» sahifa ichida edi, endi alohida */
export default async function MentorPagePage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/mentorlik/sahifa"));
  const mentor = await getMentorForUser(user.id);
  if (!mentor?.isApproved) redirect("/kabinet/mentorlik");
  const profile = await getMentorProfileForEditor(mentor.id, { id: user.id, admin: user.role === "admin" });
  if (!profile) redirect("/kabinet/mentorlik");
  const pageHref = profile.slug ? `/mentorlik/ustoz/${profile.slug}` : null;

  return (
    <div>
      <MentorNav active="sahifa" />
      <div className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight text-fg">Mentorlik sahifam</h1>
            <p className="mt-0.5 text-[13px] text-fg-3">Talabalar ko&apos;radigan sahifa: rasm, sarlavha, tavsif va ma&apos;lumot kartalari</p>
          </div>
          {pageHref && (
            <Link href={pageHref} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
              Sahifani ko&apos;rish <ArrowUpRight size={14} />
            </Link>
          )}
        </header>
        <MentorPageForm mentor={profile} />
      </div>
    </div>
  );
}

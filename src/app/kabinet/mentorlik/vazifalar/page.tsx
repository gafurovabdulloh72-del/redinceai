import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
import { MK } from "@/lib/i18n/dict/mentorship";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getMentorForUser } from "@/lib/mentorship/service";
import { MentorNav } from "@/components/mentorship/MentorNav";
import { listSubmissionsForMentor } from "@/lib/mentorship/learning";
import { SubmissionsReview } from "@/components/mentorship/SubmissionsReview";
import { WorkReviewInbox } from "@/components/mentorship/WorkReview";
import { listMentorWorkReviews } from "@/lib/mentorship/work-review";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, KABINET_NAV.titles["Talabalar vazifalari"]), robots: { index: false, follow: false }  };
}

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const til = await getLocale();
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/mentorlik/vazifalar"));
  const m = await getMentorForUser(user.id);
  if (!m?.isApproved && user.role !== "admin") redirect("/kabinet/mentorlik");
  const sp = await searchParams;
  const all = sp.all === "1";
  const [items, reviews] = await Promise.all([listSubmissionsForMentor(user.id, user.role === "admin", all ? "all" : "pending"), listMentorWorkReviews(user.id, user.role === "admin")]);
  return (
    <div>
      <MentorNav active="vazifalar" />
      <div className="space-y-5">
        {/* «Ishimni baholang» — pullik ish sharhlari tepada (muddatli, talaba to'lagan) */}
        <WorkReviewInbox waiting={reviews.waiting} done={reviews.done} />
        <header>
          <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight text-fg max-sm:hidden">{tr(til, MK.tasksTitle)}</h1>
          <p className="mt-0.5 text-[13px] text-fg-3 max-sm:hidden">{tr(til, MK.tasksLead)}</p>
          <p className="mt-1 flex gap-3 text-[13px] font-semibold">
            <Link href="/kabinet/mentorlik/vazifalar" className={all ? "text-fg-3" : "text-fg"}>{tr(til, MK.ungraded)}</Link>
            <Link href="/kabinet/mentorlik/vazifalar?all=1" className={all ? "text-fg" : "text-fg-3"}>{tr(til, MK.all)}</Link>
          </p>
        </header>
        <SubmissionsReview items={items} />
      </div>
    </div>
  );
}

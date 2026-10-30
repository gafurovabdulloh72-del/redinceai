import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getMentorForUser } from "@/lib/mentorship/service";
import { MentorNav } from "@/components/mentorship/MentorNav";
import { listSubmissionsForMentor } from "@/lib/mentorship/learning";
import { SubmissionsReview } from "@/components/mentorship/SubmissionsReview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Talabalar vazifalari", robots: { index: false, follow: false } };

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/mentorlik/vazifalar"));
  const m = await getMentorForUser(user.id);
  if (!m?.isApproved && user.role !== "admin") redirect("/kabinet/mentorlik");
  const sp = await searchParams;
  const all = sp.all === "1";
  const items = await listSubmissionsForMentor(user.id, user.role === "admin", all ? "all" : "pending");
  return (
    <div>
      <MentorNav active="vazifalar" />
      <div className="space-y-5">
        <header>
          <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight text-fg max-sm:hidden">Talabalar vazifalari</h1>
          <p className="mt-0.5 text-[13px] text-fg-3 max-sm:hidden">Yuborilgan ishlarni baholang va izoh qoldiring</p>
          <p className="mt-1 flex gap-3 text-[13px] font-semibold">
            <Link href="/kabinet/mentorlik/vazifalar" className={all ? "text-fg-3" : "text-fg"}>Baholanmagan</Link>
            <Link href="/kabinet/mentorlik/vazifalar?all=1" className={all ? "text-fg" : "text-fg-3"}>Hammasi</Link>
          </p>
        </header>
        <SubmissionsReview items={items} />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { db } from "@/lib/db";
import { courses, roadmaps } from "@/lib/db/schema";
import { getMentorForUser } from "@/lib/mentorship/service";
import { MentorNav } from "@/components/mentorship/MentorNav";
import { RoadmapManager } from "@/components/mentorship/RoadmapManager";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, KABINET_NAV.titles["Yo'l xaritalari"]), robots: { index: false, follow: false }  };
}

export default async function RoadmapPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/mentorlik/yol-xaritasi"));
  const m = await getMentorForUser(user.id);
  if (!m?.isApproved) redirect("/kabinet/mentorlik");
  const [rms, cs] = await Promise.all([db.query.roadmaps.findMany({ where: eq(roadmaps.mentorId, m.id) }), db.query.courses.findMany({ where: eq(courses.mentorId, m.id), columns: { id: true, title: true } })]);
  return (
    <div>
      <MentorNav active="yol-xaritasi" />
      <div className="space-y-5">
        <header>
          <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight text-fg max-sm:hidden">Yo&apos;l xaritalari</h1>
          <p className="mt-1 text-[13px] text-fg-3 max-sm:hidden">Kurslaringizni ketma-ketlikka yig&apos;ing — talaba qayerdaligini va keyingi qadamni ko&apos;radi.</p>
        </header>
        <RoadmapManager roadmaps={rms.map((r) => ({ id: r.id, title: r.title, description: r.description, courseIds: r.courseIds }))} courses={cs} />
      </div>
    </div>
  );
}

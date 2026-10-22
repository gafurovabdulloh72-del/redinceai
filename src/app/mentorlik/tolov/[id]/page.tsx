import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { loadInvoice } from "@/lib/subscriptions/billing";
import { isPurchase, purchaseMeta } from "@/lib/mentorship/purchases";
import { db } from "@/lib/db";
import { courses, mentors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PurchaseStatus } from "@/components/mentorship/PurchaseStatus";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "To'lov", robots: { index: false, follow: false } };

export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath(`/mentorlik/tolov/${id}`));
  const inv = await loadInvoice(id);
  if (!inv || !isPurchase(inv) || (inv.userId !== user.id && user.role !== "admin")) notFound();
  const m = purchaseMeta(inv);
  // To'lovdan keyin qayerga: kurs → kurs sahifasi, qolganlar → ustoz sahifasi
  let next = "/mentorlik";
  if (m.type === "course" && m.courseId) {
    const c = await db.query.courses.findFirst({ where: eq(courses.id, m.courseId), columns: { slug: true } });
    if (c) next = `/mentorlik/${c.slug}`;
  } else {
    const mentor = await db.query.mentors.findFirst({ where: eq(mentors.id, m.mentorId), columns: { slug: true } });
    if (mentor?.slug) next = `/mentorlik/ustoz/${mentor.slug}${m.type === "ticket" ? "?tab=efirlar" : m.type === "consult" ? "?tab=konsultatsiya" : ""}`;
  }
  return (
    <div className="container-x py-8">
      <PurchaseStatus id={id} next={next} />
    </div>
  );
}

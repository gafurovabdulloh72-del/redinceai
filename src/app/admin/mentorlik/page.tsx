import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { AdminMentorManager } from "@/components/admin/AdminMentorManager";
import { AdminMentors } from "@/components/admin/AdminMentors";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { adminListMentors } from "@/lib/mentorship/service";
import { AdminMentorMoney } from "@/components/admin/AdminMentorMoney";
import { listOpenPayouts, purchaseMeta } from "@/lib/mentorship/purchases";
import { db } from "@/lib/db";
import { subscriptionInvoices, users } from "@/lib/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mentorlik (admin)", robots: { index: false, follow: false } };

export default async function AdminMentorlikPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/admin/mentorlik"));
  if (user.role !== "admin") redirect("/kabinet");
  const [mentors, openPayouts, pendingInv] = await Promise.all([
    adminListMentors(),
    listOpenPayouts(),
    db.query.subscriptionInvoices.findMany({ where: and(eq(subscriptionInvoices.state, "pending"), eq(subscriptionInvoices.provider, "manual"), sql`json_extract(${subscriptionInvoices.meta}, '$.kind') = 'purchase'`) }),
  ]);
  const buyerIds = pendingInv.map((i) => i.userId).filter((x): x is string => Boolean(x));
  const buyers = buyerIds.length ? await db.query.users.findMany({ where: inArray(users.id, buyerIds), columns: { id: true, name: true } }) : [];
  const bmap = new Map(buyers.map((b) => [b.id, b.name]));
  return (
    <div className="container-x">
      <div className="mx-auto max-w-[860px] space-y-5 py-2">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-3 hover:text-fg">
          <ArrowLeft size={14} /> Boshqaruv markazi
        </Link>
        <h1 className="flex items-center gap-2 font-display text-[26px] font-semibold tracking-tight text-fg">
          <GraduationCap size={22} className="text-accent" /> Mentorlik
        </h1>
        <AdminMentorMoney
          payouts={openPayouts.map((p) => ({ id: p.id, mentor: p.mentor.user.name, amount: p.amount, card: p.card, createdAt: p.createdAt.getTime() }))}
          purchases={pendingInv.map((i) => ({ id: i.id, title: purchaseMeta(i).title, buyer: i.userId ? (bmap.get(i.userId) ?? "—") : "—", amount: i.amount, createdAt: i.createdAt.getTime() }))}
        />
        <AdminMentorManager mentors={mentors} />
        <section>
          <h2 className="mb-2 font-display text-[16px] font-bold text-fg">Kelgan arizalar</h2>
          <AdminMentors />
        </section>
      </div>
    </div>
  );
}

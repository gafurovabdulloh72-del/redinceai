import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { getMentorForUser } from "@/lib/mentorship/service";
import { MentorNav } from "@/components/mentorship/MentorNav";
import { listEarnings, listPayouts, listPromos, listSlots, mentorBalance } from "@/lib/mentorship/purchases";
import { MentorMoney } from "@/components/mentorship/MentorMoney";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, KABINET_NAV.titles["Daromad va sozlamalar"]), robots: { index: false, follow: false }  };
}

export default async function MentorMoneyPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/mentorlik/daromad"));
  const m = await getMentorForUser(user.id);
  if (!m?.isApproved) redirect("/kabinet/mentorlik");
  const [balance, earnings, payouts, promos, slots, cs] = await Promise.all([
    mentorBalance(m.id),
    listEarnings(m.id),
    listPayouts(m.id),
    listPromos(m.id),
    listSlots(m.id, true),
    db.query.courses.findMany({ where: and(eq(courses.mentorId, m.id)), columns: { id: true, title: true } }),
  ]);
  const cmap = new Map(cs.map((c) => [c.id, c.title]));
  return (
    <div>
      <MentorNav active="daromad" />
      <div className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight text-fg max-sm:hidden">Daromad va sozlamalar</h1>
            <p className="mt-0.5 text-[13px] text-fg-3 max-sm:hidden">Balans va yechish, promokod, obuna narxi va 1:1 vaqtlar</p>
          </div>
          {/* Tahlil endi shu tab ichidan ochiladi (nav 4 tabga qisqartirilgan) */}
          <Link href="/kabinet/mentorlik/statistika" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
            <BarChart3 size={14} /> Batafsil tahlil
          </Link>
        </header>
        <MentorMoney
          d={{
            mentorId: m.id,
            balance,
            earnings: earnings.map((e) => ({ id: e.id, kind: e.kind, title: e.title, gross: e.gross, net: e.net, status: e.status, createdAt: e.createdAt.getTime(), availableAt: e.availableAt?.getTime() ?? null })),
            payouts: payouts.map((p) => ({ id: p.id, amount: p.amount, status: p.status, createdAt: p.createdAt.getTime(), note: p.note })),
            promos: promos.map((p) => ({ id: p.id, code: p.code, percent: p.percent, uses: p.uses, maxUses: p.maxUses, expiresAt: p.expiresAt?.getTime() ?? null, isActive: p.isActive, courseTitle: p.courseId ? (cmap.get(p.courseId) ?? null) : null })),
            courses: cs,
            slots: slots.map((s) => ({ id: s.id, startsAt: s.startsAt.getTime(), durationMin: s.durationMin, priceSom: s.priceSom, status: s.status })),
            subPrice: m.subPrice,
            refPercent: m.refPercent,
          }}
        />
      </div>
    </div>
  );
}

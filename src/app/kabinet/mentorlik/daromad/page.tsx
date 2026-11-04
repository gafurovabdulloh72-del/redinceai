import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { KABINET_NAV } from "@/lib/i18n/dict/kabinet";
import { MK } from "@/lib/i18n/dict/mentorship";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { getMentorForUser } from "@/lib/mentorship/service";
import { MentorNav } from "@/components/mentorship/MentorNav";
import { listEarnings, listPayouts, listPromos, listSlots, mentorBalance, monthlyEarnings } from "@/lib/mentorship/purchases";
import { formatPrice } from "@/lib/utils";
import { MentorMoney } from "@/components/mentorship/MentorMoney";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const til = await getLocale();
  return { title: tr(til, KABINET_NAV.titles["Daromad va sozlamalar"]), robots: { index: false, follow: false }  };
}

export default async function MentorMoneyPage() {
  const til = await getLocale();
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/mentorlik/daromad"));
  const m = await getMentorForUser(user.id);
  if (!m?.isApproved) redirect("/kabinet/mentorlik");
  const [balance, earnings, payouts, promos, slots, cs, monthly] = await Promise.all([
    mentorBalance(m.id),
    listEarnings(m.id),
    listPayouts(m.id),
    listPromos(m.id),
    listSlots(m.id, true),
    db.query.courses.findMany({ where: and(eq(courses.mentorId, m.id)), columns: { id: true, title: true } }),
    monthlyEarnings(m.id, 6).catch(() => []),
  ]);
  const cmap = new Map(cs.map((c) => [c.id, c.title]));
  return (
    <div>
      <MentorNav active="daromad" />
      <div className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight text-fg max-sm:hidden">{tr(til, MK.moneyTitle)}</h1>
            <p className="mt-0.5 text-[13px] text-fg-3 max-sm:hidden">{tr(til, MK.moneyLead)}</p>
          </div>
          {/* Tahlil endi shu tab ichidan ochiladi (nav 4 tabga qisqartirilgan) */}
          <Link href="/kabinet/mentorlik/statistika" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
            <BarChart3 size={14} /> {tr(til, MK.detailedAnalytics)}
          </Link>
        </header>
        {/* Oylik daromad grafigi (kamchilik #27) — faqat daromad bo'lsa chiziladi */}
        {monthly.some((x) => x.net > 0) && (
          <section className="card p-5" aria-label={tr(til, MK.monthlyIncome)}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="font-display text-[15px] font-semibold text-fg">{tr(til, MK.monthlyIncome6)}</h2>
              <p className="text-[12px] text-fg-3">{tr(til, MK.monthlyIncomeHint)}</p>
            </div>
            {(() => {
              const max = Math.max(...monthly.map((x) => x.net), 1);
              return (
                <div className="flex h-[110px] items-end gap-2">
                  {monthly.map((x) => (
                    <div key={x.month} className="group/bar flex min-w-0 flex-1 flex-col items-center gap-1" title={`${x.month} — ${formatPrice(x.net)}`}>
                      <span className="text-[10px] tabular-nums text-fg-3 opacity-0 transition-opacity group-hover/bar:opacity-100">{formatPrice(x.net, { compact: true })}</span>
                      <span className={x.net > 0 ? "w-full rounded-t-[4px] bg-accent/80 transition-colors group-hover/bar:bg-accent" : "w-full rounded-t-[4px] bg-fg/8"} style={{ height: `${Math.max(Math.round((x.net / max) * 72), 3)}px` }} aria-hidden />
                      <span className="text-[10.5px] tabular-nums text-fg-4">{x.month.slice(5, 7)}.{x.month.slice(2, 4)}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </section>
        )}
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

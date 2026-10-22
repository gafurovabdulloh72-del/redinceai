import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getMentorForUser } from "@/lib/mentorship/service";
import { mentorAnalytics } from "@/lib/mentorship/growth";
import { formatSom } from "@/lib/mentorship/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tahlil", robots: { index: false, follow: false } };

const som = (n: number) => (n ? formatSom(n) : "0 so'm");

/** Mentor tahlili: kurs ko'rilishi → yozilish, o'rtacha progress, qaysi darsda talabalar to'xtaydi, efir va daromad manbalari */
export default async function MentorAnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/mentorlik/statistika"));
  const m = await getMentorForUser(user.id);
  if (!m?.isApproved) redirect("/kabinet/mentorlik");
  const a = await mentorAnalytics(m.id, m.channelId);
  return (
    <div className="space-y-5">
      <header>
        <Link href="/kabinet/mentorlik" className="inline-flex items-center gap-1 text-[13px] text-fg-3 hover:text-fg"><ArrowLeft size={14} /> Mentorlik</Link>
        <h1 className="mt-1 font-display text-[24px] font-extrabold leading-tight tracking-tight text-fg">Tahlil</h1>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Efirlar" value={`${a.live.count} ta`} hint={a.live.count ? `o'rtacha ${a.live.avgPeak} tomoshabin · eng ko'pi ${a.live.maxPeak}` : "hali efir yo'q"} />
        <Stat label="Chipta sotuvi" value={`${a.live.tickets} ta`} hint={som(a.live.ticketRevenue)} />
        <Stat label="Faol obunachilar" value={`${a.activeSubs} ta`} hint={`daromad ${som(a.subRevenue)}`} />
        <Stat label="Konsultatsiya daromadi" value={som(a.consultRevenue)} />
      </section>

      {a.courses.length === 0 && <p className="card p-6 text-center text-[14px] text-fg-3">Hali kurs yo&apos;q.</p>}
      {a.courses.map((c) => (
        <section key={c.id} className="card p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate text-[15.5px] font-bold text-fg">{c.title}</h2>
            {!c.published && <span className="rounded bg-fg/8 px-2 py-0.5 text-[11px] font-bold text-fg-3">chop etilmagan</span>}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-5">
            <Kpi k="Ko'rilgan" v={String(c.views)} />
            <Kpi k="Yozilgan" v={`${c.students}${c.conversion ? ` (${c.conversion}%)` : ""}`} />
            <Kpi k="O'rtacha progress" v={`${c.avgProgress}%`} />
            <Kpi k="Tugatgan / sertifikat" v={`${c.completed} / ${c.certificates}`} />
            <Kpi k="Daromad" v={`${som(c.revenue)}${c.sales ? ` · ${c.sales} ta` : ""}`} />
          </dl>
          {c.lessons.length > 0 && c.students > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-[12.5px] font-semibold text-fg-3">Darslarni tugatganlar (talabalarning %)</p>
              <ul className="space-y-1.5">
                {c.lessons.map((l, i) => {
                  const prev = i > 0 ? c.lessons[i - 1].pct : 100;
                  const drop = prev - l.pct;
                  return (
                    <li key={l.id} className="flex items-center gap-2.5 text-[12.5px]">
                      <span className="w-5 shrink-0 text-right tabular-nums text-fg-4">{i + 1}</span>
                      <span className="w-40 shrink-0 truncate text-fg-2 sm:w-56">{l.title}</span>
                      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-fg/8"><span className="block h-full rounded-full bg-accent" style={{ width: `${l.pct}%` }} /></span>
                      <span className="w-9 shrink-0 text-right font-semibold tabular-nums text-fg">{l.pct}%</span>
                      <span className={cn("w-12 shrink-0 text-right text-[11.5px] font-semibold tabular-nums", drop >= 25 ? "text-danger" : "text-fg-4")}>{i > 0 && drop > 0 ? `−${drop}%` : ""}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[11.5px] text-fg-4">Qizil — oldingi darsga nisbatan keskin tushish: shu darsni qisqartiring yoki soddalashtiring.</p>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-[12px] font-semibold text-fg-3">{label}</p>
      <p className="mt-1 font-display text-[19px] font-extrabold tabular-nums text-fg">{value}</p>
      {hint && <p className="mt-0.5 text-[11.5px] text-fg-4">{hint}</p>}
    </div>
  );
}
function Kpi({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11.5px] text-fg-3">{k}</dt>
      <dd className="font-bold tabular-nums text-fg">{v}</dd>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BriefcaseBusiness, Clock3, Eye, MapPin, MessageSquareText, Plus, Wallet } from "lucide-react";
import { Badge, ButtonLink, EmptyState } from "@/components/ui";
import { JobOwnerActions } from "@/components/jobs/JobOwnerActions";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { JOB_STATUS_LABEL } from "@/lib/constants";
import { budgetLabel, daysLeft, JOB_STATUS_TONE, jobCategoryLabel, jobRegionLabel, proposalsCountLabel } from "@/lib/jobs/format";
import { listClientJobs } from "@/lib/jobs/queries";
import { formatNumber, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "E'lonlarim" };

/** Mijozning e'lonlari: holat, takliflar (yangilari alohida), ko'rishlar, muddat; tahrirlash / yopish / qayta ochish */
export default async function MyJobsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/elonlar"));
  if (user.role === "specialist") redirect("/kabinet/takliflar");

  const jobs = user.role === "client" ? await listClientJobs(user.id) : [];
  const now = Date.now();
  const isLive = (j: (typeof jobs)[number]) => j.status === "open" && (!j.expiresAt || j.expiresAt.getTime() > now);
  const openCount = jobs.filter(isLive).length;
  const newTotal = jobs.reduce((a, j) => a + (isLive(j) ? j.newProposals : 0), 0);

  return (
    <div className="animate-fade-up">
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="eyebrow">
            <BriefcaseBusiness size={13} className="text-accent" /> Kabinet
          </span>
          <h1 className="display-xl mt-4 text-[32px] text-fg sm:text-[40px]">
            Mening <span className="accent-serif text-accent">e'lonlarim</span>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-2">
            {jobs.length > 0
              ? `${openCount} ta ochiq e'lon${newTotal > 0 ? ` · ${newTotal} ta yangi taklif ko'rib chiqishni kutmoqda` : ""}.`
              : "Loyihangizni joylang — mutaxassislar narx va muddat bilan taklif yuborishadi."}
          </p>
        </div>
        {user.role === "client" && (
          <ButtonLink href="/ishlar/yangi" variant="accent" size="md" className="shrink-0">
            <Plus size={16} /> Yangi e'lon
          </ButtonLink>
        )}
      </header>

      {user.role !== "client" ? (
        <EmptyState icon={BriefcaseBusiness} title="E'lonlar faqat mijozlar uchun" description="Administrator hisobidan e'lon joylanmaydi." />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title="Hali e'lon joylamagansiz"
          description="Vazifani yozing, byudjet va muddatni belgilang — takliflar shu yerda jamlanadi."
          action={
            <ButtonLink href="/ishlar/yangi" variant="accent" size="md">
              <Plus size={15} /> E'lon joylash
            </ButtonLink>
          }
        />
      ) : (
        <ul className="space-y-3">
          {jobs.map((j) => {
            const live = isLive(j);
            const expired = j.status === "open" && !live;
            const left = live ? daysLeft(j.expiresAt, now) : null;
            return (
              <li key={j.id} className="card min-w-0 p-4 sm:p-5">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link href={`/ishlar/${j.id}`} className="font-display text-[17px] font-semibold leading-snug text-fg hover:underline">
                      {j.title}
                    </Link>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-fg-3">
                      <span>{jobCategoryLabel(j.category)}</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} aria-hidden="true" /> {jobRegionLabel(j.regionSlug)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Wallet size={12} aria-hidden="true" /> {budgetLabel(j.budgetMin, j.budgetMax, j.budgetType)}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {live && j.newProposals > 0 && <Badge tone="accent">{j.newProposals} ta yangi</Badge>}
                    <Badge tone={expired ? "neutral" : JOB_STATUS_TONE[j.status]}>{expired ? "Muddati tugagan" : JOB_STATUS_LABEL[j.status]}</Badge>
                  </div>
                </div>

                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-fg-2">
                  <span className="inline-flex items-center gap-1">
                    <MessageSquareText size={13} className="text-fg-3" aria-hidden="true" /> {proposalsCountLabel(j.proposalsCount)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Eye size={13} className="text-fg-3" aria-hidden="true" /> {formatNumber(j.viewCount)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 size={13} className="text-fg-3" aria-hidden="true" /> {timeAgo(j.createdAt)}
                  </span>
                  {left != null && <span className={left <= 3 ? "font-semibold text-warning-text" : "text-fg-3"}>{left > 0 ? `${left} kun qoldi` : "Bugun yopiladi"}</span>}
                </p>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  {j.status === "hired" && j.hiredOrderId ? (
                    <ButtonLink href={`/kabinet/buyurtmalar?id=${j.hiredOrderId}`} variant="primary" size="sm" className="!h-10">
                      Buyurtmaga o'tish <ArrowRight size={14} />
                    </ButtonLink>
                  ) : (
                    <ButtonLink href={`/ishlar/${j.id}#takliflar`} variant={live && j.newProposals > 0 ? "primary" : "outline"} size="sm" className="!h-10">
                      Takliflarni ko'rish <ArrowRight size={14} />
                    </ButtonLink>
                  )}
                  <JobOwnerActions jobId={j.id} status={j.status} expired={expired} compact />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

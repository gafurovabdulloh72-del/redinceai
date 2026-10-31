import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, Search, Send } from "lucide-react";
import { Badge, ButtonLink, EmptyState } from "@/components/ui";
import { ScrollRow } from "@/components/ui/ScrollRow";
import { WithdrawButton } from "@/components/jobs/MyProposalCard";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { JOB_STATUS_LABEL, PROPOSAL_STATUS_LABEL } from "@/lib/constants";
import { budgetLabel, PROPOSAL_STATUS_TONE } from "@/lib/jobs/format";
import { getProposerContext, listSpecialistProposals } from "@/lib/jobs/queries";
import { SUBSCRIPTION_HREF } from "@/lib/jobs/service";
import { cn, formatPrice, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Takliflarim" };

const TABS = [
  { key: "", label: "Barchasi" },
  { key: "faol", label: "Faol" },
  { key: "qabul", label: "Qabul qilingan" },
  { key: "yopiq", label: "Yopilgan" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** Mutaxassisning takliflari: holat, narx, muddat; qaytarib olish; qabul qilinganda — buyurtmaga havola */
export default async function MyProposalsPage({ searchParams }: { searchParams: Promise<{ holat?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/takliflar"));
  if (user.role === "client") redirect("/kabinet/elonlar");

  const { holat } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === holat) ? (holat as TabKey) : "";
  const ctx = user.role === "specialist" ? await getProposerContext(user.id) : null;
  const all = ctx ? await listSpecialistProposals(ctx.specialistId) : [];
  const groups: Record<TabKey, typeof all> = {
    "": all,
    faol: all.filter((p) => p.status === "pending" || p.status === "shortlisted"),
    qabul: all.filter((p) => p.status === "accepted"),
    yopiq: all.filter((p) => p.status === "declined" || p.status === "withdrawn"),
  };
  const list = groups[tab];

  return (
    <div className="animate-fade-up">
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="eyebrow">Kabinet</span>
          <h1 className="display-xl mt-4 text-[32px] text-fg sm:text-[40px]">
            Mening <span className="accent-serif text-accent">takliflarim</span>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-2">
            {all.length > 0 ? `${all.length} ta taklif · ${groups.faol.length} tasi ko'rib chiqilmoqda.` : "Mijozlar e'lonlariga yuborgan takliflaringiz shu yerda jamlanadi."}
          </p>
        </div>
        <ButtonLink href="/ishlar" variant="outline" size="md" className="shrink-0">
          <Search size={16} /> Ishlarni ko'rish
        </ButtonLink>
      </header>

      {ctx?.canPropose && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1.5 text-[12.5px] font-semibold",
              ctx.remaining <= 0 ? "bg-danger-soft text-danger-text" : ctx.remaining <= 3 ? "bg-warning-soft text-warning-text" : "bg-fg/6 text-fg-2",
            )}
          >
            Bugun {ctx.remaining}/{ctx.limit} taklif qoldi
          </span>
        </div>
      )}
      {ctx && !ctx.canPropose && (
        <div role="status" className="mb-5 flex flex-col gap-3 rounded-[var(--r-md)] border border-warning/30 bg-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2.5 text-[14px] font-medium text-warning-text">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            Obunangiz faol emas — yangi taklif yuborib bo'lmaydi. Yuborilgan takliflar va buyurtmalar davom etadi.
          </p>
          <ButtonLink href={SUBSCRIPTION_HREF} variant="primary" size="md" className="shrink-0">
            Obunani yangilash
          </ButtonLink>
        </div>
      )}

      {!ctx ? (
        <EmptyState
          icon={Send}
          title={user.role === "specialist" ? "Avval profilingizni to'ldiring" : "Takliflar faqat mutaxassislar uchun"}
          description={user.role === "specialist" ? "Taklif yuborish uchun mutaxassis profili kerak." : "Administrator hisobidan taklif yuborilmaydi."}
          action={
            user.role === "specialist" ? (
              <ButtonLink href="/kabinet/profil" variant="primary" size="md">
                Profilga o'tish
              </ButtonLink>
            ) : undefined
          }
        />
      ) : all.length === 0 ? (
        <EmptyState
          icon={Send}
          title="Hali taklif yubormagansiz"
          description="Ochiq e'lonlarni ko'ring va narx, muddat hamda qisqa xat bilan taklif yuboring."
          action={
            <ButtonLink href="/ishlar" variant="accent" size="md">
              <Search size={15} /> Ochiq ishlar
            </ButtonLink>
          }
        />
      ) : (
        <>
          {/* Telefonda qator aylanadi: ScrollRow chetda so'nish + strelka-ishora beradi */}
          <nav aria-label="Takliflar holati" className="mb-4 max-w-full">
            <ScrollRow label="Holat bo'yicha filtr">
              <div className="segment">
                {TABS.map((t) => (
                  <Link
                    key={t.key || "all"}
                    href={t.key ? `/kabinet/takliflar?holat=${t.key}` : "/kabinet/takliflar"}
                    data-active={tab === t.key}
                    aria-current={tab === t.key ? "page" : undefined}
                    className="segment-item inline-flex min-h-10 items-center gap-1.5"
                  >
                    {t.label} <span className="tabular-nums opacity-70">{groups[t.key].length}</span>
                  </Link>
                ))}
              </div>
            </ScrollRow>
          </nav>

          {list.length === 0 ? (
            <EmptyState icon={Send} title="Bu bo'limda taklif yo'q" description="Boshqa bo'limni tanlang." />
          ) : (
            <ul className="stagger space-y-3 max-sm:space-y-0">
              {list.map((p) => {
                const active = p.status === "pending" || p.status === "shortlisted";
                return (
                  <li key={p.id} className={cn("card m-flat min-w-0 p-4 sm:p-5", (p.status === "declined" || p.status === "withdrawn") && "opacity-80")}>
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <Link href={`/ishlar/${p.job.id}`} className="font-display text-[16.5px] font-semibold leading-snug text-fg hover:underline">
                          {p.job.title}
                        </Link>
                        <p className="mt-1 text-[12.5px] text-fg-3">
                          Mijoz byudjeti: {budgetLabel(p.job.budgetMin, p.job.budgetMax, p.job.budgetType)} · {p.job.proposalsCount} ta taklif
                          {p.job.status !== "open" && ` · E'lon: ${JOB_STATUS_LABEL[p.job.status].toLowerCase()}`}
                        </p>
                      </div>
                      <Badge tone={PROPOSAL_STATUS_TONE[p.status]} className="w-fit shrink-0">
                        {PROPOSAL_STATUS_LABEL[p.status]}
                      </Badge>
                    </div>

                    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px]">
                      <span className="font-semibold text-fg">{formatPrice(p.amount)}</span>
                      <span className="font-semibold text-fg">{p.deliveryDays} kun</span>
                      <span className="text-[12.5px] text-fg-3" suppressHydrationWarning>
                        {timeAgo(p.createdAt)}
                      </span>
                    </p>
                    <p className="mt-2 line-clamp-2 text-[13.5px] leading-relaxed text-fg-2">{p.coverLetter}</p>

                    {(active || (p.status === "accepted" && p.orderId)) && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                        {p.status === "accepted" && p.orderId && (
                          <ButtonLink href={`/kabinet/buyurtmalar?id=${p.orderId}`} variant="accent" size="sm" className="!h-10">
                            Buyurtmaga o'tish <ArrowRight size={14} />
                          </ButtonLink>
                        )}
                        {active && <WithdrawButton proposalId={p.id} size="sm" />}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

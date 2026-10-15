import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  Lock,
  LogIn,
  MapPin,
  MessageSquareText,
  Plus,
  ShieldCheck,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Badge, ButtonLink } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { JobOwnerActions } from "@/components/jobs/JobOwnerActions";
import { MyProposalCard } from "@/components/jobs/MyProposalCard";
import { OwnerProposals } from "@/components/jobs/OwnerProposals";
import { ProposalForm } from "@/components/jobs/ProposalForm";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORY_BY_SLUG, JOB_STATUS_LABEL, SITE } from "@/lib/constants";
import { BUDGET_TYPE_LABEL, budgetLabel, daysLeft, JOB_STATUS_TONE, jobRegionLabel, proposalsCountLabel } from "@/lib/jobs/format";
import { bumpJobViewCount, clientJobStats, getJobRow, getMyProposal, getProposerContext, listJobProposalsForOwner, toJobPublic } from "@/lib/jobs/queries";
import { SUBSCRIPTION_HREF } from "@/lib/jobs/service";
import { isBotUserAgent } from "@/lib/privacy";
import { formatDate, formatNumber, formatUzPhone, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type Search = Promise<{ yangi?: string }>;

/** generateMetadata + sahifa — bitta so'rovda bir marta o'qiladi */
const loadJob = cache(getJobRow);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const job = await loadJob(id);
  if (!job || job.client.isBanned) return { title: "E'lon topilmadi", robots: { index: false, follow: false } };
  const live = job.status === "open" && (!job.expiresAt || job.expiresAt.getTime() > Date.now());
  const description = `${budgetLabel(job.budgetMin, job.budgetMax, job.budgetType)} · ${jobRegionLabel(job.regionSlug, true)}. ${job.description.replace(/\s+/g, " ").slice(0, 140)}`;
  return {
    title: job.title,
    description,
    alternates: { canonical: `/ishlar/${job.id}` },
    robots: live ? undefined : { index: false, follow: true },
    openGraph: { title: `${job.title} · ${SITE.name}`, description, type: "article", url: `/ishlar/${job.id}`, images: ["/opengraph-image"], siteName: SITE.name, locale: "uz_UZ" },
  };
}

export default async function JobPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [{ id }, { yangi }] = await Promise.all([params, searchParams]);
  const [row, user, hdrs] = await Promise.all([loadJob(id), getCurrentUser(), headers()]);
  if (!row) notFound();
  const isAdmin = user?.role === "admin";
  if (row.client.isBanned && !isAdmin) notFound();

  const isOwner = Boolean(user && user.id === row.clientId);
  const isSpecialist = user?.role === "specialist";
  const job = toJobPublic(row);
  const now = Date.now();
  const expired = job.status === "open" && job.expiresAt != null && job.expiresAt.getTime() <= now;
  const live = job.status === "open" && !expired;
  const left = live ? daysLeft(job.expiresAt, now) : null;

  const [stats, ownerProposals, proposer] = await Promise.all([
    clientJobStats(row.clientId),
    isOwner && user ? listJobProposalsForOwner(job.id, { userId: user.id, role: user.role }) : Promise.resolve(null),
    isSpecialist && user ? getProposerContext(user.id, now) : Promise.resolve(null),
  ]);
  const mine = proposer ? await getMyProposal(job.id, proposer.specialistId) : null;
  const sentMine = mine && mine.status !== "withdrawn" ? mine : null;

  // Ko'rishlar: egasi va botlar hisoblanmaydi; natijani kutmaymiz
  if (!isOwner && !isBotUserAgent(hdrs.get("user-agent"))) {
    void bumpJobViewCount(job.id).catch(() => {});
  }

  const cat = CATEGORY_BY_SLUG[job.category];
  const budget = budgetLabel(job.budgetMin, job.budgetMax, job.budgetType);
  const loginHref = `/auth/kirish?next=${encodeURIComponent(`/ishlar/${job.id}`)}`;
  const statusLabel = expired ? "Muddati tugagan" : JOB_STATUS_LABEL[job.status];
  const canSendForm = Boolean(proposer && live && !sentMine && proposer.canPropose);

  return (
    <div className="container-x">
      <ButtonLink href="/ishlar" variant="ghost" size="sm" className="-ml-3 mb-4 !h-10">
        <ArrowLeft size={15} /> Barcha e'lonlar
      </ButtonLink>

      {isOwner && yangi === "1" && (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-[var(--r-md)] bg-success-soft p-4 text-success-text">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-[15px] font-semibold">E'loningiz joylandi</p>
            <p className="mt-0.5 text-[13.5px] opacity-90">Mos mutaxassislar taklif yuborganda bildirishnoma keladi. Takliflar shu sahifada va «E'lonlarim» bo'limida.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
        {/* ---------- Asosiy ustun ---------- */}
        <div className="min-w-0 space-y-6 lg:col-span-8">
          <article className="card p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
              {cat && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-fg/6 px-2.5 py-1 text-fg-2">
                  <CategoryIcon icon={cat.icon} size={12} aria-hidden="true" />
                  {cat.name}
                </span>
              )}
              <span className={job.regionSlug ? "inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-fg-2" : "inline-flex items-center gap-1 rounded-full bg-info-soft px-2.5 py-1 text-info-text"}>
                <MapPin size={12} aria-hidden="true" /> {jobRegionLabel(job.regionSlug, true)}
              </span>
              {!live && <Badge tone={expired ? "neutral" : JOB_STATUS_TONE[job.status]}>{statusLabel}</Badge>}
            </div>

            <h1 className="display-xl mt-4 text-[28px] text-fg sm:text-[36px]">{job.title}</h1>

            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-3">
              <span className="inline-flex items-center gap-1">
                <Clock3 size={13} aria-hidden="true" /> {timeAgo(job.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageSquareText size={13} aria-hidden="true" /> {proposalsCountLabel(job.proposalsCount)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Eye size={13} aria-hidden="true" /> {formatNumber(job.viewCount)} marta ko'rildi
              </span>
              {left != null && <span className={left <= 3 ? "font-semibold text-warning-text" : undefined}>{left > 0 ? `${left} kun ochiq turadi` : "Bugun yopiladi"}</span>}
            </p>

            <div className="mt-5 whitespace-pre-line text-[15px] leading-relaxed text-fg-2 sm:text-[16px]">{job.description}</div>

            {job.skills.length > 0 && (
              <div className="mt-5">
                <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">Kerakli ko'nikmalar</h2>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {job.skills.map((s) => (
                    <li key={s} className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[13px] font-medium text-fg-2">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 text-[13.5px] sm:grid-cols-4">
              <div>
                <dt className="text-fg-3">Byudjet</dt>
                <dd className="mt-0.5 font-semibold text-fg">{budget}</dd>
              </div>
              <div>
                <dt className="text-fg-3">To'lov turi</dt>
                <dd className="mt-0.5 font-semibold text-fg">{BUDGET_TYPE_LABEL[job.budgetType]}</dd>
              </div>
              <div>
                <dt className="text-fg-3">Muddat</dt>
                <dd className="mt-0.5 font-semibold text-fg">{job.deadline || "Kelishiladi"}</dd>
              </div>
              <div>
                <dt className="text-fg-3">Joylandi</dt>
                <dd className="mt-0.5 font-semibold text-fg">{formatDate(job.createdAt)}</dd>
              </div>
            </dl>

            {/* Mobil: egasining amallari yuqorida (yon panel takliflardan keyin chiqadi) */}
            {isOwner && job.status !== "hired" && (
              <div className="mt-5 border-t border-line pt-4 lg:hidden">
                <JobOwnerActions jobId={job.id} status={job.status} expired={expired} compact />
              </div>
            )}
          </article>

          {/* Egasi: takliflar */}
          {isOwner && ownerProposals && <OwnerProposals proposals={ownerProposals} jobOpen={job.status === "open"} defaultPhone={row.client.phone ? formatUzPhone(row.client.phone) : ""} />}

          {/* Mutaxassis */}
          {proposer &&
            (sentMine ? (
              <MyProposalCard proposal={sentMine} />
            ) : !live ? (
              <Notice icon={Lock} title="E'lon yopilgan" text="Bu e'longa endi taklif qabul qilinmaydi. Boshqa ochiq e'lonlarni ko'rib chiqing." action={<ButtonLink href="/ishlar" variant="outline" size="md">Ochiq e'lonlar</ButtonLink>} />
            ) : !proposer.canPropose ? (
              <Notice
                icon={AlertTriangle}
                tone="warning"
                title="Obunangiz faol emas"
                text="Taklif yuborish va yangi buyurtma olish uchun oylik obunani yangilang. Mavjud buyurtmalaringiz odatdagidek davom etadi."
                action={
                  <ButtonLink href={SUBSCRIPTION_HREF} variant="primary" size="md">
                    Obunani yangilash
                  </ButtonLink>
                }
              />
            ) : (
              <ProposalForm
                jobId={job.id}
                remaining={proposer.remaining}
                limit={proposer.limit}
                budgetHint={budget}
                hourly={job.budgetType === "hourly"}
                initial={mine?.status === "withdrawn" ? { amount: mine.amount, deliveryDays: mine.deliveryDays, coverLetter: mine.coverLetter } : undefined}
              />
            ))}
          {isSpecialist && !proposer && (
            <Notice icon={UserPlus} title="Profilingizni to'ldiring" text="Taklif yuborish uchun avval mutaxassis profilingizni yarating." action={<ButtonLink href="/kabinet/profil" variant="primary" size="md">Profilga o'tish</ButtonLink>} />
          )}

          {/* Mehmon */}
          {!user && live && (
            <Notice
              icon={LogIn}
              title="Taklif yuborish uchun kiring"
              text="Mutaxassis sifatida kirib, narx va muddatingizni yuboring. Mijoz taklifni qabul qilsa — buyurtma va xavfsiz to'lov avtomatik."
              action={
                <div className="flex flex-wrap gap-2">
                  <ButtonLink href={loginHref} variant="primary" size="md">
                    <LogIn size={15} /> Kirish
                  </ButtonLink>
                  <ButtonLink href="/auth/royxat?role=specialist" variant="outline" size="md">
                    <UserPlus size={15} /> Mutaxassis sifatida qo'shilish
                  </ButtonLink>
                </div>
              }
            />
          )}

          {/* Boshqa mijoz */}
          {user && user.role === "client" && !isOwner && (
            <Notice
              icon={MessageSquareText}
              title="Takliflarni mutaxassislar yuboradi"
              text="Sizga ham mutaxassis kerakmi? O'z loyihangizni joylang — mos ijrochilar o'zlari taklif yuborishadi."
              action={
                <ButtonLink href="/ishlar/yangi" variant="accent" size="md">
                  <Plus size={15} /> E'lon joylash
                </ButtonLink>
              }
            />
          )}
        </div>

        {/* ---------- Yon panel ---------- */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:col-span-4">
          <div className="card p-5">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">Byudjet</p>
            <p className="mt-1.5 flex items-center gap-2 font-display text-[22px] font-semibold leading-tight text-fg">
              <Wallet size={20} className="shrink-0 text-accent" aria-hidden="true" /> {budget}
            </p>
            <p className="mt-1 text-[13px] text-fg-3">{BUDGET_TYPE_LABEL[job.budgetType]}</p>
            <p className="mt-3 flex items-center gap-1.5 text-[13.5px] text-fg-2">
              <CalendarClock size={14} className="text-fg-3" aria-hidden="true" /> Muddat: <span className="font-semibold text-fg">{job.deadline || "Kelishiladi"}</span>
            </p>
            {canSendForm && (
              <a href="#taklif" className="btn-accent mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[14px] font-semibold">
                Taklif yuborish
              </a>
            )}
            {proposer && live && proposer.canPropose && !sentMine && (
              <p className="mt-2 text-center text-[12px] text-fg-3">
                Bugun {proposer.remaining}/{proposer.limit} taklif qoldi
              </p>
            )}
            {isOwner && (
              <div className="mt-4 border-t border-line pt-4">
                <JobOwnerActions jobId={job.id} status={job.status} expired={expired} compact />
                {job.status === "hired" && row.hiredOrderId && (
                  <ButtonLink href={`/kabinet/buyurtmalar?id=${row.hiredOrderId}`} variant="primary" size="md" className="w-full">
                    Buyurtmaga o'tish
                  </ButtonLink>
                )}
              </div>
            )}
          </div>

          <div className="card p-5">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">Mijoz</p>
            <p className="mt-2 flex items-center gap-1.5 text-[16px] font-semibold text-fg">
              {job.client.firstName}
              {job.client.emailVerified && <BadgeCheck size={16} className="text-success-text" aria-label="Email tasdiqlangan" role="img" />}
            </p>
            <ul className="mt-2 space-y-1.5 text-[13px] text-fg-2">
              <li>{job.client.emailVerified ? "Email tasdiqlangan" : "Email hali tasdiqlanmagan"}</li>
              <li>Kasb Egalari platformasida {formatDate(job.client.memberSince)} dan</li>
              <li>
                {stats.posted} ta e'lon joylagan{stats.hired > 0 ? ` · ${stats.hired} tasida mutaxassis yollagan` : ""}
              </li>
            </ul>
          </div>

          <div className="card-outline flex items-start gap-3 p-4">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-success-text" aria-hidden="true" />
            <p className="text-[12.5px] leading-relaxed text-fg-2">
              To'lovni faqat Kasb Egalari eskrou orqali qiling: pul ish qabul qilinguncha platformada saqlanadi, nizo bo'lsa — admin hal qiladi.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Notice({
  icon: Icon,
  title,
  text,
  action,
  tone = "neutral",
}: {
  icon: typeof Lock;
  title: string;
  text: string;
  action?: React.ReactNode;
  tone?: "neutral" | "warning";
}) {
  return (
    <section className={tone === "warning" ? "rounded-[var(--r-md)] border border-warning/30 bg-warning-soft p-5" : "card p-5 sm:p-6"}>
      <div className="flex items-start gap-3">
        <span className={tone === "warning" ? "mt-0.5 shrink-0 text-warning-text" : "icon-tile-soft icon-tile-sm shrink-0"} aria-hidden="true">
          <Icon size={tone === "warning" ? 20 : 16} />
        </span>
        <div className="min-w-0">
          <h2 className={tone === "warning" ? "text-[16px] font-semibold text-warning-text" : "font-display text-[17px] font-semibold text-fg"}>{title}</h2>
          <p className={tone === "warning" ? "mt-1 text-[13.5px] leading-relaxed text-warning-text" : "mt-1 text-[14px] leading-relaxed text-fg-3"}>{text}</p>
          {action && <div className="mt-4">{action}</div>}
        </div>
      </div>
    </section>
  );
}

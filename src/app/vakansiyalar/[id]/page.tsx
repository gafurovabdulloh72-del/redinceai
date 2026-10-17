import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Building2, CalendarDays, Clock3, Eye, MapPin, Pencil, Users, Wallet } from "lucide-react";
import { Avatar } from "@/components/ui";
import { ApplyForm } from "@/components/vacancies/ApplyForm";
import { SaveVacancyButton } from "@/components/vacancies/SaveVacancyButton";
import { VacancyCard } from "@/components/vacancies/VacancyCard";
import { ShareButton } from "@/components/specialists/ShareButton";
import { getCurrentUser } from "@/lib/auth";
import { EMPLOYMENT, EXPERIENCE, WORK_FORMAT, professionLabel, salaryLabel, vacancyRegionLabel } from "@/lib/vacancies/format";
import { bumpVacancyView, getResume, getVacancyView, loadVacancy, similarVacancies } from "@/lib/vacancies/service";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const v = await loadVacancy(id);
  if (!v) return { title: "Vakansiya topilmadi" };
  const closed = v.status !== "open" || (v.expiresAt && v.expiresAt.getTime() < Date.now());
  return {
    title: `${v.title}${v.company ? ` — ${v.company}` : ""}`,
    description: v.description.slice(0, 160),
    alternates: { canonical: `/vakansiyalar/${v.id}` },
    robots: closed ? { index: false, follow: false } : undefined,
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-display text-[18px] font-semibold text-fg">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Vakansiya sahifasi: tavsif, talablar, ko'nikmalar; yon panel — ariza (yoki egasi paneli) va statistika */
export default async function VacancyPage({ params }: { params: Params }) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  const viewer = user ? { id: user.id, role: user.role } : null;
  const v = await getVacancyView(id, viewer);
  if (!v) notFound();
  const raw = await loadVacancy(v.id);
  const [resume, similar] = await Promise.all([user ? getResume(user.id) : Promise.resolve(null), raw ? similarVacancies(raw, 3) : Promise.resolve([]), v.isOwner ? Promise.resolve() : bumpVacancyView(v.id)]);
  const closed = v.status !== "open" || v.expired;
  const daysLeft = v.expiresAt ? Math.max(0, Math.ceil((v.expiresAt - Date.now()) / 86_400_000)) : null;
  const reqLines = v.requirements
    .split(/\n+/)
    .map((s) => s.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

  return (
    <div className="container-x animate-fade-up">
      <nav aria-label="Yo'l" className="text-[13px] text-fg-3">
        <Link href="/vakansiyalar" className="transition hover:text-fg">
          Vakansiyalar
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-fg-2">{professionLabel(v.profession, true)}</span>
      </nav>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-5 lg:col-span-8">
          <header className="card p-5 sm:p-7">
            {closed && (
              <p role="status" className="mb-4 rounded-[14px] border border-warning/30 bg-warning-soft px-4 py-2.5 text-[13px] font-semibold text-warning-text">
                {v.status === "closed" ? "Bu vakansiya yopilgan — o'rin to'ldirilgan." : "Bu vakansiyaning muddati o'tgan."} Shunga o&apos;xshash ochiq vakansiyalarni{" "}
                <Link href={`/vakansiyalar?profession=${v.profession}`} className="underline underline-offset-2">
                  ko&apos;ring
                </Link>
                .
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
              <span className="rounded-full bg-fg/6 px-2.5 py-1 text-fg-2">{professionLabel(v.profession)}</span>
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1", v.format === "remote" ? "bg-info-soft text-info-text" : "border border-line text-fg-2")}>
                <MapPin size={12} /> {WORK_FORMAT[v.format]}
                {v.format !== "remote" && ` · ${vacancyRegionLabel(v.regionSlug, true)}`}
              </span>
              <span className="rounded-full border border-line px-2.5 py-1 text-fg-2">{EMPLOYMENT[v.employment]}</span>
              <span className="rounded-full border border-line px-2.5 py-1 text-fg-2">{EXPERIENCE[v.experience]}</span>
            </div>
            <h1 className="display-xl mt-4 text-[28px] text-fg sm:text-[38px]">{v.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13.5px] text-fg-2">
              <span className="inline-flex items-center gap-1.5">
                <Building2 size={14} className="text-fg-3" /> {v.company || "Shaxsiy ish beruvchi"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Avatar name={v.author.name} src={v.author.avatarUrl} size={20} decorative />
                {v.author.specialistSlug ? (
                  <Link href={`/mutaxassislar/${v.author.specialistSlug}`} className="font-semibold underline-offset-2 hover:underline">
                    {v.author.name}
                  </Link>
                ) : (
                  <span className="font-semibold">{v.author.name}</span>
                )}
                {v.author.emailVerified && <BadgeCheck size={14} className="text-success-text" aria-label="Email tasdiqlangan" />}
              </span>
              <span className="inline-flex items-center gap-1.5 text-fg-3" suppressHydrationWarning>
                <Clock3 size={13} /> {timeAgo(v.createdAt)}
              </span>
            </div>
            <p className="mt-5 inline-flex items-baseline gap-2 font-display text-[26px] font-semibold text-fg">
              <Wallet size={20} className="self-center text-accent" />
              {salaryLabel(v.salaryMin, v.salaryMax)}
              {(v.salaryMin || v.salaryMax) && <span className="text-[14px] font-medium text-fg-3">so&apos;m / oy</span>}
            </p>
          </header>

          <Section title="Vazifalar va shartlar">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-fg-2">{v.description}</p>
          </Section>
          {reqLines.length > 0 && (
            <Section title="Talablar">
              <ul className="grid gap-2 text-[14.5px] leading-relaxed text-fg-2">
                {reqLines.map((l, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {l}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {v.skills.length > 0 && (
            <Section title="Ko'nikmalar">
              <ul className="flex flex-wrap gap-2">
                {v.skills.map((s) => (
                  <li key={s} className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[13px] font-medium text-fg-2">
                    {s}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:col-span-4">
          {v.isOwner ? (
            <div className="card p-5">
              <p className="text-[15px] font-semibold text-fg">Bu sizning vakansiyangiz</p>
              <p className="mt-1 text-[13px] text-fg-3">
                {v.applicationsCount} ta ariza · {v.viewCount} ta ko&apos;rish{daysLeft !== null && !closed ? ` · ${daysLeft} kun qoldi` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/kabinet/vakansiyalar?v=${v.id}`} className="btn-ink inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold">
                  <Users size={15} /> Nomzodlar
                </Link>
                <Link href={`/vakansiyalar/${v.id}/tahrir`} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg">
                  <Pencil size={14} /> Tahrirlash
                </Link>
              </div>
            </div>
          ) : closed ? null : (
            <ApplyForm vacancyId={v.id} loggedIn={Boolean(user)} hasResume={Boolean(resume)} resumeTitle={resume?.title} initialMine={v.myApplication} applyUrl={v.applyUrl} />
          )}
          {!v.isOwner && (
            <div className="flex flex-wrap gap-2">
              <SaveVacancyButton vacancyId={v.id} initialSaved={v.savedByMe} loggedIn={Boolean(user)} className="flex-1 justify-center" />
              <ShareButton title={`${v.title}${v.company ? ` — ${v.company}` : ""}`} size="md" variant="outline" iconOnly />
            </div>
          )}
          <div className="card p-5">
            <dl className="grid gap-2.5 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="inline-flex items-center gap-1.5 text-fg-3">
                  <Users size={13} /> Arizalar
                </dt>
                <dd className="font-semibold text-fg">{v.applicationsCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="inline-flex items-center gap-1.5 text-fg-3">
                  <Eye size={13} /> Ko&apos;rishlar
                </dt>
                <dd className="font-semibold text-fg">{v.viewCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="inline-flex items-center gap-1.5 text-fg-3">
                  <CalendarDays size={13} /> Joylangan
                </dt>
                <dd className="font-semibold text-fg">{formatDateTime(v.createdAt)}</dd>
              </div>
              {daysLeft !== null && !closed && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="inline-flex items-center gap-1.5 text-fg-3">
                    <Clock3 size={13} /> Muddati
                  </dt>
                  <dd className="font-semibold text-fg">{daysLeft} kun qoldi</dd>
                </div>
              )}
            </dl>
          </div>
          <p className="px-1 text-[12px] leading-relaxed text-fg-4">Shubhali e&apos;lon (oldindan to&apos;lov so&apos;rash, shaxsiy hujjat talab qilish) bo&apos;lsa — @montajor_man ga yozing. Platforma vakansiyalar uchun to&apos;lov olmaydi.</p>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-10" aria-labelledby="similar-h" data-reveal>
          <h2 id="similar-h" className="font-display text-[20px] font-semibold text-fg">
            Shunga o&apos;xshash vakansiyalar
          </h2>
          <ul className="stagger mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((s) => (
              <li key={s.id} className="min-w-0">
                <VacancyCard v={s} headingLevel="h3" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

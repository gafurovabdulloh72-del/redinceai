import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BadgeCheck, Pencil, Users, ArrowRight } from "lucide-react";
import { Avatar } from "@/components/ui";
import { ApplyForm } from "@/components/vacancies/ApplyForm";
import { StickyCta } from "@/components/ui/StickyCta";
import { SaveVacancyButton } from "@/components/vacancies/SaveVacancyButton";
import { VacancyCard } from "@/components/vacancies/VacancyCard";
import { ShareButton } from "@/components/specialists/ShareButton";
import { TelegramShare } from "@/components/ui/TelegramShare";
import { getCurrentUser } from "@/lib/auth";
import { EMPLOYMENT, EXPERIENCE, WORK_FORMAT, daysLeftLabel, professionLabel, salaryLabel, vacancyRegionLabel } from "@/lib/vacancies/format";
import { bumpVacancyView, employerVacancies, getResume, getVacancyView, loadVacancy, similarVacancies } from "@/lib/vacancies/service";
import { isBotUserAgent } from "@/lib/privacy";
import { SITE_URL } from "@/lib/site-url";
import { formatDate, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
type Params = Promise<{ id: string }>;

/** schema.org employmentType qiymatlari */
const EMPLOYMENT_SCHEMA: Record<string, string> = { full: "FULL_TIME", part: "PART_TIME", project: "CONTRACTOR", internship: "INTERN" };

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const v = await loadVacancy(id);
  // notFound() aynan SHU YERDA: `[id]/loading.tsx` Suspense chegarasi sahifa tanasidagi
  // notFound() dan oldin javobni oqizib yuboradi va holat 200 bo‘lib qoladi (yumshoq 404).
  // generateMetadata oqimdan oldin ishlaydi — haqiqiy 404 shu yerdan chiqadi.
  if (!v) notFound();
  const closed = v.status !== "open" || (v.expiresAt && v.expiresAt.getTime() < Date.now());
  return {
    title: `${v.title}${v.company ? ` — ${v.company}` : ""}`,
    description: v.description.replace(/\s+/g, " ").trim().slice(0, 160),
    alternates: { canonical: `/vakansiyalar/${v.id}` },
    robots: closed ? { index: false, follow: false } : undefined,
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6" data-reveal>
      <h2 className="font-display text-[18px] font-semibold text-fg">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Vakansiya sahifasi: tavsif, talablar, ko'nikmalar; yon panel — ariza (yoki egasi paneli) va statistika */
export default async function VacancyPage({ params }: { params: Params }) {
  const [{ id }, user, hdrs] = await Promise.all([params, getCurrentUser(), headers()]);
  const viewer = user ? { id: user.id, role: user.role } : null;
  const v = await getVacancyView(id, viewer);
  if (!v) notFound();
  const raw = await loadVacancy(v.id);
  // Ko'rishlar: egasi va botlar (crawler, skrinshot, curl) sanalmaydi
  const [resume, similar, fromEmployer] = await Promise.all([
    user ? getResume(user.id) : Promise.resolve(null),
    raw ? similarVacancies(raw, 3) : Promise.resolve([]),
    raw ? employerVacancies(raw, 3) : Promise.resolve([]),
    v.isOwner || isBotUserAgent(hdrs.get("user-agent")) ? Promise.resolve() : bumpVacancyView(v.id),
  ]);
  const closed = v.status !== "open" || v.expired;
  const daysLeft = v.expiresAt ? Math.max(0, Math.ceil((v.expiresAt - Date.now()) / 86_400_000)) : null;
  const employerHref = `/vakansiyalar/kompaniya/${v.author.username ?? v.author.id}`;
  const reqLines = v.requirements
    .split(/\n+/)
    .map((s) => s.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

  // SEO: schema.org JobPosting (Google "Ish o'rinlari" bloki) — faqat ochiq vakansiyalar uchun
  const jobPosting = closed
    ? null
    : {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: v.title,
        description: [v.description, v.requirements].filter(Boolean).join("\n\n"),
        datePosted: new Date(v.createdAt).toISOString(),
        validThrough: v.expiresAt ? new Date(v.expiresAt).toISOString() : undefined,
        employmentType: EMPLOYMENT_SCHEMA[v.employment],
        hiringOrganization: { "@type": "Organization", name: v.company || v.author.name },
        identifier: { "@type": "PropertyValue", name: "Kasb Egalari", value: v.id },
        url: `${SITE_URL}/vakansiyalar/${v.id}`,
        directApply: !v.applyUrl,
        jobLocationType: v.format === "remote" ? "TELECOMMUTE" : undefined,
        applicantLocationRequirements: v.format === "remote" ? { "@type": "Country", name: "Uzbekistan" } : undefined,
        jobLocation: v.format !== "remote" ? { "@type": "Place", address: { "@type": "PostalAddress", addressRegion: vacancyRegionLabel(v.regionSlug, true), addressCountry: "UZ" } } : undefined,
        baseSalary:
          v.salaryMin || v.salaryMax
            ? { "@type": "MonetaryAmount", currency: "UZS", value: { "@type": "QuantitativeValue", minValue: v.salaryMin ?? undefined, maxValue: v.salaryMax ?? undefined, unitText: "MONTH" } }
            : undefined,
      };

  return (
    <div className="container-x animate-fade-up">
      {/* `<` ekranlanadi: title/description/company — foydalanuvchi matni, aks holda `</script>` bilan chiqib ketish mumkin */}
      {jobPosting && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPosting).replace(/</g, "\\u003c") }} />}
      {/* Yo'l (breadcrumb) — Google natijalarda «Vakansiyalar › Kasb › E'lon» ko'rsatadi */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Vakansiyalar", item: `${SITE_URL}/vakansiyalar` },
              { "@type": "ListItem", position: 2, name: professionLabel(v.profession), item: `${SITE_URL}/vakansiyalar/kasb/${v.profession}` },
              { "@type": "ListItem", position: 3, name: v.title, item: `${SITE_URL}/vakansiyalar/${v.id}` },
            ],
          }).replace(/</g, "\\u003c"),
        }}
      />
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
              <span className={v.format === "remote" ? "rounded-full bg-info-soft px-2.5 py-1 text-info-text" : "rounded-full border border-line px-2.5 py-1 text-fg-2"}>
                {WORK_FORMAT[v.format]}
                {v.format !== "remote" && ` · ${vacancyRegionLabel(v.regionSlug, true)}`}
              </span>
              <span className="text-fg-3">
                {professionLabel(v.profession, true)} · {EMPLOYMENT[v.employment]} · {EXPERIENCE[v.experience]}
              </span>
            </div>
            <h1 className="display-xl mt-4 text-[28px] text-fg sm:text-[38px]">{v.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13.5px] text-fg-2">
              <Link href={employerHref} className="inline-flex items-center gap-1.5 font-semibold underline-offset-2 hover:underline">
                <Avatar name={v.author.name} src={v.author.avatarUrl} size={20} decorative />
                {v.company || v.author.name}
                {v.author.emailVerified && <BadgeCheck size={14} className="text-success-text" aria-label="Email tasdiqlangan" />}
              </Link>
              {v.company && <span className="text-fg-3">{v.author.name}</span>}
              <span className="text-fg-3" suppressHydrationWarning>
                {timeAgo(v.createdAt)}
              </span>
            </div>
            <p className="mt-5 flex flex-wrap items-baseline gap-2 font-display text-[26px] font-semibold text-fg">
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
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-fg-3" />
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

        <aside id="ariza" className="min-w-0 scroll-mt-20 space-y-4 lg:sticky lg:top-24 lg:col-span-4">
          {v.isOwner ? (
            <div className="card p-5">
              <p className="text-[15px] font-semibold text-fg">Bu sizning vakansiyangiz</p>
              <p className="mt-1 text-[13px] text-fg-3">
                {v.applicationsCount} ta ariza · {v.viewCount} ta ko&apos;rish{v.applyUrl ? ` · ${v.applyClicks} ta tashqi o'tish` : ""}
                {daysLeft !== null && !closed ? ` · ${daysLeftLabel(daysLeft)}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/kabinet/vakansiyalar?v=${v.id}`} className="btn-ink press inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold">
                  <Users size={15} /> Nomzodlar
                </Link>
                <Link href={`/vakansiyalar/${v.id}/tahrir`} className="press inline-flex h-10 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg">
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
              <TelegramShare path={`/vakansiyalar/${v.id}`} text={`${v.title}${v.company ? ` — ${v.company}` : ""} · Kasb Egalari`} />
            </div>
          )}
          <dl className="grid gap-2 px-1 text-[13px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-fg-3">Arizalar</dt>
              <dd className="font-semibold text-fg">{v.applicationsCount}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-fg-3">Joylangan</dt>
              <dd className="font-semibold text-fg">{formatDate(v.createdAt)}</dd>
            </div>
            {daysLeft !== null && !closed && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-3">Muddati</dt>
                <dd className={daysLeft <= 3 ? "font-semibold text-warning-text" : "font-semibold text-fg"}>{daysLeftLabel(daysLeft)}</dd>
              </div>
            )}
          </dl>
          <p className="px-1 text-[12px] leading-relaxed text-fg-4">Oldindan to&apos;lov yoki hujjat so&apos;ralsa — @montajor_man ga yozing. Vakansiyalar uchun to&apos;lov olinmaydi.</p>
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

      {fromEmployer.length > 0 && (
        <section className="mt-10" aria-labelledby="employer-h" data-reveal>
          <h2 id="employer-h" className="font-display text-[20px] font-semibold text-fg">
            <Link href={employerHref} className="underline-offset-4 hover:underline">
              {v.company || v.author.name}
            </Link>{" "}
            — boshqa vakansiyalari
          </h2>
          <ul className="stagger mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fromEmployer.map((s) => (
              <li key={s.id} className="min-w-0">
                <VacancyCard v={s} headingLevel="h3" />
              </li>
            ))}
          </ul>
        </section>
      )}
      {/* Telefon: pastda yopishqoq «Ariza yuborish» — forma sahifa oxirida, ko'rinmay qolmasin (Udemy/HeadHunter odati). fixed emas — sticky */}
      {!v.isOwner && !closed && !v.myApplication && (
        <StickyCta targetId="ariza">
          <a href="#ariza" className="btn-accent press flex h-12 items-center justify-between rounded-full px-5 text-[15px] font-semibold shadow-[var(--shadow-3)]">
            <span className="truncate">{salaryLabel(v.salaryMin, v.salaryMax)}</span>
            <span className="inline-flex items-center gap-1.5">Ariza yuborish <ArrowRight size={16} /></span>
          </a>
        </StickyCta>
      )}
    </div>
  );
}

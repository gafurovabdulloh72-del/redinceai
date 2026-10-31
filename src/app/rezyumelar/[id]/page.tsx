import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BadgeCheck, ExternalLink, MessageCircle, Pencil, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui";
import { PrintButton } from "@/components/payments/PrintButton";
import { ShareButton } from "@/components/specialists/ShareButton";
import { ResumeCard } from "@/components/vacancies/ResumeCard";
import { getCurrentUser } from "@/lib/auth";
import { SITE_URL } from "@/lib/site-url";
import { isBotUserAgent } from "@/lib/privacy";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { VAK, professionLabelTr, resumeExperienceTr, resumeFormatTr, salaryLabelTr, vacancyRegionTr } from "@/lib/i18n/dict/vacancies";
import { REZ_SAHIFA, viewsCountTr } from "@/lib/i18n/dict/vacancies-kabinet";
import { bumpResumeView, getResumeView, similarResumes } from "@/lib/vacancies/service";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
type Params = Promise<{ id: string }>;

/** Chop etish / PDF: sayt qobig'i, yon panel va tugmalar yashirinadi — faqat rezyume */
const PRINT_CSS = `
@media print {
  body > *:not(main), .no-print { display: none !important; }
  main { padding: 0 !important; }
  body { background: #fff !important; }
  .resume-grid { display: block !important; }
  .resume-grid > * + * { margin-top: 12px !important; }
  .card { box-shadow: none !important; border: 1px solid #ddd !important; break-inside: avoid; }
  .card, .card * { color: #111 !important; }
}
@page { margin: 14mm; }
`;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ id }, user, til] = await Promise.all([params, getCurrentUser(), getLocale()]);
  // Yopiq rezyume egasi uchun ham to'g'ri sarlavha (ko'ruvchi bilan)
  const r = await getResumeView(id, user ? { id: user.id, role: user.role } : null);
  // notFound() aynan SHU YERDA: `[id]/loading.tsx` Suspense chegarasi sahifa tanasidagi
  // notFound() dan oldin javobni oqizib yuboradi va holat 200 bo‘lib qoladi (yumshoq 404).
  // generateMetadata oqimdan oldin ishlaydi — haqiqiy 404 shu yerdan chiqadi.
  if (!r) notFound();
  return { title: `${r.title} — ${r.user.name}`, description: r.summary.replace(/\s+/g, " ").trim().slice(0, 160) || `${r.user.name}: ${professionLabelTr(til, r.profession)}`, alternates: { canonical: `/rezyumelar/${r.id}` }, robots: r.isPublic ? undefined : { index: false } };
}

/** Ommaviy rezyume: kontaktsiz — "Chatda yozish" (kirgan foydalanuvchi) va mutaxassis profili havolasi; chop etish / PDF */
export default async function ResumePage({ params }: { params: Params }) {
  const [{ id }, user, hdrs, til] = await Promise.all([params, getCurrentUser(), headers(), getLocale()]);
  const r = await getResumeView(id, user ? { id: user.id, role: user.role } : null);
  if (!r) notFound();
  // Ko'rishlar: egasi va botlar sanalmaydi; natija kutilmaydi
  if (!r.isOwner && r.isPublic && !isBotUserAgent(hdrs.get("user-agent"))) void bumpResumeView(r.id).catch(() => {});
  // Shu kasbdagi boshqa nomzodlar — faqat ommaviy rezyumeda (yopiqda ro'yxat ko'rsatilmaydi)
  const similar = r.isPublic ? await similarResumes({ id: r.id, profession: r.profession }, 3) : [];
  return (
    <div className="container-x animate-fade-up">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      {r.isPublic && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: tr(til, VAK.resumes), item: `${SITE_URL}/rezyumelar` },
                { "@type": "ListItem", position: 2, name: professionLabelTr(til, r.profession), item: `${SITE_URL}/rezyumelar?kasb=${r.profession}` },
                { "@type": "ListItem", position: 3, name: r.title, item: `${SITE_URL}/rezyumelar/${r.id}` },
              ],
            }).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <nav aria-label={tr(til, REZ_SAHIFA.breadcrumbAria)} className="no-print text-[13px] text-fg-3">
        <Link href="/rezyumelar" className="transition hover:text-fg">
          {tr(til, VAK.resumes)}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-fg-2">{r.user.name}</span>
      </nav>
      <div className="resume-grid mt-4 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-5 lg:col-span-8">
          <header className="card m-flat p-5 sm:p-7">
            {!r.isPublic && <p className="no-print mb-4 rounded-[14px] bg-warning-soft px-4 py-2.5 text-[13px] font-semibold text-warning-text">{r.isOwner ? tr(til, REZ_SAHIFA.privateOwner) : tr(til, REZ_SAHIFA.privateViewer)}</p>}
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={r.user.name} src={r.user.avatarUrl} size={72} />
              <div className="min-w-0">
                <h1 className="display-xl text-[26px] text-fg sm:text-[34px]">{r.title}</h1>
                <p className="mt-1 inline-flex items-center gap-1.5 text-[15px] text-fg-2">
                  {r.user.name}
                  {r.user.emailVerified && <BadgeCheck size={15} className="text-success-text" aria-label={tr(til, REZ_SAHIFA.emailVerified)} />}
                </p>
              </div>
            </div>
            <p className="mt-4 text-[13px] text-fg-2">
              {professionLabelTr(til, r.profession)} · {resumeExperienceTr(til, r.experience)} · {resumeFormatTr(til, r.format)}
              {r.format !== "remote" && ` · ${vacancyRegionTr(til, r.regionSlug, true)}`}
            </p>
            <p className="mt-4 flex flex-wrap items-baseline gap-2 font-display text-[22px] font-semibold text-fg">
              {salaryLabelTr(til, r.expectedSalary, null)}
              {r.expectedSalary && <span className="text-[13px] font-medium text-fg-3">{tr(til, REZ_SAHIFA.perMonth)}</span>}
            </p>
          </header>
          {r.summary && (
            <section className="card m-flat p-5 sm:p-6">
              <h2 className="font-display text-[18px] font-semibold text-fg">{tr(til, REZ_SAHIFA.about)}</h2>
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-fg-2">{r.summary}</p>
            </section>
          )}
          {r.skills.length > 0 && (
            <section className="card m-flat p-5 sm:p-6">
              <h2 className="font-display text-[18px] font-semibold text-fg">{tr(til, VAK.skills)}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {r.skills.map((s) => (
                  <li key={s} className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[13px] font-medium text-fg-2">
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {r.links.length > 0 && (
            <section className="card m-flat p-5 sm:p-6">
              <h2 className="font-display text-[18px] font-semibold text-fg">{tr(til, REZ_SAHIFA.links)}</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {r.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center justify-between gap-2 rounded-[14px] border border-line px-4 py-3 text-[14px] font-semibold text-fg transition hover:border-fg">
                      <span className="truncate">{l.label}</span>
                      <ExternalLink size={14} className="shrink-0 text-fg-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside className="no-print min-w-0 space-y-4 lg:sticky lg:top-24 lg:col-span-4">
          <div className="card m-flat p-5">
            {r.isOwner ? (
              <>
                <p className="text-[15px] font-semibold text-fg">{tr(til, REZ_SAHIFA.yourResume)}</p>
                <p className="mt-1 text-[13px] text-fg-3">{viewsCountTr(til, r.viewCount)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/kabinet/rezyume" className="btn-ink press inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold">
                    <Pencil size={14} /> {tr(til, VAK.edit)}
                  </Link>
                  <PrintButton className="!h-10 !text-[13px]" variant="outline" fileName={`rezyume-${r.user.name}`} />
                </div>
              </>
            ) : (
              <>
                <p className="text-[15px] font-semibold text-fg">{tr(til, REZ_SAHIFA.contactTitle)}</p>
                <p className="mt-1 text-[13px] text-fg-3">{tr(til, REZ_SAHIFA.contactHint)}</p>
                <div className="mt-3 grid gap-2">
                  {r.user.username ? (
                    <Link href={user ? `/yozish/${r.user.username}` : `/auth/kirish?next=${encodeURIComponent(`/yozish/${r.user.username}`)}`} className="btn-ink press inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-semibold">
                      <MessageCircle size={15} /> {tr(til, REZ_SAHIFA.writeInChat)}
                    </Link>
                  ) : null}
                  {r.user.specialistSlug && (
                    <Link href={`/mutaxassislar/${r.user.specialistSlug}`} className="press inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-line-2 px-4 text-[14px] font-semibold text-fg">
                      <UserRound size={15} /> {tr(til, REZ_SAHIFA.specialistProfile)}
                    </Link>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PrintButton className="!h-10 !text-[13px]" variant="outline" fileName={`rezyume-${r.user.name}`} />
                  <ShareButton title={`${r.title} — ${r.user.name}`} size="md" variant="outline" iconOnly />
                </div>
              </>
            )}
          </div>
          <p className="px-1 text-[12px] text-fg-4">{tr(til, REZ_SAHIFA.updated)}: {formatDate(r.updatedAt, til)}</p>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-10" aria-label={tr(til, REZ_SAHIFA.similarAria)}>
          <h2 className="display-xl mb-3 text-[20px] text-fg max-sm:px-4">{tr(til, REZ_SAHIFA.similarTitle)}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-sm:gap-0 max-sm:divide-y max-sm:divide-line max-sm:border-y max-sm:border-line">
            {similar.map((x) => (
              <ResumeCard key={x.id} r={x} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

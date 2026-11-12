import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, CheckCircle2, Send, ShieldCheck, ChevronLeft, ChevronRight, ClipboardCheck, Clock, Download, Infinity, Languages, ListChecks, Lock, PlayCircle, RefreshCw, Smartphone, Star, Target, Users } from "lucide-react";
import { Avatar } from "@/components/ui";
import { EnrollButton } from "@/components/mentorship/EnrollButton";
import { RefCapture } from "@/components/mentorship/PurchaseDialog";
import { MENTOR_FEATURES } from "@/lib/mentorship/format";
import { ReferralCard } from "@/components/mentorship/ReferralCard";
import { CourseReviewForm } from "@/components/mentorship/CourseReviewForm";
import { CourseCard } from "@/components/mentorship/CourseCard";
import { CoursePreview } from "@/components/mentorship/CoursePreview";
import { CourseSaveButton } from "@/components/mentorship/CourseSaveButton";
import { ShareButton } from "@/components/specialists/ShareButton";
import { StickyCta } from "@/components/ui/StickyCta";
import { getCurrentUser } from "@/lib/auth";
import { SITE_URL } from "@/lib/site-url";
import { getSettings } from "@/lib/payments/settings";
import { formatUsd } from "@/lib/utils";
import { recordCourseView } from "@/lib/mentorship/growth";
import { getCourseBySlug, similarCourses } from "@/lib/mentorship/service";
import { cn } from "@/lib/utils";
import { getLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { timeAgoLabel } from "@/lib/i18n/dict/catalog";
import { MS, categoryLabelTr, formatDurationTr, formatSomTr, languageLabelTr, lessonsTaTr, lessonsTr, levelLabelTr, reviewsTr, sectionsTr, studentsTr } from "@/lib/i18n/dict/mentorship";

import { jsonLdHtml } from "@/lib/seo/json-ld";
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [user, til] = await Promise.all([getCurrentUser(), getLocale()]);
  const c = await getCourseBySlug(slug, user?.id ?? null, user?.role === "admin");
  if (!c) return { title: tr(til, MS.courseNotFound) };
  return { title: `${c.title} — ${tr(til, MS.metaSuffix)}`, description: c.summary || MS.courseOf[til](c.mentor.name), alternates: { canonical: `/mentorlik/${slug}` }, other: { "m-title": c.title } };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [user, til] = await Promise.all([getCurrentUser(), getLocale()]);
  const c = await getCourseBySlug(slug, user?.id ?? null, user?.role === "admin");
  if (!c) notFound();
  // O'xshash kurslar — shu yo'nalishdagi mashhurlar (vakansiyalarda allaqachon bor edi)
  const similar = await similarCourses(c.id, c.category, 3);

  /*
   * JSON-LD (2026-10-29): kurs sahifasida tuzilgan ma'lumot YO'Q edi — Google kursni
   * oddiy sahifa deb oladi. `Course` sxemasi bilan natijalarda ustoz, reyting va narx
   * ko'rinishi mumkin; `BreadcrumbList` — «Mentorlik › Kurs» yo'li.
   * `<` ekranlanadi (XSS): sarlavha/tavsif foydalanuvchi matni.
   */
  // Kamchilik #47: bepul namuna dars uchun VideoObject (faqat ommaviy video)
  const videoLd = c.previewVideo
    ? [
        {
          "@type": "VideoObject",
          name: `${c.title} — ${c.previewVideo.title}`,
          description: c.summary || c.title,
          thumbnailUrl: c.coverUrl ? [c.coverUrl.startsWith("http") ? c.coverUrl : `${SITE_URL}${c.coverUrl}`] : undefined,
          contentUrl: `${SITE_URL}${c.previewVideo.url}`,
          uploadDate: new Date(c.createdAt).toISOString(),
          ...(c.previewVideo.durationMin ? { duration: `PT${c.previewVideo.durationMin}M` } : {}),
        },
      ]
    : [];
  // Kamchilik #57: narx yonida taxminiy $ ekvivalenti
  const settings = await getSettings().catch(() => null);
  const usdRate = settings?.usdRate ?? 0;
  const refundDays = settings?.courseRefundDays ?? 0;
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      ...videoLd,
      {
        "@type": "Course",
        name: c.title,
        description: c.summary || c.title,
        url: `${SITE_URL}/mentorlik/${c.slug}`,
        inLanguage: "uz",
        provider: { "@type": "Organization", name: "Kasb Egalari", url: SITE_URL },
        ...(c.mentor?.name ? { author: { "@type": "Person", name: c.mentor.name } } : {}),
        ...(c.reviewsCount > 0 && c.rating > 0
          ? { aggregateRating: { "@type": "AggregateRating", ratingValue: c.rating, reviewCount: c.reviewsCount, bestRating: 5, worstRating: 1 } }
          : {}),
        offers: { "@type": "Offer", price: c.priceFrom, priceCurrency: "UZS", availability: "https://schema.org/InStock", url: `${SITE_URL}/mentorlik/${c.slug}` },
        hasCourseInstance: { "@type": "CourseInstance", courseMode: "online", courseWorkload: `PT${Math.max(1, c.lessonsCount)}H` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Mentorlik", item: `${SITE_URL}/mentorlik` },
          { "@type": "ListItem", position: 2, name: c.title, item: `${SITE_URL}/mentorlik/${c.slug}` },
        ],
      },
    ],
  };
  if (!c.isOwner && user?.role !== "admin") void recordCourseView(c.id).catch(() => undefined);

  const firstLesson = c.lessons[0]?.id ?? null;
  const resumeLesson = c.lessons.find((l) => !l.completed)?.id ?? firstLesson;

  // «Bu kursga kiradi» bandlari — aside (keng ekran) va asosiy ustunda (telefon) bir xil ro'yxat
  const inc = (icon: React.ReactNode, text: string, key: string) => (
    <li key={key} className="flex items-center gap-2">
      <span className="grid h-5 w-5 shrink-0 place-items-center text-fg-3">{icon}</span>
      <span>{text}</span>
    </li>
  );
  const includes = [
    c.totalMin > 0 ? inc(<PlayCircle size={15} />, MS.videoLessons[til](formatDurationTr(til, c.totalMin)), "video") : inc(<PlayCircle size={15} />, lessonsTaTr(til, c.lessonsCount), "dars"),
    c.materialsCount > 0 ? inc(<Download size={15} />, MS.materialsN[til](c.materialsCount), "mat") : null,
    c.quizCount > 0 ? inc(<ListChecks size={15} />, MS.quizN[til](c.quizCount), "quiz") : null,
    c.assignmentCount > 0 ? inc(<ClipboardCheck size={15} />, MS.assignmentN[til](c.assignmentCount), "hw") : null,
    inc(<Smartphone size={15} />, tr(til, MS.onDevices), "dev"),
    inc(<Infinity size={15} />, tr(til, MS.unlimited), "inf"),
    inc(<Award size={15} />, tr(til, MS.certOnFinish), "cert"),
  ].filter(Boolean);

  // Udemy bo'limlari: ketma-ket bir xil `section` nomli darslar bitta guruh (bo'lim nomi bo'lmasa — bo'limsiz oqim)
  const sections = c.lessons.reduce<Array<{ name: string; items: typeof c.lessons; min: number; done: number }>>((acc, l) => {
    const last = acc[acc.length - 1];
    if (last && last.name === l.section) {
      last.items.push(l);
      last.min += l.durationMin || 0;
      last.done += l.completed ? 1 : 0;
    } else acc.push({ name: l.section, items: [l], min: l.durationMin || 0, done: l.completed ? 1 : 0 });
    return acc;
  }, []);
  const lessonRow = (l: (typeof c.lessons)[number]) => {
              const open = !l.locked;
              const inner = (
                <div className={cn("flex items-center gap-3 px-4 py-3", !open && "opacity-70")}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fg/6 text-[13px] font-bold tabular-nums text-fg-2">
                    {l.completed ? <CheckCircle2 size={17} className="text-success-text" /> : l.position}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-fg">{l.title}</span>
                    <span className="flex items-center gap-2 text-[12px] text-fg-4">
                      {l.durationMin > 0 && <span>{formatDurationTr(til, l.durationMin)}</span>}
                      {l.isPreview && !l.completed && <span className="font-semibold text-accent-text">{tr(til, MS.freePreview)}</span>}
                    </span>
                  </span>
                  {open ? <PlayCircle size={18} className="shrink-0 text-fg-3" /> : <Lock size={15} className="shrink-0 text-fg-4" />}
                </div>
              );
              return (
                <li key={l.id}>
                  {open ? (
                    <Link href={`/mentorlik/dars/${l.id}`} className="block transition hover:bg-fg/4">
                      {inner}
                    </Link>
                  ) : (
                    /* Qulflangan dars — «o'lik» qator emas: bosilganda narx/yozilish blokiga olib boradi */
                    <a href="#kursga-yozilish" className="block transition hover:bg-fg/4" aria-label={MS.opensAfterEnroll[til](l.title)}>
                      {inner}
                    </a>
                  )}
                </li>
              );
              };

  return (
    <div className="container-x py-6 sm:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(ld) }} />
      <RefCapture />
      <Link href="/mentorlik" className="mb-4 inline-flex items-center gap-1 text-[13px] font-semibold text-fg-3 transition hover:text-fg max-sm:hidden">
        <ChevronLeft size={15} /> {tr(til, MS.mentorship)}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Asosiy */}
        <div className="min-w-0">
          {/* Muqova + «Kursni ko'rib chiqish» (bepul namuna video shu yerda o'ynaydi) */}
          <CoursePreview coverUrl={c.coverUrl} title={c.title} preview={c.previewVideo} />

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px]">
            <span className="rounded-full bg-accent-soft px-2.5 py-1 font-bold text-accent-text">{categoryLabelTr(til, c.category)}</span>
            <span className="rounded-full bg-fg/6 px-2.5 py-1 font-semibold text-fg-2">{levelLabelTr(til, c.level)}</span>
            <span className="text-fg-4">{lessonsTr(til, c.lessonsCount)}</span>
            <span className="inline-flex items-center gap-1 text-fg-4"><Users size={13} /> {studentsTr(til, c.studentsCount)}</span>
            {c.rating > 0 && <span className="inline-flex items-center gap-1 text-fg-4"><Star size={13} className="fill-accent text-accent" /> {c.rating} ({c.reviewsCount})</span>}
          </div>

          <div className="mt-3 flex items-start gap-3">
            <h1 className="display-xl min-w-0 flex-1 text-fg">{c.title}</h1>
            {/* Kursni ulashish — ilgari kurs sahifasida ulashish yo'q edi (havolani qo'lda nusxalash kerak edi) */}
            <div className="mt-1 flex shrink-0 items-center gap-2">
              <CourseSaveButton courseId={c.id} initialSaved={c.savedByMe} loggedIn={Boolean(user)} />
              <ShareButton title={c.title} size="md" variant="outline" iconOnly />
            </div>
          </div>
          {c.summary && <p data-no-auto className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-fg-2">{c.summary}</p>}

          {/* Udemy uslubidagi meta qator: davomiylik · til · yangilangan · sertifikat */}
          <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-fg-3">
            {c.totalMin > 0 && <li className="inline-flex items-center gap-1"><Clock size={13} /> {formatDurationTr(til, c.totalMin)} {tr(til, MS.video)}</li>}
            <li className="inline-flex items-center gap-1"><Languages size={13} /> {MS.inLanguage[til](languageLabelTr(til, c.language))}</li>
            <li className="inline-flex items-center gap-1"><RefreshCw size={13} /> {tr(til, MS.updated)} {timeAgoLabel(til, c.updatedAt)}</li>
            <li className="inline-flex items-center gap-1"><Award size={13} /> {tr(til, MS.certGiven)}</li>
          </ul>

          {/* Telefonda «Bu kursga kiradi» asosiy ustunda (aside tepada, ro'yxat u yerda yashirin) */}
          <section className="card mt-5 p-4 m-flat sm:hidden" aria-labelledby="kurs-kiradi-m">
            <h2 id="kurs-kiradi-m" className="mb-2.5 text-[15px] font-bold text-fg">{tr(til, MS.includes)}</h2>
            <ul className="space-y-2 text-[13.5px] text-fg-2">{includes}</ul>
          </section>

          {/* Darslar — ENG MUHIM blok, shuning uchun tavsifdan keyin darhol (2026-11-01: oldin 4 ta bo'limdan keyin, pastda yashiringan edi) */}
          <h2 className="mb-2 mt-6 text-[15px] font-bold text-fg">
            {tr(til, MS.lessonsHead)} · {til === "ru" ? lessonsTr(til, c.lessonsCount) : `${c.lessonsCount} ta`}{sections.length > 1 ? ` · ${sectionsTr(til, sections.length)}` : ""}
          </h2>
          {sections.length > 1 ? (
            /* Bo'limlar: har biri yig'iladigan, sarlavhada dars soni va davomiylik; birinchisi ochiq */
            <div className="card divide-y divide-line overflow-hidden m-flat">
              {sections.map((sec, si) => (
                <details key={`${sec.name}-${si}`} open={si === 0 || sec.items.some((l) => !l.completed && !l.locked && c.enrolled)} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition hover:bg-fg/4 [&::-webkit-details-marker]:hidden">
                    <ChevronRight size={16} className="shrink-0 text-fg-4 transition group-open:rotate-90" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold text-fg">{sec.name || MS.sectionN[til](si + 1)}</span>
                      <span className="text-[12px] text-fg-4">
                        {lessonsTr(til, sec.items.length)}{sec.min > 0 ? ` · ${formatDurationTr(til, sec.min)}` : ""}
                        {sec.done > 0 ? ` · ${MS.doneOf[til](sec.done, sec.items.length)}` : ""}
                      </span>
                    </span>
                  </summary>
                  <ul className="divide-y divide-line border-t border-line bg-fg/[0.015]">{sec.items.map(lessonRow)}</ul>
                </details>
              ))}
            </div>
          ) : (
            <ul className="card divide-y divide-line overflow-hidden m-flat">{c.lessons.map(lessonRow)}</ul>
          )}
          {c.lessons.length === 0 && <p className="card px-4 py-6 text-center text-[13px] text-fg-3 m-flat">{tr(til, MS.lessonsSoon)}</p>}

          {/* Nimalarni o'rganasiz — ✓ ro'yxat (Udemy) */}
          {c.outcomes.length > 0 && (
            <section className="card mt-5 p-4 m-flat sm:p-5" aria-labelledby="kurs-natija">
              <h2 id="kurs-natija" className="mb-3 text-[15px] font-bold text-fg">{tr(til, MS.outcomes)}</h2>
              <ul className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
                {c.outcomes.map((o) => (
                  <li key={o} className="flex items-start gap-2 text-[14px] leading-snug text-fg-2">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-text" aria-hidden />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(c.requirements.length > 0 || c.audience) && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {c.requirements.length > 0 && (
                <section aria-labelledby="kurs-talab">
                  <h2 id="kurs-talab" className="mb-2 text-[15px] font-bold text-fg">{tr(til, MS.requirements)}</h2>
                  <ul className="space-y-1.5">
                    {c.requirements.map((r) => (
                      <li key={r} className="flex items-start gap-2 text-[14px] leading-snug text-fg-2">
                        <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-fg-3" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {c.audience && (
                <section aria-labelledby="kurs-kim">
                  <h2 id="kurs-kim" className="mb-2 flex items-center gap-1.5 text-[15px] font-bold text-fg"><Target size={15} className="text-fg-3" /> {tr(til, MS.audience)}</h2>
                  <p className="text-[14px] leading-relaxed text-fg-2">{c.audience}</p>
                </section>
              )}
            </div>
          )}

          {/* Mentor */}
          <Link href={c.mentor.slug ? `/mentorlik/ustoz/${c.mentor.slug}` : "/mentorlik"} className="card card-hover mt-5 flex items-start gap-3 p-4">
            <Avatar name={c.mentor.name} src={c.mentor.avatarUrl} size={48} decorative />
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-fg-4">{tr(til, MS.mentor)}</p>
              <p className="truncate text-[15px] font-semibold text-fg">{c.mentor.name}</p>
              <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-fg-3">{c.mentorBio || c.mentor.headline}</p>
            </div>
          </Link>

          {/* Sharhlar */}
          <h2 id="sharh" className="mb-2 mt-6 scroll-mt-24 text-[15px] font-bold text-fg">{tr(til, MS.reviews)} · {c.reviewsCount}</h2>
          {c.reviewsCount > 0 && (
            /* Udemy kabi reyting taqsimoti: katta ball + 5★…1★ chiziqlar */
            <div className="card flex items-center gap-5 p-4 m-flat">
              <div className="shrink-0 text-center">
                <p className="text-[34px] font-bold leading-none tabular-nums text-fg">{c.rating.toFixed(1)}</p>
                <p className="mt-1.5 flex justify-center gap-0.5" aria-label={`${c.rating} / 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={12} className={n <= Math.round(c.rating) ? "fill-accent text-accent" : "text-fg-4"} />
                  ))}
                </p>
                <p className="mt-1 text-[11.5px] text-fg-4">{reviewsTr(til, c.reviewsCount)}</p>
              </div>
              <ol className="min-w-0 flex-1 space-y-1.5" aria-label={tr(til, MS.ratingDist)}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const n = c.ratingDist[star - 1];
                  const pct = Math.round((n / c.reviewsCount) * 100);
                  return (
                    <li key={star} className="flex items-center gap-2 text-[12px] tabular-nums text-fg-3">
                      <span className="inline-flex w-6 shrink-0 items-center gap-0.5 font-semibold text-fg-2">
                        {star}
                        <Star size={10} className="fill-current" />
                      </span>
                      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-fg/8">
                        <span className="block h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-8 shrink-0 text-right">{pct}%</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
          {c.enrolled && <CourseReviewForm courseId={c.id} initial={c.myReview} />}
          <ul className="mt-3 space-y-3">
            {c.reviews.map((r) => (
              <li key={r.id} className="card p-4">
                <div className="flex items-center gap-2.5">
                  <Avatar name={r.name} src={r.avatarUrl} size={34} decorative />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-fg">{r.name}</p>
                    <p className="flex items-center gap-1 text-[12px] text-fg-4">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} size={12} className={n <= r.rating ? "fill-accent text-accent" : "text-fg-4"} />
                      ))}
                      <span className="ml-1">{timeAgoLabel(til, r.createdAt)}</span>
                    </p>
                  </div>
                </div>
                {r.body && <p data-no-auto className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-fg-2">{r.body}</p>}
              </li>
            ))}
            {c.reviews.length === 0 && <li className="text-[13px] text-fg-3">{tr(til, MS.noReviews)}</li>}
          </ul>
        </div>

        {/* Yon panel: narx + yozilish */}
        <aside id="kursga-yozilish" className="min-w-0 max-sm:order-first lg:sticky lg:top-24 lg:self-start">
          <div className="card-elevated p-5 m-flat max-sm:px-4 max-sm:pb-4 max-sm:pt-0">
            <p className="text-[26px] font-bold leading-none text-fg">{formatSomTr(til, c.priceFrom)}</p>
            {c.priceFrom > 0 && usdRate > 0 && <p className="mt-1 text-[12.5px] text-fg-3">{formatUsd(c.priceFrom, usdRate)}</p>}
            {c.enrolled && c.progressPct > 0 && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[12px] font-semibold text-fg-3">
                  <span>{tr(til, MS.progress)}</span>
                  <span className="tabular-nums text-fg">{c.progressPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-fg/10">
                  <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${c.progressPct}%` }} />
                </div>
              </div>
            )}
            <div className="mt-4">
              {c.isOwner ? (
                <Link href="/kabinet/mentorlik" className="btn-ink inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] text-[15px] font-semibold">
                  {tr(til, MS.editCourse)}
                </Link>
              ) : (
                <EnrollButton courseId={c.id} enrolled={c.enrolled} loggedIn={Boolean(user)} firstLessonId={c.enrolled ? resumeLesson : firstLesson} price={c.priceFrom} />
              )}
            </div>
            {/* Pulni qaytarish kafolati — admin sozlamasi (0 — ko'rsatilmaydi; va'dani faqat platforma bera oladi) */}
            {refundDays > 0 && c.priceFrom > 0 && !c.enrolled && !c.isOwner && (
              <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-fg-3">
                <ShieldCheck size={14} className="text-success-text" /> {MS.refundGuarantee[til](refundDays)}
              </p>
            )}
            {/* Yopiq Telegram guruh — server faqat kirish huquqi borlarga havola beradi */}
            {c.telegramUrl && (
              <a href={c.telegramUrl} target="_blank" rel="noopener noreferrer" className="press mt-3 flex items-center gap-3 rounded-[14px] border border-line p-3 transition-colors hover:border-line-2">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#229ED9] text-white">
                  <Send size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-fg">{tr(til, MS.tgJoin)}</span>
                  <span className="block text-[12px] text-fg-3">{tr(til, MS.tgJoinHint)}</span>
                </span>
              </a>
            )}
            {/* «Bu kursga kiradi» (Udemy): haqiqiy sonlar — video daqiqa, dars, material, test, vazifa */}
            <p className="mt-5 text-[13px] font-bold text-fg max-sm:hidden">{tr(til, MS.includes)}</p>
            <ul className="mt-2 space-y-2 text-[13px] text-fg-2 max-sm:hidden">{includes}</ul>
          </div>
          {MENTOR_FEATURES.referral && user && !c.isOwner && c.priceFrom > 0 && <div className="mt-3"><ReferralCard path={`/mentorlik/${c.slug}`} percent={c.refPercent} /></div>}
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-10" aria-label={tr(til, MS.similar)}>
          <h2 className="display-xl mb-3 text-[20px] text-fg max-sm:px-4">{tr(til, MS.similar)}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-sm:gap-0 max-sm:divide-y max-sm:divide-line max-sm:border-y max-sm:border-line">
            {similar.map((s) => (
              <CourseCard key={s.id} c={s} til={til} />
            ))}
          </div>
        </section>
      )}
      {/* Telefon: narx paneli tepada — darslarga aylantirilganda «Yozilish» ko'rinmay qoladi, yopishqoq CTA (panel ko'ringanda yashirinadi) */}
      {!c.isOwner && !c.enrolled && (
        <StickyCta targetId="kursga-yozilish">
          <a href="#kursga-yozilish" className="btn-accent press flex h-12 items-center justify-between rounded-full px-5 text-[15px] font-semibold shadow-[var(--shadow-3)]">
            <span className="truncate">{formatSomTr(til, c.priceFrom)}</span>
            <span className="inline-flex items-center gap-1.5">{c.priceFrom ? tr(til, MS.enroll) : tr(til, MS.startFree)} <ChevronLeft size={16} className="rotate-180" /></span>
          </a>
        </StickyCta>
      )}
    </div>
  );
}

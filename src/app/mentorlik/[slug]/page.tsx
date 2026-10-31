import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Clock, Download, Infinity, Languages, ListChecks, Lock, PlayCircle, RefreshCw, Smartphone, Star, Target, Users } from "lucide-react";
import { Avatar } from "@/components/ui";
import { EnrollButton } from "@/components/mentorship/EnrollButton";
import { RefCapture } from "@/components/mentorship/PurchaseDialog";
import { ReferralCard } from "@/components/mentorship/ReferralCard";
import { CourseReviewForm } from "@/components/mentorship/CourseReviewForm";
import { CourseCard } from "@/components/mentorship/CourseCard";
import { CoursePreview } from "@/components/mentorship/CoursePreview";
import { CourseSaveButton } from "@/components/mentorship/CourseSaveButton";
import { ShareButton } from "@/components/specialists/ShareButton";
import { StickyCta } from "@/components/ui/StickyCta";
import { getCurrentUser } from "@/lib/auth";
import { SITE_URL } from "@/lib/site-url";
import { recordCourseView } from "@/lib/mentorship/growth";
import { getCourseBySlug, similarCourses } from "@/lib/mentorship/service";
import { categoryLabel, formatSom, levelLabel, formatDuration, languageLabel } from "@/lib/mentorship/format";
import { cn, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const user = await getCurrentUser();
  const c = await getCourseBySlug(slug, user?.id ?? null, user?.role === "admin");
  if (!c) return { title: "Kurs topilmadi" };
  return { title: `${c.title} — Mentorlik`, description: c.summary || `${c.mentor.name} kursi`, alternates: { canonical: `/mentorlik/${slug}` }, other: { "m-title": c.title } };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
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
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
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
    c.totalMin > 0 ? inc(<PlayCircle size={15} />, `${formatDuration(c.totalMin)} video dars`, "video") : inc(<PlayCircle size={15} />, `${c.lessonsCount} ta dars`, "dars"),
    c.materialsCount > 0 ? inc(<Download size={15} />, `${c.materialsCount} ta yuklab olinadigan material`, "mat") : null,
    c.quizCount > 0 ? inc(<ListChecks size={15} />, `${c.quizCount} ta bilim testi`, "quiz") : null,
    c.assignmentCount > 0 ? inc(<ClipboardCheck size={15} />, `${c.assignmentCount} ta amaliy vazifa (ustoz tekshiradi)`, "hw") : null,
    inc(<Smartphone size={15} />, "Telefon va kompyuterda", "dev"),
    inc(<Infinity size={15} />, "Cheksiz kirish, o'z sur'atingizda", "inf"),
    inc(<Award size={15} />, "Tugatganingizda sertifikat", "cert"),
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
                      {l.durationMin > 0 && <span>{formatDuration(l.durationMin)}</span>}
                      {l.isPreview && !l.completed && <span className="font-semibold text-accent-text">Bepul namuna</span>}
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
                    <a href="#kursga-yozilish" className="block transition hover:bg-fg/4" aria-label={`${l.title} — kursga yozilgach ochiladi`}>
                      {inner}
                    </a>
                  )}
                </li>
              );
              };

  return (
    <div className="container-x py-6 sm:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <RefCapture />
      <Link href="/mentorlik" className="mb-4 inline-flex items-center gap-1 text-[13px] font-semibold text-fg-3 transition hover:text-fg max-sm:hidden">
        <ChevronLeft size={15} /> Mentorlik
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Asosiy */}
        <div className="min-w-0">
          {/* Muqova + «Kursni ko'rib chiqish» (bepul namuna video shu yerda o'ynaydi) */}
          <CoursePreview coverUrl={c.coverUrl} title={c.title} preview={c.previewVideo} />

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px]">
            <span className="rounded-full bg-accent-soft px-2.5 py-1 font-bold text-accent-text">{categoryLabel(c.category)}</span>
            <span className="rounded-full bg-fg/6 px-2.5 py-1 font-semibold text-fg-2">{levelLabel(c.level)}</span>
            <span className="text-fg-4">{c.lessonsCount} dars</span>
            <span className="inline-flex items-center gap-1 text-fg-4"><Users size={13} /> {c.studentsCount} talaba</span>
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
          {c.summary && <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-fg-2">{c.summary}</p>}

          {/* Udemy uslubidagi meta qator: davomiylik · til · yangilangan · sertifikat */}
          <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-fg-3">
            {c.totalMin > 0 && <li className="inline-flex items-center gap-1"><Clock size={13} /> {formatDuration(c.totalMin)} video</li>}
            <li className="inline-flex items-center gap-1"><Languages size={13} /> {languageLabel(c.language)} tilida</li>
            <li className="inline-flex items-center gap-1"><RefreshCw size={13} /> Yangilangan {timeAgo(c.updatedAt)}</li>
            <li className="inline-flex items-center gap-1"><Award size={13} /> Sertifikat beriladi</li>
          </ul>

          {/* Telefonda «Bu kursga kiradi» asosiy ustunda (aside tepada, ro'yxat u yerda yashirin) */}
          <section className="card mt-5 p-4 m-flat sm:hidden" aria-labelledby="kurs-kiradi-m">
            <h2 id="kurs-kiradi-m" className="mb-2.5 text-[15px] font-bold text-fg">Bu kursga kiradi</h2>
            <ul className="space-y-2 text-[13.5px] text-fg-2">{includes}</ul>
          </section>

          {/* Nimalarni o'rganasiz — ✓ ro'yxat (Udemy) */}
          {c.outcomes.length > 0 && (
            <section className="card mt-5 p-4 m-flat sm:p-5" aria-labelledby="kurs-natija">
              <h2 id="kurs-natija" className="mb-3 text-[15px] font-bold text-fg">Nimalarni o&apos;rganasiz</h2>
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
                  <h2 id="kurs-talab" className="mb-2 text-[15px] font-bold text-fg">Talablar</h2>
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
                  <h2 id="kurs-kim" className="mb-2 flex items-center gap-1.5 text-[15px] font-bold text-fg"><Target size={15} className="text-fg-3" /> Kimlar uchun</h2>
                  <p className="text-[14px] leading-relaxed text-fg-2">{c.audience}</p>
                </section>
              )}
            </div>
          )}

          {/* Mentor */}
          <Link href={c.mentor.slug ? `/mentorlik/ustoz/${c.mentor.slug}` : "/mentorlik"} className="card card-hover mt-5 flex items-start gap-3 p-4">
            <Avatar name={c.mentor.name} src={c.mentor.avatarUrl} size={48} decorative />
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-fg-4">Ustoz</p>
              <p className="truncate text-[15px] font-semibold text-fg">{c.mentor.name}</p>
              <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-fg-3">{c.mentorBio || c.mentor.headline}</p>
            </div>
          </Link>

          {/* Darslar */}
          <h2 className="mb-2 mt-6 text-[15px] font-bold text-fg">
            Dastur · {c.lessonsCount} dars{sections.length > 1 ? ` · ${sections.length} bo'lim` : ""}
          </h2>
          {sections.length > 1 ? (
            /* Udemy kabi bo'limlar: har biri yig'iladigan, sarlavhada dars soni va davomiylik; birinchisi ochiq */
            <div className="card divide-y divide-line overflow-hidden m-flat">
              {sections.map((sec, si) => (
                <details key={`${sec.name}-${si}`} open={si === 0 || sec.items.some((l) => !l.completed && !l.locked && c.enrolled)} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition hover:bg-fg/4 [&::-webkit-details-marker]:hidden">
                    <ChevronRight size={16} className="shrink-0 text-fg-4 transition group-open:rotate-90" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold text-fg">{sec.name || `${si + 1}-bo'lim`}</span>
                      <span className="text-[12px] text-fg-4">
                        {sec.items.length} dars{sec.min > 0 ? ` · ${formatDuration(sec.min)}` : ""}
                        {sec.done > 0 ? ` · ${sec.done}/${sec.items.length} bajarildi` : ""}
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
          {c.lessons.length === 0 && <p className="card px-4 py-6 text-center text-[13px] text-fg-3 m-flat">Darslar tez orada qo&apos;shiladi.</p>}

          {/* Sharhlar */}
          <h2 id="sharh" className="mb-2 mt-6 scroll-mt-24 text-[15px] font-bold text-fg">Sharhlar · {c.reviewsCount}</h2>
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
                <p className="mt-1 text-[11.5px] text-fg-4">{c.reviewsCount} sharh</p>
              </div>
              <ol className="min-w-0 flex-1 space-y-1.5" aria-label="Reyting taqsimoti">
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
                      <span className="ml-1">{timeAgo(r.createdAt)}</span>
                    </p>
                  </div>
                </div>
                {r.body && <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-fg-2">{r.body}</p>}
              </li>
            ))}
            {c.reviews.length === 0 && <li className="text-[13px] text-fg-3">Hali sharh yo&apos;q.</li>}
          </ul>
        </div>

        {/* Yon panel: narx + yozilish */}
        <aside id="kursga-yozilish" className="min-w-0 max-sm:order-first lg:sticky lg:top-24 lg:self-start">
          <div className="card-elevated p-5 m-flat max-sm:px-0 max-sm:pb-4 max-sm:pt-0">
            <p className="text-[26px] font-bold leading-none text-fg">{formatSom(c.priceFrom)}</p>
            {c.enrolled && c.progressPct > 0 && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[12px] font-semibold text-fg-3">
                  <span>Progress</span>
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
                  Kursni tahrirlash
                </Link>
              ) : (
                <EnrollButton courseId={c.id} enrolled={c.enrolled} loggedIn={Boolean(user)} firstLessonId={c.enrolled ? resumeLesson : firstLesson} price={c.priceFrom} />
              )}
            </div>
            {/* «Bu kursga kiradi» (Udemy): haqiqiy sonlar — video daqiqa, dars, material, test, vazifa */}
            <p className="mt-5 text-[13px] font-bold text-fg max-sm:hidden">Bu kursga kiradi</p>
            <ul className="mt-2 space-y-2 text-[13px] text-fg-2 max-sm:hidden">{includes}</ul>
          </div>
          {user && !c.isOwner && c.priceFrom > 0 && <div className="mt-3"><ReferralCard path={`/mentorlik/${c.slug}`} percent={c.refPercent} /></div>}
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-10" aria-label="O'xshash kurslar">
          <h2 className="display-xl mb-3 text-[20px] text-fg max-sm:px-4">O&apos;xshash kurslar</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-sm:gap-0 max-sm:divide-y max-sm:divide-line max-sm:border-y max-sm:border-line">
            {similar.map((s) => (
              <CourseCard key={s.id} c={s} />
            ))}
          </div>
        </section>
      )}
      {/* Telefon: narx paneli tepada — darslarga aylantirilganda «Yozilish» ko'rinmay qoladi, yopishqoq CTA (panel ko'ringanda yashirinadi) */}
      {!c.isOwner && !c.enrolled && (
        <StickyCta targetId="kursga-yozilish">
          <a href="#kursga-yozilish" className="btn-accent press flex h-12 items-center justify-between rounded-full px-5 text-[15px] font-semibold shadow-[var(--shadow-3)]">
            <span className="truncate">{formatSom(c.priceFrom)}</span>
            <span className="inline-flex items-center gap-1.5">{c.priceFrom ? "Kursga yozilish" : "Bepul boshlash"} <ChevronLeft size={16} className="rotate-180" /></span>
          </a>
        </StickyCta>
      )}
    </div>
  );
}

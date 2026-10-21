import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, GraduationCap, Lock, PlayCircle, Star, Users } from "lucide-react";
import { SafeImage } from "@/components/specialists/SafeImage";
import { Avatar } from "@/components/ui";
import { EnrollButton } from "@/components/mentorship/EnrollButton";
import { CourseReviewForm } from "@/components/mentorship/CourseReviewForm";
import { getCurrentUser } from "@/lib/auth";
import { getCourseBySlug } from "@/lib/mentorship/service";
import { categoryLabel, formatSom, levelLabel, formatDuration } from "@/lib/mentorship/format";
import { cn, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const user = await getCurrentUser();
  const c = await getCourseBySlug(slug, user?.id ?? null, user?.role === "admin");
  if (!c) return { title: "Kurs topilmadi" };
  return { title: `${c.title} — Mentorlik`, description: c.summary || `${c.mentor.name} kursi`, alternates: { canonical: `/mentorlik/${slug}` } };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const c = await getCourseBySlug(slug, user?.id ?? null, user?.role === "admin");
  if (!c) notFound();

  const firstLesson = c.lessons[0]?.id ?? null;
  const resumeLesson = c.lessons.find((l) => !l.completed)?.id ?? firstLesson;

  return (
    <div className="container-x py-6 sm:py-8">
      <Link href="/mentorlik" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-3 transition hover:text-fg">
        ← Mentorlik
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Asosiy */}
        <div className="min-w-0">
          <div className="card overflow-hidden">
            <div className="relative aspect-video bg-surface-2">
              {c.coverUrl ? (
                <SafeImage src={c.coverUrl} alt={c.title} width={900} height={506} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-fg/5">
                  <GraduationCap size={40} className="text-fg-4" />
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px]">
            <span className="rounded-full bg-accent-soft px-2.5 py-1 font-bold text-accent-text">{categoryLabel(c.category)}</span>
            <span className="rounded-full bg-fg/6 px-2.5 py-1 font-semibold text-fg-2">{levelLabel(c.level)}</span>
            <span className="text-fg-4">{c.lessonsCount} dars</span>
            <span className="inline-flex items-center gap-1 text-fg-4"><Users size={13} /> {c.studentsCount} talaba</span>
            {c.rating > 0 && <span className="inline-flex items-center gap-1 text-fg-4"><Star size={13} className="fill-accent text-accent" /> {c.rating} ({c.reviewsCount})</span>}
          </div>

          <h1 className="display-xl mt-3 text-fg">{c.title}</h1>
          {c.summary && <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-fg-2">{c.summary}</p>}

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
          <h2 className="mb-2 mt-6 text-[15px] font-bold text-fg">Dastur · {c.lessonsCount} dars</h2>
          <ul className="card divide-y divide-line overflow-hidden">
            {c.lessons.map((l) => {
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
              return <li key={l.id}>{open ? <Link href={`/mentorlik/dars/${l.id}`} className="block transition hover:bg-fg/4">{inner}</Link> : <div>{inner}</div>}</li>;
            })}
            {c.lessons.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-fg-3">Darslar tez orada qo&apos;shiladi.</li>}
          </ul>

          {/* Sharhlar */}
          <h2 className="mb-2 mt-6 text-[15px] font-bold text-fg">Sharhlar · {c.reviewsCount}</h2>
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
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card-elevated p-5">
            <p className="text-[26px] font-bold leading-none text-fg">{formatSom(c.priceFrom)}</p>
            {c.enrolled && c.progressPct > 0 && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[12px] font-semibold text-fg-3">
                  <span>Progress</span>
                  <span className="tabular-nums text-fg">{c.progressPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-fg/10">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${c.progressPct}%` }} />
                </div>
              </div>
            )}
            <div className="mt-4">
              {c.isOwner ? (
                <Link href="/kabinet/mentorlik" className="btn-accent inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] text-[15px] font-semibold">
                  Kursni tahrirlash
                </Link>
              ) : (
                <EnrollButton courseId={c.id} enrolled={c.enrolled} loggedIn={Boolean(user)} firstLessonId={c.enrolled ? resumeLesson : firstLesson} price={c.priceFrom} />
              )}
            </div>
            <ul className="mt-4 space-y-2 text-[13px] text-fg-2">
              <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-success-text" /> {c.lessonsCount} ta video/matn dars</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-success-text" /> O&apos;z sur&apos;atingizda, cheksiz kirish</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-success-text" /> Progress kuzatuvi va sertifikat (tez orada)</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Award, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { LessonComplete } from "@/components/mentorship/LessonComplete";
import { LessonControls, LessonPlayer } from "@/components/mentorship/LessonPlayer";
import { LessonSidebar } from "@/components/mentorship/LessonSidebar";
import { LessonTabs, type LessonTab } from "@/components/mentorship/LessonTabs";
import { AssignmentBlock, Materials, QuizBlock } from "@/components/mentorship/LessonExtras";
import { LessonQA } from "@/components/mentorship/LessonQA";
import { LessonNotes } from "@/components/mentorship/LessonNotes";
import { getCurrentUser } from "@/lib/auth";
import { getLessonForViewer, type LessonView } from "@/lib/mentorship/service";
import { formatDuration } from "@/lib/mentorship/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dars", robots: { index: false, follow: false } };

/**
 * Dars sahifasi (2026-10-24 qayta tuzildi).
 * Oldin hamma narsa bitta uzun ustunda edi (video → matn → material → test → vazifa → savol-javob,
 * 1700px+ scroll) va kurs darslari ro'yxati umuman yo'q edi.
 * Endi: lg+ da ikki ustun — chapda pleyer + tablar, o'ngda yopishqoq darslar ro'yxati (progress bilan).
 */
export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  let lesson: LessonView | null = null;
  try {
    lesson = await getLessonForViewer(id, user?.id ?? null, user?.role === "admin");
  } catch {
    redirect("/mentorlik");
  }
  if (!lesson) notFound();

  const canSeeQA = Boolean(user) && (lesson.enrolled || lesson.isOwner || user?.role === "admin");
  const tabs: LessonTab[] = [];
  if (lesson.body) tabs.push({ key: "dars", label: "Dars", content: <div className="whitespace-pre-line text-[15px] leading-relaxed text-fg-2">{lesson.body}</div> });
  if (lesson.materials.length) tabs.push({ key: "material", label: "Materiallar", count: lesson.materials.length, content: <Materials items={lesson.materials} /> });
  if (lesson.quiz) tabs.push({ key: "test", label: "Test", dot: !lesson.quizPassed, content: <QuizBlock lessonId={lesson.id} quiz={lesson.quiz} passed={lesson.quizPassed} /> });
  if (lesson.assignment)
    tabs.push({
      key: "vazifa",
      label: "Vazifa",
      dot: lesson.enrolled && !lesson.isOwner && !lesson.submission,
      content: <AssignmentBlock lessonId={lesson.id} prompt={lesson.assignment} submission={lesson.submission} canSubmit={lesson.enrolled && !lesson.isOwner} />,
    });
  if (canSeeQA && user) tabs.push({ key: "savol", label: "Savol-javob", content: <LessonQA lessonId={lesson.id} isMentor={lesson.isOwner || user.role === "admin"} /> });
  // Udemy «Notes»: shaxsiy eslatmalar, video vaqt belgisi bilan — faqat kursga kirganlarga
  if (canSeeQA && user) tabs.push({ key: "eslatma", label: "Eslatmalar", content: <LessonNotes lessonId={lesson.id} hasVideo={Boolean(lesson.videoUrl)} /> });

  return (
    <div className="container-x py-4 sm:py-6">
      <Link href={`/mentorlik/${lesson.course.slug}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-fg-3 transition hover:text-fg">
        <ChevronLeft size={15} /> {lesson.course.title}
      </Link>

      <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        {/* Chap ustun: pleyer + sarlavha + tablar */}
        <div className="min-w-0">
          <LessonPlayer lessonId={lesson.id} videoUrl={lesson.videoUrl} next={lesson.next} />
          <LessonControls chapters={lesson.chapters} hasVideo={Boolean(lesson.videoUrl)} />

          <div className="mt-3.5 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-fg-4">
                {lesson.position}-dars · {lesson.course.lessonsCount} tadan{lesson.durationMin > 0 ? ` · ${formatDuration(lesson.durationMin)}` : ""}
              </p>
              <h1 className="mt-0.5 text-[21px] font-bold leading-tight text-fg sm:text-[23px]">{lesson.title}</h1>
            </div>
            {lesson.enrolled && (
              <div className="flex shrink-0 items-center gap-2">
                <LessonComplete lessonId={lesson.id} completed={lesson.completed} nextId={lesson.next?.id ?? null} blockedReason={lesson.quiz && !lesson.quizPassed ? "Avval dars testidan o'ting" : null} />
                {lesson.next && (
                  <Link href={`/mentorlik/dars/${lesson.next.id}`} aria-label="Keyingi dars" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line text-fg-2 transition hover:border-fg hover:text-fg">
                    <ChevronRight size={18} />
                  </Link>
                )}
              </div>
            )}
          </div>

          {!lesson.enrolled && !lesson.isOwner && user?.role !== "admin" && (
            <p className="mt-3 rounded-[14px] border border-line bg-fg/[0.03] p-3.5 text-[13.5px] text-fg-2">
              Bu — bepul namuna. To&apos;liq kursga{" "}
              <Link href={`/mentorlik/${lesson.course.slug}`} className="font-bold underline underline-offset-2">
                yoziling
              </Link>
              .
            </p>
          )}

          {lesson.certificateCode && (
            /* Kurs tugadi: sertifikat + sharh so'rovi (Udemy «Leave a rating» odati) */
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <Link href={`/sertifikat/${lesson.certificateCode}`} className="flex items-center gap-2.5 rounded-[14px] border border-line p-3.5 text-[14px] font-bold text-fg transition hover:border-fg">
                <Award size={17} className="shrink-0 text-fg-3" /> Kurs tugatildi — sertifikatni oching
              </Link>
              <Link href={`/mentorlik/${lesson.course.slug}#sharh`} className="flex items-center justify-center gap-2 rounded-[14px] border border-line px-4 py-3.5 text-[14px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
                <Star size={16} className="shrink-0" /> Kursga baho bering
              </Link>
            </div>
          )}

          <LessonTabs tabs={tabs} />
        </div>

        {/* O'ng ustun: kurs darslari (lg+ da yopishqoq) */}
        <div className="lg:sticky lg:top-20">
          <LessonSidebar courseTitle={lesson.course.title} courseSlug={lesson.course.slug} lessons={lesson.siblings} currentId={lesson.id} progressPct={lesson.progressPct} />
        </div>
      </div>
    </div>
  );
}

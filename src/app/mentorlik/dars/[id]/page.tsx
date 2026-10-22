import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, PlayCircle } from "lucide-react";
import { LessonComplete } from "@/components/mentorship/LessonComplete";
import { LessonPlayer } from "@/components/mentorship/LessonPlayer";
import { AssignmentBlock, Materials, QuizBlock } from "@/components/mentorship/LessonExtras";
import { LessonQA } from "@/components/mentorship/LessonQA";
import { getCurrentUser } from "@/lib/auth";
import { getLessonForViewer, type LessonView } from "@/lib/mentorship/service";
import { formatDuration } from "@/lib/mentorship/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

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

  return (
    <div className="container-x max-w-3xl py-5 sm:py-7">
      <Link href={`/mentorlik/${lesson.course.slug}`} className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-fg-3 transition hover:text-fg">
        <ChevronLeft size={15} /> {lesson.course.title}
      </Link>

      <LessonPlayer lessonId={lesson.id} videoUrl={lesson.videoUrl} chapters={lesson.chapters} />

      <p className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-fg-4">
        {lesson.position}-dars · {lesson.course.lessonsCount} tadan {lesson.durationMin > 0 ? `· ${formatDuration(lesson.durationMin)}` : ""}
      </p>
      <h1 className="mt-1 text-[22px] font-bold leading-tight text-fg">{lesson.title}</h1>

      {lesson.body && <div className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-fg-2">{lesson.body}</div>}

      <Materials items={lesson.materials} />
      {lesson.quiz && <QuizBlock lessonId={lesson.id} quiz={lesson.quiz} passed={lesson.quizPassed} />}
      {lesson.assignment && <AssignmentBlock lessonId={lesson.id} prompt={lesson.assignment} submission={lesson.submission} canSubmit={lesson.enrolled && !lesson.isOwner} />}
      {lesson.certificateCode && (
        <Link href={`/sertifikat/${lesson.certificateCode}`} className="mt-6 flex items-center gap-3 rounded-[16px] bg-accent-soft p-4 text-[14px] font-bold text-accent-text">
          🎓 Kurs tugatildi — sertifikatingizni oching
        </Link>
      )}

      {/* Amallar */}
      {lesson.enrolled && (
        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <LessonComplete lessonId={lesson.id} completed={lesson.completed} nextId={lesson.next?.id ?? null} blockedReason={lesson.quiz && !lesson.quizPassed ? "Avval dars testidan o'ting" : null} />
          {lesson.next && (
            <Link href={`/mentorlik/dars/${lesson.next.id}`} className="inline-flex h-11 items-center gap-1.5 rounded-[14px] border border-line px-4 text-[14px] font-semibold text-fg transition hover:border-fg">
              Keyingi dars <ChevronRight size={16} />
            </Link>
          )}
        </div>
      )}
      {!lesson.enrolled && (
        <div className="mt-6 rounded-[14px] bg-accent-soft p-4 text-[13.5px] text-accent-text">
          Bu — bepul namuna. To&apos;liq kursga{" "}
          <Link href={`/mentorlik/${lesson.course.slug}`} className="font-bold underline underline-offset-2">
            yoziling
          </Link>
          .
        </div>
      )}

      {(lesson.enrolled || lesson.isOwner || user?.role === "admin") && user && <LessonQA lessonId={lesson.id} isMentor={lesson.isOwner || user.role === "admin"} />}

      {/* Navigatsiya */}
      <div className="mt-8 flex items-center justify-between border-t border-line pt-4 text-[13px] font-semibold">
        {lesson.prev ? (
          <Link href={`/mentorlik/dars/${lesson.prev.id}`} className="inline-flex max-w-[45%] items-center gap-1 text-fg-2 transition hover:text-fg">
            <ChevronLeft size={16} /> <span className="truncate">{lesson.prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {lesson.next ? (
          <Link href={`/mentorlik/dars/${lesson.next.id}`} className="inline-flex max-w-[45%] items-center gap-1 text-right text-fg-2 transition hover:text-fg">
            <span className="truncate">{lesson.next.title}</span> <ChevronRight size={16} />
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

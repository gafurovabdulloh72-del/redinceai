"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Check, Eye, Pencil, ImagePlus, Loader2, Plus, Trash2, Upload, Video } from "lucide-react";
import { SafeImage } from "@/components/specialists/SafeImage";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { uploadAttachment } from "@/components/chat/attachments";
import { ImageCropper } from "@/components/kabinet/ImageCropper";
import { LessonForm, type LessonFull } from "./LessonForm";
import { MENTOR_CATEGORIES, COURSE_LEVELS, MENTOR_LIMITS, COURSE_LANGUAGES } from "@/lib/mentorship/format";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { MK, categoryLabelTr, formatDurationTr, languageLabelTr, levelLabelTr } from "@/lib/i18n/dict/mentorship";
import { cn } from "@/lib/utils";

interface CourseData {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverUrl: string | null;
  category: string;
  level: string;
  priceFrom: number;
  isPublished: boolean;
  lessonsCount: number;
  studentsCount: number;
  outcomes?: string[];
  requirements?: string[];
  audience?: string;
  language?: string;
}
type LessonData = LessonFull;

export function CourseEditor({ course, lessons: initialLessons }: { course: CourseData; lessons: LessonData[] }) {
  const til = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();
  const err = tr(til, MK.error);

  const [title, setTitle] = useState(course.title);
  const [summary, setSummary] = useState(course.summary);
  const [coverUrl, setCoverUrl] = useState<string | null>(course.coverUrl);
  const [category, setCategory] = useState(course.category);
  const [level, setLevel] = useState(course.level);
  const [price, setPrice] = useState(String(course.priceFrom));
  // Udemy uslubidagi bo'limlar: har qator — bitta band
  const [outcomes, setOutcomes] = useState((course.outcomes ?? []).join("\n"));
  const [requirements, setRequirements] = useState((course.requirements ?? []).join("\n"));
  const [audience, setAudience] = useState(course.audience ?? "");
  const [language, setLanguage] = useState(course.language ?? "uz");
  const lines = (s: string, max: number) => s.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, max);
  const [published, setPublished] = useState(course.isPublished);
  const [savingCourse, setSavingCourse] = useState(false);
  const [coverUp, setCoverUp] = useState(false);
  const [lessons, setLessons] = useState<LessonData[]>(initialLessons);
  const [editingId, setEditingId] = useState<string | null>(null);

  const saveCourse = async () => {
    if (savingCourse || title.trim().length < 5) {
      if (title.trim().length < 5) toast(tr(til, MK.titleMin5), "info");
      return;
    }
    setSavingCourse(true);
    try {
      const res = await fetch(`/api/mentorlik/kurslar/${course.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), summary: summary.trim(), coverUrl, category, level, priceFrom: Number(price) || 0, outcomes: lines(outcomes, MENTOR_LIMITS.outcomesMax), requirements: lines(requirements, MENTOR_LIMITS.requirementsMax), audience: audience.trim(), language }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || tr(til, MK.notSaved));
      toast(tr(til, MK.saved), "success");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : err, "error");
    } finally {
      setSavingCourse(false);
    }
  };

  const [cropFile, setCropFile] = useState<File | null>(null);
  const uploadCover = async (file: File | null) => {
    if (!file) return;
    setCoverUp(true);
    try {
      const a = await uploadAttachment(file);
      setCoverUrl(a.url);
      toast(tr(til, MK.coverUploaded), "info");
    } catch (e) {
      toast(e instanceof Error ? e.message : tr(til, MK.notUploaded), "error");
    } finally {
      setCoverUp(false);
    }
  };

  const togglePublish = async () => {
    const next = !published;
    try {
      const res = await fetch(`/api/mentorlik/kurslar/${course.id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publish: next }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || err);
      setPublished(next);
      toast(next ? tr(til, MK.coursePublished) : tr(til, MK.courseHidden), "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : err, "error");
    }
  };

  /** Darsni bir pog'ona yuqoriga/pastga surish — optimistik; server rad etsa eski tartib qaytadi */
  const moveLesson = async (id: string, dir: -1 | 1) => {
    const i = lessons.findIndex((l) => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= lessons.length) return;
    const prev = lessons;
    const next = [...lessons];
    [next[i], next[j]] = [next[j], next[i]];
    const renumbered = next.map((l, k) => ({ ...l, position: k + 1 }));
    setLessons(renumbered);
    try {
      const res = await fetch("/api/mentorlik/darslar/tartib", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id, ids: renumbered.map((l) => l.id) }),
      });
      const j2 = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j2.ok) throw new Error(j2.error || err);
    } catch (e) {
      setLessons(prev);
      toast(e instanceof Error ? e.message : tr(til, MK.orderNotSaved), "error");
    }
  };

  const removeLesson = async (id: string) => {
    if (!(await confirm({ title: tr(til, MK.deleteLessonQ), text: tr(til, MK.irreversible), confirmLabel: tr(til, MK.del), danger: true }))) return;
    try {
      const res = await fetch(`/api/mentorlik/darslar/${id}`, { method: "DELETE" });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || err);
      setLessons((ls) => ls.filter((l) => l.id !== id));
      toast(tr(til, MK.lessonDeleted));
    } catch (e) {
      toast(e instanceof Error ? e.message : err, "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/kabinet/mentorlik" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-3 transition hover:text-fg">
          <ArrowLeft size={15} /> {tr(til, MK.myCourses)}
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/mentorlik/${course.slug}`} target="_blank" className="inline-flex h-10 items-center gap-1.5 rounded-[12px] border border-line px-3.5 text-[13.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
            <Eye size={15} /> {tr(til, MK.view)}
          </Link>
          <button onClick={togglePublish} className={cn("inline-flex h-10 items-center gap-1.5 rounded-[12px] px-4 text-[13.5px] font-semibold transition", published ? "bg-success-soft text-success-text" : "btn-accent")}>
            {published ? <><Check size={15} /> {tr(til, MK.isPublished)}</> : tr(til, MK.publish)}
          </button>
        </div>
      </div>

      {/* Kurs sozlamalari */}
      <section className="card m-flat p-4 sm:p-5">
        <h2 className="mb-3 text-[15px] font-bold text-fg">{tr(til, MK.courseInfo)}</h2>
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          {/* Muqova */}
          <div>
            <div className="relative aspect-video overflow-hidden rounded-[12px] border border-line bg-surface-2">
              {coverUrl ? <SafeImage src={coverUrl} alt={tr(til, MK.coverAlt)} width={320} height={180} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-fg-4"><ImagePlus size={22} /></div>}
            </div>
            <label className="press mt-2 flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-line text-[12.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
              {coverUp ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {tr(til, MK.coverAlt)}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setCropFile(f); e.target.value = ""; }} />
            </label>
            {cropFile && <ImageCropper file={cropFile} aspect={16 / 9} outWidth={1280} title={tr(til, MK.cropCover)} onCancel={() => setCropFile(null)} onDone={(f) => { setCropFile(null); void uploadCover(f); }} />}
          </div>
          {/* Maydonlar */}
          <div className="space-y-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={MENTOR_LIMITS.courseTitleMax} placeholder={tr(til, MK.courseTitlePh)} className="field h-11 w-full text-[14px]" />
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={MENTOR_LIMITS.courseSummaryMax} rows={3} placeholder={tr(til, MK.courseSummaryPh)} className="field w-full resize-y py-2.5 text-[14px] leading-relaxed" />
            <div className="grid gap-3 sm:grid-cols-3">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="field h-10 w-full text-[13.5px]">{MENTOR_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{categoryLabelTr(til, c.key)}</option>)}</select>
              <select value={level} onChange={(e) => setLevel(e.target.value)} className="field h-10 w-full text-[13.5px]">{COURSE_LEVELS.map((l) => <option key={l.key} value={l.key}>{levelLabelTr(til, l.key)}</option>)}</select>
              <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder={tr(til, MK.pricePh)} className="field h-10 w-full text-[13.5px]" />
            </div>
          </div>
        </div>
        {/* Udemy uslubidagi «sotuvchi» bo'limlar — kurs sahifasida ✓ ro'yxat bo'lib chiqadi */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[12.5px] font-semibold text-fg-2">{tr(til, MK.outcomes)} <span className="font-normal text-fg-4">{MK.outcomesHint[til](MENTOR_LIMITS.outcomesMax)}</span></span>
            <textarea value={outcomes} onChange={(e) => setOutcomes(e.target.value)} rows={5} placeholder={tr(til, MK.outcomesPh)} className="field w-full resize-y py-2.5 text-[13.5px] leading-relaxed" />
          </label>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-semibold text-fg-2">{tr(til, MK.requirements)} <span className="font-normal text-fg-4">{tr(til, MK.onePerLine)}</span></span>
              <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} rows={2} placeholder={tr(til, MK.requirementsPh)} className="field w-full resize-y py-2.5 text-[13.5px] leading-relaxed" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-semibold text-fg-2">{tr(til, MK.audience)}</span>
              <input value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={MENTOR_LIMITS.audienceMax} placeholder={tr(til, MK.audiencePh)} className="field h-10 w-full text-[13.5px]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-semibold text-fg-2">{tr(til, MK.lessonLang)}</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="field h-10 w-full text-[13.5px]">{COURSE_LANGUAGES.map((l) => <option key={l.key} value={l.key}>{languageLabelTr(til, l.key)}</option>)}</select>
            </label>
          </div>
        </div>
        <button onClick={saveCourse} disabled={savingCourse} className="btn-accent mt-4 inline-flex h-10 items-center gap-2 rounded-[12px] px-5 text-[14px] font-semibold disabled:opacity-60">
          {savingCourse ? <Loader2 size={15} className="animate-spin" /> : null} {tr(til, MK.save)}
        </button>
      </section>

      {/* Darslar */}
      <section>
        <h2 className="mb-3 text-[16px] font-bold text-fg">{tr(til, MK.lessons)} <span className="text-fg-4">· {lessons.length}</span></h2>
        <ul className="space-y-2">
          {/* LessonForm «Bo'lim nomi» maydoni uchun mavjud bo'limlar taklifi */}
          <datalist id="lesson-sections">{[...new Set(lessons.map((l) => l.section).filter(Boolean))].map((x) => <option key={x} value={x} />)}</datalist>
          {lessons.map((l) => (
            editingId === l.id ? (
              <li key={l.id}>
                <LessonForm courseId={course.id} initial={l} nextPos={l.position} onCancel={() => setEditingId(null)} onSaved={(nl) => { setLessons((ls) => ls.map((x) => (x.id === nl.id ? nl : x))); setEditingId(null); }} />
              </li>
            ) : (
            <li key={l.id} className="card flex items-center gap-3 p-3 max-sm:gap-2">
              <span className="flex shrink-0 flex-col">
                <button onClick={() => void moveLesson(l.id, -1)} disabled={l.position <= 1} aria-label={tr(til, MK.moveUp)} className="press flex h-6 w-7 items-center justify-center rounded-[8px] text-fg-3 transition hover:bg-fg/6 hover:text-fg disabled:opacity-30">
                  <ArrowUp size={14} />
                </button>
                <button onClick={() => void moveLesson(l.id, 1)} disabled={l.position >= lessons.length} aria-label={tr(til, MK.moveDown)} className="press flex h-6 w-7 items-center justify-center rounded-[8px] text-fg-3 transition hover:bg-fg/6 hover:text-fg disabled:opacity-30">
                  <ArrowDown size={14} />
                </button>
              </span>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-fg/6 text-[12px] font-bold tabular-nums text-fg-2">{l.position}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-fg">{l.title}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-fg-4">
                  {l.videoUrl ? <span className="inline-flex items-center gap-0.5 text-success-text"><Video size={12} /> {tr(til, MK.tagVideo)}</span> : <span>{tr(til, MK.tagText)}</span>}
                  {l.durationMin > 0 && <span>{formatDurationTr(til, l.durationMin)}</span>}
                  {l.isPreview && <span className="font-semibold text-accent-text">{tr(til, MK.tagPreview)}</span>}
                  {l.quiz && <span>{tr(til, MK.tagQuiz)}</span>}
                  {l.assignment && <span>{tr(til, MK.tagAssignment)}</span>}
                  {l.materials.length > 0 && <span>{MK.filesN[til](l.materials.length)}</span>}
                </span>
              </span>
              <button onClick={() => setEditingId(l.id)} aria-label={tr(til, MK.edit)} className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6">
                <Pencil size={15} />
              </button>
              <button onClick={() => removeLesson(l.id)} aria-label={tr(til, MK.del)} className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-danger-text transition hover:bg-danger-soft">
                <Trash2 size={15} />
              </button>
            </li>
            )
          ))}
          {lessons.length === 0 && <li className="card p-5 text-center text-[13px] text-fg-3">{tr(til, MK.noLessons)}</li>}
        </ul>

        <AddLesson courseId={course.id} nextPos={lessons.length + 1} onAdded={(l) => setLessons((ls) => [...ls, l])} />
      </section>
    </div>
  );
}

/* --------------------------- Dars qo'shish --------------------------- */
function AddLesson({ courseId, nextPos, onAdded }: { courseId: string; nextPos: number; onAdded: (l: LessonData) => void }) {
  const til = useLocale();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-3 inline-flex h-11 items-center gap-1.5 rounded-[14px] border border-dashed border-line-2 px-4 text-[14px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
        <Plus size={16} /> {tr(til, MK.addLesson)}
      </button>
    );
  }
  return (
    <div className="mt-3">
      <LessonForm courseId={courseId} nextPos={nextPos} onCancel={() => setOpen(false)} onSaved={(l) => { onAdded(l); setOpen(false); }} />
    </div>
  );
}

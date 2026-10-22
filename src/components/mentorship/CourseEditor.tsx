"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Eye, Pencil, GripVertical, ImagePlus, Loader2, Plus, Trash2, Upload, Video } from "lucide-react";
import { SafeImage } from "@/components/specialists/SafeImage";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { uploadAttachment } from "@/components/chat/attachments";
import { ImageCropper } from "@/components/kabinet/ImageCropper";
import { LessonForm, type LessonFull } from "./LessonForm";
import { MENTOR_CATEGORIES, COURSE_LEVELS, MENTOR_LIMITS, formatDuration } from "@/lib/mentorship/format";
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
}
type LessonData = LessonFull;

export function CourseEditor({ course, lessons: initialLessons }: { course: CourseData; lessons: LessonData[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [title, setTitle] = useState(course.title);
  const [summary, setSummary] = useState(course.summary);
  const [coverUrl, setCoverUrl] = useState<string | null>(course.coverUrl);
  const [category, setCategory] = useState(course.category);
  const [level, setLevel] = useState(course.level);
  const [price, setPrice] = useState(String(course.priceFrom));
  const [published, setPublished] = useState(course.isPublished);
  const [savingCourse, setSavingCourse] = useState(false);
  const [coverUp, setCoverUp] = useState(false);
  const [lessons, setLessons] = useState<LessonData[]>(initialLessons);
  const [editingId, setEditingId] = useState<string | null>(null);

  const saveCourse = async () => {
    if (savingCourse || title.trim().length < 5) {
      if (title.trim().length < 5) toast("Sarlavha kamida 5 belgi", "info");
      return;
    }
    setSavingCourse(true);
    try {
      const res = await fetch(`/api/mentorlik/kurslar/${course.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), summary: summary.trim(), coverUrl, category, level, priceFrom: Number(price) || 0 }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Saqlanmadi");
      toast("Saqlandi", "success");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Xatolik", "error");
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
      toast("Muqova yuklandi — Saqlashni unutmang", "info");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Yuklanmadi", "error");
    } finally {
      setCoverUp(false);
    }
  };

  const togglePublish = async () => {
    const next = !published;
    try {
      const res = await fetch(`/api/mentorlik/kurslar/${course.id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publish: next }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Xatolik");
      setPublished(next);
      toast(next ? "Kurs chop etildi 🎉" : "Kurs yashirildi", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Xatolik", "error");
    }
  };

  const removeLesson = async (id: string) => {
    if (!(await confirm({ title: "Darsni o'chirish?", text: "Bu amalni qaytarib bo'lmaydi.", confirmLabel: "O'chirish", danger: true }))) return;
    try {
      const res = await fetch(`/api/mentorlik/darslar/${id}`, { method: "DELETE" });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Xatolik");
      setLessons((ls) => ls.filter((l) => l.id !== id));
      toast("Dars o'chirildi");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Xatolik", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/kabinet/mentorlik" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-3 transition hover:text-fg">
          <ArrowLeft size={15} /> Kurslarim
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/mentorlik/${course.slug}`} target="_blank" className="inline-flex h-10 items-center gap-1.5 rounded-[12px] border border-line px-3.5 text-[13.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
            <Eye size={15} /> Ko&apos;rish
          </Link>
          <button onClick={togglePublish} className={cn("inline-flex h-10 items-center gap-1.5 rounded-[12px] px-4 text-[13.5px] font-semibold transition", published ? "bg-success-soft text-success-text" : "btn-accent")}>
            {published ? <><Check size={15} /> Chop etilgan</> : "Chop etish"}
          </button>
        </div>
      </div>

      {/* Kurs sozlamalari */}
      <section className="card p-4 sm:p-5">
        <h2 className="mb-3 text-[15px] font-bold text-fg">Kurs ma&apos;lumotlari</h2>
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          {/* Muqova */}
          <div>
            <div className="relative aspect-video overflow-hidden rounded-[12px] border border-line bg-surface-2">
              {coverUrl ? <SafeImage src={coverUrl} alt="Muqova" width={320} height={180} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-fg-4"><ImagePlus size={22} /></div>}
            </div>
            <label className="press mt-2 flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-line text-[12.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
              {coverUp ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Muqova
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setCropFile(f); e.target.value = ""; }} />
            </label>
            {cropFile && <ImageCropper file={cropFile} aspect={16 / 9} outWidth={1280} title="Muqovani moslang (16:9)" onCancel={() => setCropFile(null)} onDone={(f) => { setCropFile(null); void uploadCover(f); }} />}
          </div>
          {/* Maydonlar */}
          <div className="space-y-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={MENTOR_LIMITS.courseTitleMax} placeholder="Kurs sarlavhasi" className="field h-11 w-full text-[14px]" />
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={MENTOR_LIMITS.courseSummaryMax} rows={3} placeholder="Kurs haqida qisqacha — kim uchun, nima o'rganadi…" className="field w-full resize-y py-2.5 text-[14px] leading-relaxed" />
            <div className="grid gap-3 sm:grid-cols-3">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="field h-10 w-full text-[13.5px]">{MENTOR_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
              <select value={level} onChange={(e) => setLevel(e.target.value)} className="field h-10 w-full text-[13.5px]">{COURSE_LEVELS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}</select>
              <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Narx so'm (0=bepul)" className="field h-10 w-full text-[13.5px]" />
            </div>
          </div>
        </div>
        <button onClick={saveCourse} disabled={savingCourse} className="btn-accent mt-4 inline-flex h-10 items-center gap-2 rounded-[12px] px-5 text-[14px] font-semibold disabled:opacity-60">
          {savingCourse ? <Loader2 size={15} className="animate-spin" /> : null} Saqlash
        </button>
      </section>

      {/* Darslar */}
      <section>
        <h2 className="mb-3 text-[16px] font-bold text-fg">Darslar <span className="text-fg-4">· {lessons.length}</span></h2>
        <ul className="space-y-2">
          {lessons.map((l) => (
            editingId === l.id ? (
              <li key={l.id}>
                <LessonForm courseId={course.id} initial={l} nextPos={l.position} onCancel={() => setEditingId(null)} onSaved={(nl) => { setLessons((ls) => ls.map((x) => (x.id === nl.id ? nl : x))); setEditingId(null); }} />
              </li>
            ) : (
            <li key={l.id} className="card flex items-center gap-3 p-3">
              <GripVertical size={16} className="shrink-0 text-fg-4" />
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-fg/6 text-[12px] font-bold tabular-nums text-fg-2">{l.position}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-fg">{l.title}</span>
                <span className="flex items-center gap-2 text-[12px] text-fg-4">
                  {l.videoUrl ? <span className="inline-flex items-center gap-0.5 text-success-text"><Video size={12} /> video</span> : <span>matn</span>}
                  {l.durationMin > 0 && <span>{formatDuration(l.durationMin)}</span>}
                  {l.isPreview && <span className="font-semibold text-accent-text">namuna</span>}
                  {l.quiz && <span>test</span>}
                  {l.assignment && <span>vazifa</span>}
                  {l.materials.length > 0 && <span>{l.materials.length} fayl</span>}
                </span>
              </span>
              <button onClick={() => setEditingId(l.id)} aria-label="Tahrirlash" className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6">
                <Pencil size={15} />
              </button>
              <button onClick={() => removeLesson(l.id)} aria-label="O'chirish" className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-danger-text transition hover:bg-danger-soft">
                <Trash2 size={15} />
              </button>
            </li>
            )
          ))}
          {lessons.length === 0 && <li className="card p-5 text-center text-[13px] text-fg-3">Hali dars yo&apos;q — pastdan qo&apos;shing.</li>}
        </ul>

        <AddLesson courseId={course.id} nextPos={lessons.length + 1} onAdded={(l) => setLessons((ls) => [...ls, l])} />
      </section>
    </div>
  );
}

/* --------------------------- Dars qo'shish --------------------------- */
function AddLesson({ courseId, nextPos, onAdded }: { courseId: string; nextPos: number; onAdded: (l: LessonData) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-3 inline-flex h-11 items-center gap-1.5 rounded-[14px] border border-dashed border-line-2 px-4 text-[14px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
        <Plus size={16} /> Dars qo&apos;shish
      </button>
    );
  }
  return (
    <div className="mt-3">
      <LessonForm courseId={courseId} nextPos={nextPos} onCancel={() => setOpen(false)} onSaved={(l) => { onAdded(l); setOpen(false); }} />
    </div>
  );
}

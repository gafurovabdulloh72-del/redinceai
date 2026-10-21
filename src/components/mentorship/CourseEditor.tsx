"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Eye, GripVertical, ImagePlus, Loader2, Plus, Trash2, Upload, Video, X } from "lucide-react";
import { SafeImage } from "@/components/specialists/SafeImage";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { uploadAttachment } from "@/components/chat/attachments";
import { ImageCropper } from "@/components/kabinet/ImageCropper";
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
interface LessonData {
  id: string;
  position: number;
  title: string;
  body: string;
  videoUrl: string | null;
  durationMin: number;
  isPreview: boolean;
}

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
            <li key={l.id} className="card flex items-center gap-3 p-3">
              <GripVertical size={16} className="shrink-0 text-fg-4" />
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-fg/6 text-[12px] font-bold tabular-nums text-fg-2">{l.position}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-fg">{l.title}</span>
                <span className="flex items-center gap-2 text-[12px] text-fg-4">
                  {l.videoUrl ? <span className="inline-flex items-center gap-0.5 text-success-text"><Video size={12} /> video</span> : <span>matn</span>}
                  {l.durationMin > 0 && <span>{formatDuration(l.durationMin)}</span>}
                  {l.isPreview && <span className="font-semibold text-accent-text">namuna</span>}
                </span>
              </span>
              <button onClick={() => removeLesson(l.id)} aria-label="O'chirish" className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-danger-text transition hover:bg-danger-soft">
                <Trash2 size={15} />
              </button>
            </li>
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
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [vidUp, setVidUp] = useState(0); // 0=yo'q, 0.01..1 yuklanmoqda
  const [busy, setBusy] = useState(false);

  const reset = () => { setTitle(""); setBody(""); setVideoUrl(null); setDuration(""); setIsPreview(false); setVidUp(0); };

  const uploadVideo = async (file: File | null) => {
    if (!file) return;
    setVidUp(0.01);
    try {
      const a = await uploadAttachment(file, { docs: true, onProgress: (p) => setVidUp(Math.max(0.01, p)) });
      setVideoUrl(a.url);
      toast("Video yuklandi", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Yuklanmadi", "error");
    } finally {
      setVidUp(0);
    }
  };

  const add = async () => {
    if (busy || title.trim().length < 3) {
      if (title.trim().length < 3) toast("Dars nomi kamida 3 belgi", "info");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/mentorlik/kurslar/${courseId}/darslar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), body: body.trim(), videoUrl, durationMin: Number(duration) || 0, isPreview }) });
      const j = (await res.json()) as { ok: boolean; error?: string; data?: { id: string } };
      if (!res.ok || !j.ok || !j.data) throw new Error(j.error || "Qo'shilmadi");
      onAdded({ id: j.data.id, position: nextPos, title: title.trim(), body: body.trim(), videoUrl, durationMin: Number(duration) || 0, isPreview });
      reset();
      setOpen(false);
      toast("Dars qo'shildi", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-3 inline-flex h-11 items-center gap-1.5 rounded-[14px] border border-dashed border-line-2 px-4 text-[14px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
        <Plus size={16} /> Dars qo&apos;shish
      </button>
    );
  }
  return (
    <div className="expand-in card mt-3 space-y-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-semibold text-fg">Yangi dars</p>
        <button onClick={() => { setOpen(false); reset(); }} aria-label="Yopish" className="press flex h-8 w-8 items-center justify-center rounded-full text-fg-3 hover:bg-fg/6"><X size={16} /></button>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={MENTOR_LIMITS.lessonTitleMax} placeholder="Dars nomi" className="field h-11 w-full text-[14px]" autoFocus />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={MENTOR_LIMITS.lessonBodyMax} rows={4} placeholder="Dars matni / izoh (ixtiyoriy)…" className="field w-full resize-y py-2.5 text-[14px] leading-relaxed" />
      <div className="flex flex-wrap items-center gap-2">
        <label className="press flex h-10 cursor-pointer items-center gap-1.5 rounded-[12px] border border-line px-3.5 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
          {vidUp > 0 ? <><Loader2 size={14} className="animate-spin" /> {Math.round(vidUp * 100)}%</> : videoUrl ? <><Check size={14} className="text-success-text" /> Video tayyor</> : <><Video size={14} /> Video yuklash</>}
          <input type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" className="sr-only" onChange={(e) => { void uploadVideo(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        </label>
        {videoUrl && <button onClick={() => setVideoUrl(null)} className="text-[12.5px] font-semibold text-fg-3 underline-offset-2 hover:underline">olib tashlash</button>}
        <input value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Davomiyligi (daq)" className="field h-10 w-32 text-[13px]" />
        <label className="flex items-center gap-1.5 text-[13px] font-medium text-fg-2">
          <input type="checkbox" checked={isPreview} onChange={(e) => setIsPreview(e.target.checked)} className="h-4 w-4 accent-[var(--accent-strong)]" /> Bepul namuna
        </label>
      </div>
      <button onClick={add} disabled={busy || vidUp > 0} className="btn-accent inline-flex h-10 items-center gap-2 rounded-[12px] px-5 text-[14px] font-semibold disabled:opacity-60">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Qo&apos;shish
      </button>
    </div>
  );
}

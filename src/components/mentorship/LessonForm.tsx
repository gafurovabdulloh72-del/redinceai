"use client";

import { useState } from "react";
import { Check, FileText, Loader2, Plus, Trash2, Video, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { uploadAttachment } from "@/components/chat/attachments";
import { MENTOR_LIMITS } from "@/lib/mentorship/format";

export interface LessonFull {
  id: string;
  position: number;
  title: string;
  body: string;
  videoUrl: string | null;
  durationMin: number;
  /** Kurs bo'limi (ixtiyoriy) */
  section?: string;
  isPreview: boolean;
  materials: Array<{ name: string; url: string; size?: number }>;
  chapters: Array<{ t: number; title: string }>;
  quiz: { passPct: number; questions: Array<{ q: string; options: string[]; correct: number }> } | null;
  assignment: string;
}

const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
/** "03:20 Kesish" qatorlari → [{t:200,title}] (mm:ss yoki h:mm:ss) */
function parseChapters(text: string): Array<{ t: number; title: string }> | null {
  const out: Array<{ t: number; title: string }> = [];
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(.+)$/.exec(line);
    if (!m) return null;
    const t = m[3] !== undefined ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : Number(m[1]) * 60 + Number(m[2]);
    out.push({ t, title: m[4].slice(0, 80) });
  }
  return out;
}

/** Dars yaratish/tahrirlash: matn, video, materiallar, vaqt belgilari, test, uy vazifasi */
export function LessonForm({ courseId, initial, nextPos, onSaved, onCancel }: { courseId: string; initial?: LessonFull; nextPos: number; onSaved: (l: LessonFull) => void; onCancel: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [videoUrl, setVideoUrl] = useState<string | null>(initial?.videoUrl ?? null);
  const [duration, setDuration] = useState(initial?.durationMin ? String(initial.durationMin) : "");
  const [isPreview, setIsPreview] = useState(initial?.isPreview ?? false);
  const [section, setSection] = useState(initial?.section ?? "");
  const [materials, setMaterials] = useState(initial?.materials ?? []);
  const [chaptersText, setChaptersText] = useState((initial?.chapters ?? []).map((c) => `${fmtT(c.t)} ${c.title}`).join("\n"));
  const [quiz, setQuiz] = useState<LessonFull["quiz"]>(initial?.quiz ?? null);
  const [assignment, setAssignment] = useState(initial?.assignment ?? "");
  const [vidUp, setVidUp] = useState(0);
  const [matUp, setMatUp] = useState(false);
  const [busy, setBusy] = useState(false);

  async function uploadVideo(file: File | null) {
    if (!file) return;
    setVidUp(0.01);
    try {
      const a = await uploadAttachment(file, { docs: true, onProgress: (p) => setVidUp(Math.max(0.01, p)) });
      setVideoUrl(a.url);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Yuklanmadi", "error");
    } finally {
      setVidUp(0);
    }
  }
  async function uploadMaterial(file: File | null) {
    if (!file) return;
    setMatUp(true);
    try {
      const a = await uploadAttachment(file, { docs: true });
      setMaterials((m) => [...m, { name: file.name.slice(0, 120), url: a.url, size: file.size }].slice(0, 8));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Yuklanmadi", "error");
    } finally {
      setMatUp(false);
    }
  }

  const setQ = (i: number, patch: Partial<NonNullable<LessonFull["quiz"]>["questions"][number]>) => setQuiz((q) => (q ? { ...q, questions: q.questions.map((x, k) => (k === i ? { ...x, ...patch } : x)) } : q));

  async function save() {
    if (title.trim().length < 3) return toast("Dars nomi kamida 3 belgi", "info");
    const chapters = parseChapters(chaptersText);
    if (!chapters) return toast("Vaqt belgilari: har qatorda «mm:ss Sarlavha» (masalan 03:20 Kesish)", "info");
    let q = quiz;
    if (q) {
      const clean = q.questions.map((x) => ({ ...x, q: x.q.trim(), options: x.options.map((o) => o.trim()).filter(Boolean) })).filter((x) => x.q);
      if (clean.some((x) => x.options.length < 2 || x.correct >= x.options.length)) return toast("Har savolda kamida 2 variant va bitta to'g'ri javob bo'lsin", "info");
      q = clean.length ? { passPct: q.passPct, questions: clean } : null;
    }
    setBusy(true);
    try {
      const payload = { title: title.trim(), body: body.trim(), videoUrl, durationMin: Number(duration) || 0, section: section.trim(), isPreview, materials, chapters, quiz: q, assignment: assignment.trim() };
      const url = initial ? `/api/mentorlik/darslar/${initial.id}` : `/api/mentorlik/kurslar/${courseId}/darslar`;
      const res = await fetch(url, { method: initial ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = (await res.json()) as { ok: boolean; error?: string; fields?: Record<string, string>; data?: { id: string } };
      if (!res.ok || !j.ok) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Saqlanmadi");
      onSaved({ id: initial?.id ?? j.data!.id, position: initial?.position ?? nextPos, title: payload.title, body: payload.body, videoUrl, durationMin: payload.durationMin, section: payload.section, isPreview, materials, chapters, quiz: q, assignment: payload.assignment });
      toast(initial ? "Dars saqlandi" : "Dars qo'shildi", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="expand-in card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-semibold text-fg">{initial ? "Darsni tahrirlash" : "Yangi dars"}</p>
        <button type="button" onClick={onCancel} aria-label="Yopish" className="press flex h-8 w-8 items-center justify-center rounded-full text-fg-3 hover:bg-fg/6"><X size={16} /></button>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={MENTOR_LIMITS.lessonTitleMax} placeholder="Dars nomi" className="field h-11 w-full text-[14px]" autoFocus />
      {/* Udemy «section»: bir xil nomli ketma-ket darslar kurs sahifasida bitta bo'limga yig'iladi */}
      <input value={section} onChange={(e) => setSection(e.target.value)} maxLength={80} list="lesson-sections" placeholder="Bo'lim nomi (ixtiyoriy, masalan: 1-modul · Asoslar)" aria-label="Kurs bo'limi" className="field h-10 w-full text-[13px]" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={MENTOR_LIMITS.lessonBodyMax} rows={4} placeholder="Dars matni / izoh (ixtiyoriy)…" className="field w-full resize-y py-2.5 text-[14px] leading-relaxed" />
      <div className="flex flex-wrap items-center gap-2">
        <label className="press flex h-10 cursor-pointer items-center gap-1.5 rounded-[12px] border border-line px-3.5 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
          {vidUp > 0 ? <><Loader2 size={14} className="animate-spin" /> {Math.round(vidUp * 100)}%</> : videoUrl ? <><Check size={14} className="text-success-text" /> Video tayyor</> : <><Video size={14} /> Video yuklash</>}
          <input type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" className="sr-only" onChange={(e) => { void uploadVideo(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        </label>
        {videoUrl && <button type="button" onClick={() => setVideoUrl(null)} className="text-[12.5px] font-semibold text-fg-3 underline-offset-2 hover:underline">olib tashlash</button>}
        <input value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Davomiyligi (daq)" className="field h-10 w-32 text-[13px]" />
        <label className="flex items-center gap-1.5 text-[13px] font-medium text-fg-2">
          <input type="checkbox" checked={isPreview} onChange={(e) => setIsPreview(e.target.checked)} className="h-4 w-4 accent-[var(--accent-strong)]" /> Bepul namuna
        </label>
      </div>

      <details className="rounded-[12px] border border-line p-3" open={materials.length > 0}>
        <summary className="cursor-pointer text-[13.5px] font-semibold text-fg">Materiallar <span className="text-fg-4">· {materials.length}/8</span></summary>
        <ul className="mt-2 space-y-1">
          {materials.map((m, i) => (
            <li key={m.url} className="flex items-center gap-2 text-[13px] text-fg-2"><FileText size={14} /> <span className="min-w-0 flex-1 truncate">{m.name}</span><button type="button" aria-label="O'chirish" onClick={() => setMaterials((x) => x.filter((_, k) => k !== i))} className="text-fg-3 hover:text-danger"><Trash2 size={13} /></button></li>
          ))}
        </ul>
        {materials.length < 8 && (
          <label className="mt-2 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-[12.5px] font-semibold text-fg-2 hover:border-fg">
            {matUp ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Fayl qo&apos;shish (PDF, DOCX, ZIP, rasm)
            <input type="file" accept=".pdf,.doc,.docx,.zip,image/*" className="sr-only" onChange={(e) => { void uploadMaterial(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          </label>
        )}
        <p className="mt-1.5 text-[11.5px] text-fg-4">Preset yoki loyiha fayllarini ZIP qilib yuklang.</p>
      </details>

      <details className="rounded-[12px] border border-line p-3" open={chaptersText.trim().length > 0}>
        <summary className="cursor-pointer text-[13.5px] font-semibold text-fg">Video vaqt belgilari</summary>
        <textarea value={chaptersText} onChange={(e) => setChaptersText(e.target.value)} rows={4} placeholder={"00:00 Kirish\n03:20 Kesish va timeline\n12:45 Rang korreksiyasi"} className="field mt-2 w-full resize-y py-2 font-mono text-[13px]" />
        <p className="mt-1 text-[11.5px] text-fg-4">Har qatorda: «mm:ss Sarlavha». Talaba bosib shu joyga o&apos;tadi.</p>
      </details>

      <details className="rounded-[12px] border border-line p-3" open={Boolean(quiz)}>
        <summary className="cursor-pointer text-[13.5px] font-semibold text-fg">Dars testi {quiz ? <span className="text-fg-4">· {quiz.questions.length} savol</span> : ""}</summary>
        {!quiz ? (
          <button type="button" onClick={() => setQuiz({ passPct: 70, questions: [{ q: "", options: ["", ""], correct: 0 }] })} className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[12.5px] font-semibold text-fg-2 hover:border-fg"><Plus size={13} /> Test qo&apos;shish</button>
        ) : (
          <div className="mt-2 space-y-3">
            <label className="flex items-center gap-2 text-[13px] text-fg-2">O&apos;tish foizi <input value={quiz.passPct} onChange={(e) => setQuiz({ ...quiz, passPct: Math.min(100, Math.max(50, Number(e.target.value.replace(/\D/g, "")) || 70)) })} inputMode="numeric" className="field h-9 w-20 text-[13px]" />%</label>
            {quiz.questions.map((q, i) => (
              <div key={i} className="space-y-1.5 rounded-lg bg-fg/[0.03] p-2.5">
                <div className="flex gap-2">
                  <input value={q.q} onChange={(e) => setQ(i, { q: e.target.value })} maxLength={200} placeholder={`${i + 1}-savol`} className="field h-9 min-w-0 flex-1 text-[13.5px]" />
                  <button type="button" aria-label="Savolni o'chirish" onClick={() => setQuiz({ ...quiz, questions: quiz.questions.filter((_, k) => k !== i) })} className="text-fg-3 hover:text-danger"><Trash2 size={14} /></button>
                </div>
                {q.options.map((o, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <input type="radio" name={`c${i}`} checked={q.correct === j} onChange={() => setQ(i, { correct: j })} aria-label="To'g'ri javob" />
                    <input value={o} onChange={(e) => setQ(i, { options: q.options.map((x, k) => (k === j ? e.target.value : x)) })} maxLength={120} placeholder={`Variant ${j + 1}`} className="field h-8 min-w-0 flex-1 text-[13px]" />
                    {q.options.length > 2 && <button type="button" aria-label="Variantni o'chirish" onClick={() => setQ(i, { options: q.options.filter((_, k) => k !== j), correct: q.correct === j ? 0 : q.correct > j ? q.correct - 1 : q.correct })} className="text-fg-4 hover:text-danger"><X size={13} /></button>}
                  </div>
                ))}
                {q.options.length < 5 && <button type="button" onClick={() => setQ(i, { options: [...q.options, ""] })} className="text-[12px] font-semibold text-fg-3 hover:text-fg">+ variant</button>}
              </div>
            ))}
            <div className="flex gap-3">
              {quiz.questions.length < 10 && <button type="button" onClick={() => setQuiz({ ...quiz, questions: [...quiz.questions, { q: "", options: ["", ""], correct: 0 }] })} className="text-[12.5px] font-semibold text-fg-2 hover:text-fg">+ savol</button>}
              <button type="button" onClick={() => setQuiz(null)} className="text-[12.5px] font-semibold text-fg-3 hover:text-danger">Testni olib tashlash</button>
            </div>
          </div>
        )}
      </details>

      <details className="rounded-[12px] border border-line p-3" open={assignment.trim().length > 0}>
        <summary className="cursor-pointer text-[13.5px] font-semibold text-fg">Uy vazifasi</summary>
        <textarea value={assignment} onChange={(e) => setAssignment(e.target.value)} rows={3} maxLength={600} placeholder="Talaba nima qilishi kerak? Masalan: 30 soniyalik reel montaj qiling va havolasini yuboring." className="field mt-2 w-full resize-y py-2 text-[13.5px]" />
        <p className="mt-1 text-[11.5px] text-fg-4">Talabalar ishi «Vazifalar» sahifangizda ko&apos;rinadi; yaxshilarini ommaga chiqarishingiz mumkin.</p>
      </details>

      <button type="button" onClick={() => void save()} disabled={busy || vidUp > 0 || matUp} className="btn-accent inline-flex h-10 items-center gap-2 rounded-[12px] px-5 text-[14px] font-semibold disabled:opacity-60">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {initial ? "Saqlash" : "Qo'shish"}
      </button>
    </div>
  );
}

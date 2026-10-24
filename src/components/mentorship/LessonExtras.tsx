"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, Loader2, Paperclip, XCircle } from "lucide-react";
import { showToast } from "@/components/ui/toast";
import { uploadAttachment } from "@/components/chat/attachments";
import { cn } from "@/lib/utils";

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { data?: T; error?: string; fields?: Record<string, string> };
  if (!r.ok) throw new Error(Object.values(j.fields ?? {})[0] || j.error || "Xatolik");
  return j.data as T;
}

const kb = (n?: number) => (n ? (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`) : "");

export function Materials({ items }: { items: Array<{ name: string; url: string; size?: number }> }) {
  if (!items.length) return null;
  return (
    <section>
      <ul className="divide-y divide-line rounded-[14px] border border-line">
        {items.map((m) => (
          <li key={m.url}>
            <a href={m.url} target="_blank" rel="noopener noreferrer" download className="flex items-center gap-3 px-3.5 py-2.5 text-[14px] transition hover:bg-fg/[0.04]">
              <FileText size={16} className="shrink-0 text-fg-3" />
              <span className="min-w-0 flex-1 truncate font-semibold text-fg">{m.name}</span>
              <span className="text-[12px] text-fg-3">{kb(m.size)}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

type QuizRes = { scorePct: number; passed: boolean; passPct: number; wrong: number[] };
export function QuizBlock({ lessonId, quiz, passed }: { lessonId: string; quiz: { passPct: number; questions: Array<{ q: string; options: string[] }> }; passed: boolean }) {
  const router = useRouter();
  const [ans, setAns] = useState<(number | null)[]>(() => quiz.questions.map(() => null));
  const [res, setRes] = useState<QuizRes | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = ans.every((a) => a !== null);

  async function submit() {
    setBusy(true);
    try {
      const r = await post<QuizRes>(`/api/mentorlik/darslar/${lessonId}/test`, { answers: ans });
      setRes(r);
      if (r.passed) {
        showToast(`Test topshirildi: ${r.scorePct}% 🎉`, "success");
        router.refresh();
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[16px] border border-line p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-bold text-fg">Dars testi</h2>
        <span className="text-[12px] text-fg-3">o&apos;tish: {quiz.passPct}%</span>
        {passed && <span className="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold text-success-text"><CheckCircle2 size={15} /> O&apos;tilgan</span>}
      </div>
      {!passed && (
        <>
          <ol className="mt-3 space-y-4">
            {quiz.questions.map((q, i) => (
              <li key={i}>
                <p className={cn("text-[14.5px] font-semibold text-fg", res?.wrong.includes(i) && "text-danger")}>{i + 1}. {q.q}</p>
                <div className="mt-1.5 space-y-1">
                  {q.options.map((o, j) => (
                    <label key={j} className={cn("flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[14px] transition hover:bg-fg/[0.04]", ans[i] === j && "bg-fg/[0.06]")}>
                      <input type="radio" name={`q${i}`} checked={ans[i] === j} onChange={() => setAns((a) => a.map((x, k) => (k === i ? j : x)))} /> {o}
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          {res && !res.passed && (
            <p role="alert" className="mt-3 flex items-center gap-1.5 text-[13.5px] font-semibold text-danger">
              <XCircle size={15} /> {res.scorePct}% — yetarli emas ({res.passPct}% kerak). Qizil savollarni qayta ko&apos;rib chiqing.
            </p>
          )}
          <button type="button" disabled={!ready || busy} onClick={() => void submit()} className="btn-accent mt-4 inline-flex h-11 items-center gap-2 px-6 text-[14px] font-semibold disabled:opacity-50">
            {busy && <Loader2 size={15} className="animate-spin" />} Tekshirish
          </button>
        </>
      )}
    </section>
  );
}

type Sub = { status: string; grade: number | null; feedback: string; body: string; fileUrl: string | null } | null;
export function AssignmentBlock({ lessonId, prompt, submission, canSubmit }: { lessonId: string; prompt: string; submission: Sub; canSubmit: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState(submission?.body ?? "");
  const [file, setFile] = useState<{ url: string; name: string } | null>(submission?.fileUrl ? { url: submission.fileUrl, name: "Biriktirilgan fayl" } : null);
  const [up, setUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = submission?.status === "reviewed";

  async function upload(f: File | null) {
    if (!f) return;
    setUp(true);
    try {
      const a = await uploadAttachment(f, { docs: true });
      setFile({ url: a.url, name: a.name });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Yuklanmadi", "error");
    } finally {
      setUp(false);
    }
  }
  async function submit() {
    setBusy(true);
    try {
      await post(`/api/mentorlik/darslar/${lessonId}/vazifa`, { body, fileUrl: file?.url ?? null });
      showToast("Vazifa topshirildi", "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[16px] border border-line p-4 sm:p-5">
      <h2 className="text-[15px] font-bold text-fg">Uy vazifasi</h2>
      <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-fg-2">{prompt}</p>
      {submission && (
        <p className={cn("mt-3 rounded-lg px-3 py-2 text-[13.5px] font-semibold", submission.status === "reviewed" ? "bg-success-soft text-success-text" : submission.status === "needs_work" ? "bg-danger-soft text-danger-text" : "bg-fg/[0.05] text-fg-2")}>
          {submission.status === "reviewed" ? `Baholandi${submission.grade != null ? `: ${submission.grade}/100` : ""}` : submission.status === "needs_work" ? "Qayta ishlash kerak" : "Ustoz ko'rib chiqmoqda…"}
          {submission.feedback && <span className="mt-1 block whitespace-pre-line font-normal">{submission.feedback}</span>}
        </p>
      )}
      {canSubmit && !locked && (
        <div className="mt-3 space-y-2">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} placeholder="Javobingiz, havola yoki izoh…" className="field w-full resize-y py-2.5 text-[14px]" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-semibold text-fg-2 hover:border-fg">
              {up ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />} {file ? file.name.slice(0, 28) : "Fayl biriktirish"}
              <input type="file" className="sr-only" accept="image/*,.pdf,.doc,.docx,.zip,video/mp4,video/webm,video/quicktime" onChange={(e) => { void upload(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            </label>
            <button type="button" disabled={busy || up || (!body.trim() && !file)} onClick={() => void submit()} className="btn-accent inline-flex h-10 items-center gap-2 px-5 text-[14px] font-semibold disabled:opacity-50">
              {busy && <Loader2 size={14} className="animate-spin" />} {submission ? "Qayta yuborish" : "Topshirish"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

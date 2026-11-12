"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Loader2, Plus, Video } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { showToast } from "@/components/ui/toast";
import { uploadAttachment } from "@/components/chat/attachments";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { MK } from "@/lib/i18n/dict/mentorship";
import { MENTOR_LIMITS } from "@/lib/mentorship/format";
import { cn } from "@/lib/utils";

type Step = 0 | 1 | 2;

/**
 * «10 daqiqada birinchi kurs» ustasi (2026-11-12, Teachable/Podia odati): yangi ustoz bo'sh tahrirlagichga emas,
 * uch qisqa savolga tushadi — 1) nom va bir jumla tavsif, 2) narx (bepul / pullik), 3) birinchi dars videosi
 * (ixtiyoriy — «keyin qo'shaman»). Oxirida kurs yaratiladi, birinchi dars BEPUL NAMUNA bo'lib qo'shiladi va video
 * bo'lsa kurs darhol chop etiladi. Qolgan sozlamalar (muqova, natijalar, modullar, test…) tahrirlagichda.
 */
export function CourseWizard({ mentorId, admin = false }: { mentorId?: string; admin?: boolean }) {
  const til = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState("");
  const [up, setUp] = useState(0);
  const [busy, setBusy] = useState(false);

  const priceNum = Number(price.replace(/\D/g, "")) || 0;
  const canNext0 = title.trim().length >= 5;
  const canNext1 = !paid || (priceNum >= 1000 && priceNum <= MENTOR_LIMITS.priceMax);

  function reset() {
    setStep(0);
    setTitle("");
    setSummary("");
    setPaid(false);
    setPrice("");
    setLessonTitle("");
    setVideoUrl(null);
    setVideoName("");
    setUp(0);
  }

  async function upload(file: File | null) {
    if (!file) return;
    setUp(0.01);
    try {
      const a = await uploadAttachment(file, { docs: true, onProgress: (p) => setUp(Math.max(0.01, p)) });
      if (!a.type.startsWith("video/")) throw new Error(tr(til, MK.wizVideoOnly));
      setVideoUrl(a.url);
      setVideoName(file.name);
      if (!lessonTitle.trim()) setLessonTitle(tr(til, MK.wizFirstLessonDefault));
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr(til, MK.error), "error");
    } finally {
      setUp(0);
    }
  }

  async function call<T>(url: string, body: unknown): Promise<T> {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => null)) as { ok: boolean; error?: string; fields?: Record<string, string>; data?: T } | null;
    if (!r.ok || !j?.ok) throw new Error((j?.fields && Object.values(j.fields)[0]) || j?.error || tr(til, MK.notAdded));
    return j.data as T;
  }

  async function finish() {
    if (busy || up > 0) return;
    setBusy(true);
    let courseId: string | null = null;
    try {
      const c = await call<{ id: string }>("/api/mentorlik/kurslar", { title: title.trim(), summary: summary.trim(), priceFrom: paid ? priceNum : 0, ...(admin && mentorId ? { mentorId } : {}) });
      courseId = c.id;
      const lt = lessonTitle.trim();
      if (videoUrl || lt.length >= 3) {
        await call(`/api/mentorlik/kurslar/${c.id}/darslar`, { title: lt.length >= 3 ? lt : tr(til, MK.wizFirstLessonDefault), videoUrl, isPreview: true });
        // Video bilan birinchi dars bor — kurs darhol katalogda (keyin ham yashirish mumkin)
        if (videoUrl) await call(`/api/mentorlik/kurslar/${c.id}/publish`, { publish: true }).catch(() => undefined);
      }
      showToast(videoUrl ? tr(til, MK.wizDonePublished) : tr(til, MK.wizDoneDraft), "success");
      setOpen(false);
      reset();
      router.push(`/kabinet/mentorlik/${c.id}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr(til, MK.notAdded), "error");
      // Kurs yaratilib, dars qo'shilmay qolsa — tahrirlagichga o'tamiz (qayta urinishda dublikat kurs ochilmasin)
      if (courseId) router.push(`/kabinet/mentorlik/${courseId}`);
    } finally {
      setBusy(false);
    }
  }

  const steps = [tr(til, MK.wizStepName), tr(til, MK.wizStepPrice), tr(til, MK.wizStepLesson)];

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ink press inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-[14px] font-semibold">
        <Plus size={16} /> {tr(til, MK.wizOpen)}
      </button>
      <Sheet
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={tr(til, MK.wizTitle)}
        size="md"
        footer={
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button type="button" disabled={busy} onClick={() => setStep((s) => (s - 1) as Step)} className="inline-flex h-11 items-center gap-1 rounded-full border border-line-2 px-4 text-[14px] font-semibold text-fg-2 hover:text-fg">
                <ChevronLeft size={16} /> {tr(til, MK.wizBack)}
              </button>
            )}
            {step < 2 ? (
              <button
                type="button"
                disabled={step === 0 ? !canNext0 : !canNext1}
                onClick={() => setStep((s) => (s + 1) as Step)}
                className="btn-ink ml-auto inline-flex h-11 items-center rounded-full px-6 text-[14px] font-semibold disabled:opacity-40"
              >
                {tr(til, MK.wizNext)}
              </button>
            ) : (
              <button type="button" disabled={busy || up > 0} onClick={() => void finish()} className="btn-accent ml-auto inline-flex h-11 items-center gap-2 rounded-full px-6 text-[14px] font-semibold disabled:opacity-50">
                {busy && <Loader2 size={15} className="animate-spin" />} {videoUrl ? tr(til, MK.wizPublish) : tr(til, MK.wizCreate)}
              </button>
            )}
          </div>
        }
      >
        {/* Qadamlar chizig'i */}
        <ol className="mb-5 flex gap-1.5" aria-label={tr(til, MK.wizTitle)}>
          {steps.map((s, i) => (
            <li key={s} className="min-w-0 flex-1">
              <span className={cn("block h-1 rounded-full transition-colors duration-300", i <= step ? "bg-fg" : "bg-fg/12")} />
              <span className={cn("mt-1.5 block truncate text-[11.5px] font-semibold", i === step ? "text-fg" : "text-fg-4")} aria-current={i === step ? "step" : undefined}>
                {i + 1}. {s}
              </span>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div key="s0" className="animate-fade-in space-y-3">
            <label className="block">
              <span className="field-label">{tr(til, MK.wizNameLabel)}</span>
              <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={MENTOR_LIMITS.courseTitleMax} placeholder={tr(til, MK.newSectionPh)} className="field h-12 w-full text-[15px] max-md:text-[16px]" />
              {title.length > 0 && !canNext0 && <span className="mt-1 block text-[12px] text-fg-3">{tr(til, MK.sectionMin5)}</span>}
            </label>
            <label className="block">
              <span className="field-label">
                {tr(til, MK.wizSummaryLabel)} <span className="font-normal text-fg-4">{tr(til, MK.wizOptional)}</span>
              </span>
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} maxLength={300} placeholder={tr(til, MK.wizSummaryPh)} className="field w-full resize-none py-2.5 text-[14px] max-md:text-[16px]" />
            </label>
          </div>
        )}

        {step === 1 && (
          <div key="s1" className="animate-fade-in space-y-3">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={tr(til, MK.wizStepPrice)}>
              {[false, true].map((p) => (
                <button
                  key={String(p)}
                  type="button"
                  role="radio"
                  aria-checked={paid === p}
                  onClick={() => setPaid(p)}
                  className={cn("press rounded-[14px] border p-4 text-left transition-colors", paid === p ? "border-fg bg-fg/[0.03]" : "border-line hover:border-line-2")}
                >
                  <span className="flex items-center justify-between text-[15px] font-bold text-fg">
                    {p ? tr(til, MK.wizPaid) : tr(til, MK.wizFree)}
                    {paid === p && <Check size={16} />}
                  </span>
                  <span className="mt-1 block text-[12.5px] leading-snug text-fg-3">{p ? tr(til, MK.wizPaidHint) : tr(til, MK.wizFreeHint)}</span>
                </button>
              ))}
            </div>
            {paid && (
              <label className="block animate-fade-in">
                <span className="field-label">{tr(til, MK.priceSom)}</span>
                <MoneyInput value={price} onChange={setPrice} placeholder="150 000" className="h-12 text-[15px] max-md:text-[16px]" />
                <span className="mt-1 block text-[12px] text-fg-3">{tr(til, MK.wizPriceHint)}</span>
              </label>
            )}
          </div>
        )}

        {step === 2 && (
          <div key="s2" className="animate-fade-in space-y-3">
            <p className="text-[13.5px] leading-relaxed text-fg-2">{tr(til, MK.wizLessonLead)}</p>
            <label className={cn("press flex cursor-pointer items-center gap-3 rounded-[14px] border border-dashed p-4 transition-colors", videoUrl ? "border-success-text/50 bg-success-soft" : "border-line-2 hover:border-fg")}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-fg/6">{up > 0 ? <Loader2 size={18} className="animate-spin" /> : videoUrl ? <Check size={18} className="text-success-text" /> : <Video size={18} />}</span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-fg">{up > 0 ? `${Math.round(up * 100)}%` : videoUrl ? videoName : tr(til, MK.wizPickVideo)}</span>
                <span className="block text-[12px] text-fg-3">{tr(til, MK.wizVideoHint)}</span>
              </span>
              <input type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" className="sr-only" disabled={up > 0 || busy} onChange={(e) => { void upload(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            </label>
            <label className="block">
              <span className="field-label">{tr(til, MK.wizLessonName)}</span>
              <input value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} maxLength={MENTOR_LIMITS.lessonTitleMax} placeholder={tr(til, MK.wizFirstLessonDefault)} className="field h-11 w-full text-[14px] max-md:text-[16px]" />
            </label>
            <p className="text-[12px] text-fg-4">{tr(til, MK.wizLater)}</p>
          </div>
        )}
      </Sheet>
    </>
  );
}

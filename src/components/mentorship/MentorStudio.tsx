"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ImagePlus, Loader2, Plus, Radio, Trash2, X } from "lucide-react";
import { Spinner } from "@/components/ui";
import { showToast } from "@/components/ui/toast";
import { uploadAttachment } from "@/components/chat/attachments";
import { ImageCropper } from "@/components/kabinet/ImageCropper";
import { MENTOR_CATEGORIES, MENTOR_LIMITS } from "@/lib/mentorship/format";
import { CourseWizard } from "./CourseWizard";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { MK, categoryLabelTr } from "@/lib/i18n/dict/mentorship";
import type { MentorProfile } from "@/lib/mentorship/service";
import { WorkReviewSettings } from "@/components/mentorship/WorkReview";
import { cn } from "@/lib/utils";

/** Saytda ko'rsatiladigan kadr nisbatlari (mentor sahifasi va katalog bilan bir xil) */
export const PORTRAIT_ASPECT = 4 / 5;
export const COVER_ASPECT = 3;

interface CourseRow {
  id: string;
  title: string;
  category: string;
  isPublished: boolean;
  lessonsCount: number;
  studentsCount: number;
}

/**
 * Rasm yuklash katagi: katak ko'rsatiladigan joyning NISBATIDA (aspect) chiziladi, yuklashdan oldin ImageCropper bilan
 * shu nisbatga moslanadi — saytda aynan shu kadr ko'rinadi (kesilib ketmaydi).
 */
function ImageSlot({ label, hint, value, onChange, aspect, outWidth, className }: { label: string; hint: string; value: string | null; onChange: (url: string | null) => void; aspect: number; outWidth: number; className?: string }) {
  const til = useLocale();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  async function upload(f: File) {
    setBusy(true);
    try {
      const a = await uploadAttachment(f);
      onChange(a.url);
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr(til, MK.notUploaded), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={className}>
      <span className="mb-1.5 block text-[12.5px] font-semibold text-fg-2">{label}</span>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setCropFile(f);
          if (ref.current) ref.current.value = "";
        }}
      />
      <div className="relative w-full overflow-hidden rounded-[14px] border border-dashed border-line-2 bg-fg/[0.03]" style={{ aspectRatio: String(aspect) }}>
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <button type="button" onClick={() => onChange(null)} aria-label={tr(til, MK.remove)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white">
              <X size={15} />
            </button>
            <button type="button" onClick={() => ref.current?.click()} className="absolute bottom-2 left-2 rounded-full bg-black/60 px-3 py-1.5 text-[12px] font-semibold text-white">
              {tr(til, MK.replace)}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => ref.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 text-center text-fg-3 transition hover:text-fg">
            {busy ? <Spinner /> : <ImagePlus size={22} />}
            <span className="text-[12.5px] font-semibold">{busy ? tr(til, MK.uploading) : tr(til, MK.uploadImage)}</span>
            <span className="text-[11.5px] text-fg-4">{hint}</span>
          </button>
        )}
        {busy && value && <div className="absolute inset-0 grid place-items-center bg-black/50 text-white"><Spinner /></div>}
      </div>
      {cropFile && (
        <ImageCropper
          file={cropFile}
          aspect={aspect}
          outWidth={outWidth}
          title={MK.cropTitle[til](label)}
          onCancel={() => setCropFile(null)}
          onDone={(f) => {
            setCropFile(null);
            void upload(f);
          }}
        />
      )}
    </div>
  );
}

/* --------------------------------- Ko'rsatkichlar --------------------------------- */

/** Mentor ko'rsatkichlari — kabinet «Umumiy» sahifasida ham, admin studiyasida ham bir xil */
export function MentorStats({ mentor, courses }: { mentor: MentorProfile; courses: CourseRow[] }) {
  const til = useLocale();
  const rows = [
    { k: tr(til, MK.statSections), v: courses.length },
    { k: tr(til, MK.statOpen), v: courses.filter((c) => c.isPublished).length },
    { k: tr(til, MK.statStudents), v: courses.reduce((a, c) => a + c.studentsCount, 0) },
    { k: tr(til, MK.statRating), v: mentor.rating > 0 ? mentor.rating.toFixed(1) : "—" },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {rows.map((x) => (
        <div key={x.k} className="card p-3.5">
          <dt className="text-[12px] font-medium text-fg-3">{x.k}</dt>
          <dd className="mt-1 font-display text-[22px] font-semibold tabular-nums leading-none text-fg">{x.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------ Sahifa ma'lumotlari ------------------------------ */

/**
 * Mentorning ommaviy sahifasi ma'lumotlari: portret, muqova, sarlavha, tavsif, yo'nalish, ma'lumot kartalari.
 * Kabinetda alohida sahifada (`/kabinet/mentorlik/sahifa`), adminda studiya ichida ishlatiladi.
 */
export function MentorPageForm({ mentor }: { mentor: MentorProfile }) {
  const til = useLocale();
  const router = useRouter();
  const [roleLabel, setRoleLabel] = useState(mentor.roleLabel ?? "");
  const [headline, setHeadline] = useState(mentor.headline);
  const [bio, setBio] = useState(mentor.bio);
  const [expertise, setExpertise] = useState<string[]>(mentor.expertise);
  const [photoUrl, setPhotoUrl] = useState<string | null>(mentor.photoUrl);
  const [coverUrl, setCoverUrl] = useState<string | null>(mentor.coverUrl);
  const [highlights, setHighlights] = useState(mentor.highlights);
  const [saving, setSaving] = useState(false);

  const toggle = (k: string) => setExpertise((s) => (s.includes(k) ? s.filter((x) => x !== k) : s.length < MENTOR_LIMITS.expertiseMax ? [...s, k] : s));
  const setH = (i: number, patch: Partial<{ title: string; text: string }>) => setHighlights((l) => l.map((h, j) => (j === i ? { ...h, ...patch } : h)));

  async function save() {
    if (saving) return;
    if (headline.trim().length < 4) return showToast(tr(til, MK.headlineMin4), "error");
    setSaving(true);
    try {
      const res = await fetch(`/api/mentorlik/ustoz/${mentor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleLabel: roleLabel.trim() || null, headline: headline.trim(), bio: bio.trim(), expertise, photoUrl, coverUrl, highlights: highlights.filter((h) => h.title.trim()) }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string; fields?: Record<string, string> };
      if (!res.ok || !j.ok) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || tr(til, MK.notSaved));
      showToast(tr(til, MK.saved), "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr(til, MK.notSaved), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card space-y-4 p-4 sm:p-5">
      <div className="grid items-start gap-4 sm:grid-cols-[170px_minmax(0,1fr)]">
        <ImageSlot label={tr(til, MK.portrait)} hint={tr(til, MK.portraitHint)} value={photoUrl} onChange={setPhotoUrl} aspect={PORTRAIT_ASPECT} outWidth={1000} className="max-w-[220px]" />
        <ImageSlot label={tr(til, MK.cover)} hint={tr(til, MK.coverHint)} value={coverUrl} onChange={setCoverUrl} aspect={COVER_ASPECT} outWidth={1800} />
      </div>
      <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-semibold text-fg-2">{tr(til, MK.roleLabel)}</span>
          <input value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} maxLength={MENTOR_LIMITS.roleMax} placeholder={tr(til, MK.roleLabelPh)} className="field h-11 w-full text-[14px]" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-semibold text-fg-2">{tr(til, MK.mainHeadline)}</span>
          <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={MENTOR_LIMITS.headlineMax} placeholder={tr(til, MK.mainHeadlinePh)} className="field h-11 w-full text-[14px]" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-[12.5px] font-semibold text-fg-2">{tr(til, MK.description)}</span>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={MENTOR_LIMITS.bioMax} rows={5} placeholder={tr(til, MK.descriptionPh)} className="field w-full resize-y py-2.5 text-[14px] leading-relaxed" />
      </label>
      <div>
        <span className="mb-1.5 block text-[12.5px] font-semibold text-fg-2">{tr(til, MK.direction)}</span>
        <div className="flex flex-wrap gap-2">
          {MENTOR_CATEGORIES.filter((c) => c.key !== "boshqa").map((c) => (
            <button key={c.key} type="button" onClick={() => toggle(c.key)} aria-pressed={expertise.includes(c.key)} className={cn("inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold transition", expertise.includes(c.key) ? "btn-ink border-transparent" : "border-line text-fg-2 hover:border-fg")}>
              {categoryLabelTr(til, c.key)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[12.5px] font-semibold text-fg-2">{tr(til, MK.infoCards)} <span className="font-normal text-fg-4">{tr(til, MK.infoCardsHint)}</span></span>
          {highlights.length < MENTOR_LIMITS.highlightsMax && (
            <button type="button" onClick={() => setHighlights((l) => [...l, { title: "", text: "" }])} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent-text">
              <Plus size={14} /> {tr(til, MK.add)}
            </button>
          )}
        </div>
        <div className="space-y-2.5">
          {highlights.map((h, i) => (
            <div key={i} className="grid gap-2 rounded-[14px] bg-fg/[0.04] p-3 sm:grid-cols-[200px_minmax(0,1fr)_auto]">
              <input value={h.title} onChange={(e) => setH(i, { title: e.target.value })} maxLength={MENTOR_LIMITS.highlightTitleMax} placeholder={tr(til, MK.cardTitle)} aria-label={tr(til, MK.cardTitleAria)} className="field h-10 text-[13.5px]" />
              <input value={h.text} onChange={(e) => setH(i, { text: e.target.value })} maxLength={MENTOR_LIMITS.highlightTextMax} placeholder={tr(til, MK.cardText)} aria-label={tr(til, MK.cardTextAria)} className="field h-10 text-[13.5px]" />
              <button type="button" onClick={() => setHighlights((l) => l.filter((_, j) => j !== i))} aria-label={tr(til, MK.deleteCard)} className="grid h-10 w-10 place-items-center rounded-full text-fg-3 hover:bg-fg/8">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <button type="button" onClick={() => void save()} disabled={saving} className="btn-accent inline-flex h-11 items-center gap-2 rounded-full px-6 text-[14.5px] font-semibold disabled:opacity-60">
        {saving && <Loader2 size={16} className="animate-spin" />} {tr(til, MK.save)}
      </button>
    </section>
  );
}

/* ---------------------------------- Bo'limlar ---------------------------------- */

/** Bo'limlar (kurslar): yangi bo'lim qo'shish + ro'yxat. Bo'lim ichidagi darslar — `/kabinet/mentorlik/[courseId]` */
export function MentorSections({ mentor, courses, admin = false }: { mentor: MentorProfile; courses: CourseRow[]; admin?: boolean }) {
  const til = useLocale();
  return (
    <section>
      <h2 className="text-[15px] font-bold text-fg">
        {tr(til, MK.sections)} <span className="font-normal text-fg-4">· {courses.length}</span>
      </h2>
      <div className="mt-2.5">
        <CourseWizard mentorId={mentor.id} admin={admin} />
      </div>
      {courses.length > 0 ? (
        <ul className="mt-1 divide-y divide-line border-t border-line">
          {courses.map((c) => (
            <li key={c.id}>
              <Link href={`/kabinet/mentorlik/${c.id}`} className="flex items-center gap-3 py-3 transition hover:opacity-80">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold text-fg">{c.title}</span>
                  <span className="block text-[12px] text-fg-3">
                    {MK.sectionMeta[til](categoryLabelTr(til, c.category), c.lessonsCount, c.studentsCount)}
                  </span>
                </span>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold", c.isPublished ? "bg-success-soft text-success-text" : "bg-fg/8 text-fg-3")}>{c.isPublished ? tr(til, MK.published) : tr(til, MK.draft)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13.5px] text-fg-3">{tr(til, MK.noSections)}</p>
      )}
    </section>
  );
}

/* --------------------------------- Admin studiyasi --------------------------------- */

/**
 * Admin uchun to'liq studiya: ko'rsatkichlar + sahifa ma'lumotlari + bo'limlar bitta sahifada.
 * Mentorning o'z kabineti bu qismlarni alohida sahifalarga bo'lib ishlatadi (MentorNav bilan).
 */
export function MentorStudio({ mentor, courses, admin = false }: { mentor: MentorProfile; courses: CourseRow[]; admin?: boolean }) {
  const til = useLocale();
  const pageHref = mentor.slug ? `/mentorlik/ustoz/${mentor.slug}` : null;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight text-fg">{admin ? mentor.name : tr(til, MK.myMentorPage)}</h1>
          <p className="mt-0.5 text-[13px] text-fg-3">{admin ? tr(til, MK.adminStudioLead) : tr(til, MK.studioLead)}</p>
        </div>
        {pageHref && (
          <div className="flex flex-wrap gap-2">
            <Link href={pageHref} className="btn-ink inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold">
              <Radio size={15} /> {tr(til, MK.postAndLive)}
            </Link>
            <Link href={pageHref} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13.5px] font-semibold text-fg-2 hover:border-fg hover:text-fg">
              {tr(til, MK.viewPage)} <ArrowUpRight size={14} />
            </Link>
          </div>
        )}
      </header>
      <MentorStats mentor={mentor} courses={courses} />
      <MentorPageForm mentor={mentor} />
      <WorkReviewSettings mentorId={mentor.id} initial={mentor.review} />
      <MentorSections mentor={mentor} courses={courses} admin={admin} />
    </div>
  );
}

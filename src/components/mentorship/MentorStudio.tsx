"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ImagePlus, Loader2, Plus, Radio, Trash2, X } from "lucide-react";
import { Spinner } from "@/components/ui";
import { showToast } from "@/components/ui/toast";
import { uploadAttachment } from "@/components/chat/attachments";
import { MENTOR_CATEGORIES, MENTOR_LIMITS, categoryLabel } from "@/lib/mentorship/format";
import type { MentorProfile } from "@/lib/mentorship/service";
import { cn } from "@/lib/utils";

interface CourseRow {
  id: string;
  title: string;
  category: string;
  isPublished: boolean;
  lessonsCount: number;
  studentsCount: number;
}

/** Rasm yuklash katagi: bo'sh — «+», to'la — rasm va «×». Faqat sayt orqali yuklanadi (uploadAttachment) */
function ImageSlot({ label, hint, value, onChange, className }: { label: string; hint: string; value: string | null; onChange: (url: string | null) => void; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      const a = await uploadAttachment(f);
      onChange(a.url);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Yuklanmadi", "error");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  return (
    <div className={className}>
      <span className="mb-1.5 block text-[12.5px] font-semibold text-fg-2">{label}</span>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      <div className="relative h-[calc(100%-1.6rem)] min-h-[120px] overflow-hidden rounded-[14px] border border-dashed border-line-2 bg-fg/[0.03]">
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <button type="button" onClick={() => onChange(null)} aria-label="Olib tashlash" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white">
              <X size={15} />
            </button>
            <button type="button" onClick={() => ref.current?.click()} className="absolute inset-x-2 bottom-2 rounded-full bg-black/60 py-1.5 text-[12px] font-semibold text-white">
              Almashtirish
            </button>
          </>
        ) : (
          <button type="button" onClick={() => ref.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 text-center text-fg-3 transition hover:text-fg">
            {busy ? <Spinner /> : <ImagePlus size={22} />}
            <span className="text-[12.5px] font-semibold">{busy ? "Yuklanmoqda…" : "Rasm yuklash"}</span>
            <span className="text-[11.5px] text-fg-4">{hint}</span>
          </button>
        )}
        {busy && value && <div className="absolute inset-0 grid place-items-center bg-black/50 text-white"><Spinner /></div>}
      </div>
    </div>
  );
}

/**
 * Mentor studiyasi — bitta sahifa: sahifa ma'lumotlari (rasm, muqova, sarlavha, bio, ma'lumot kartalari) va bo'limlar (kurslar).
 * Mentorning o'zi (/kabinet/mentorlik) ham, admin ham (/admin/mentorlik/[id]) shu komponent bilan ishlaydi.
 */
export function MentorStudio({ mentor, courses, admin = false }: { mentor: MentorProfile; courses: CourseRow[]; admin?: boolean }) {
  const router = useRouter();
  const [roleLabel, setRoleLabel] = useState(mentor.roleLabel ?? "");
  const [headline, setHeadline] = useState(mentor.headline);
  const [bio, setBio] = useState(mentor.bio);
  const [expertise, setExpertise] = useState<string[]>(mentor.expertise);
  const [photoUrl, setPhotoUrl] = useState<string | null>(mentor.photoUrl);
  const [coverUrl, setCoverUrl] = useState<string | null>(mentor.coverUrl);
  const [highlights, setHighlights] = useState(mentor.highlights);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const toggle = (k: string) => setExpertise((s) => (s.includes(k) ? s.filter((x) => x !== k) : s.length < MENTOR_LIMITS.expertiseMax ? [...s, k] : s));
  const setH = (i: number, patch: Partial<{ title: string; text: string }>) => setHighlights((l) => l.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  const pageHref = mentor.slug ? `/mentorlik/ustoz/${mentor.slug}` : null;

  async function save() {
    if (saving) return;
    if (headline.trim().length < 4) return showToast("Sarlavha kamida 4 belgi", "error");
    setSaving(true);
    try {
      const res = await fetch(`/api/mentorlik/ustoz/${mentor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleLabel: roleLabel.trim() || null, headline: headline.trim(), bio: bio.trim(), expertise, photoUrl, coverUrl, highlights: highlights.filter((h) => h.title.trim()) }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string; fields?: Record<string, string> };
      if (!res.ok || !j.ok) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Saqlanmadi");
      showToast("Saqlandi", "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Saqlanmadi", "error");
    } finally {
      setSaving(false);
    }
  }

  async function addSection() {
    if (adding) return;
    if (title.trim().length < 5) return showToast("Bo'lim nomi kamida 5 belgi", "error");
    setAdding(true);
    try {
      const res = await fetch("/api/mentorlik/kurslar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), ...(admin ? { mentorId: mentor.id } : {}) }) });
      const j = (await res.json()) as { ok: boolean; error?: string; data?: { id: string } };
      if (!res.ok || !j.ok || !j.data) throw new Error(j.error || "Qo'shilmadi");
      router.push(`/kabinet/mentorlik/${j.data.id}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Qo'shilmadi", "error");
      setAdding(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight text-fg">{admin ? mentor.name : "Mentorlik sahifam"}</h1>
          <p className="mt-0.5 text-[13px] text-fg-3">{admin ? "Mentor sahifasini siz nomidan sozlaysiz" : "Sahifa, postlar, efirlar va bo'limlar — hammasi shu yerda"}</p>
        </div>
        {pageHref && (
          <div className="flex flex-wrap gap-2">
            <Link href={pageHref} className="btn-accent inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold">
              <Radio size={15} /> Post va efir qo&apos;yish
            </Link>
            <Link href={pageHref} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13.5px] font-semibold text-fg-2 hover:border-fg hover:text-fg">
              Sahifani ko&apos;rish <ArrowUpRight size={14} />
            </Link>
          </div>
        )}
      </header>

      {/* Sahifa ma'lumotlari */}
      <section className="card space-y-4 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
          <ImageSlot label="Portret rasm" hint="Tik, yuz ko'rinadigan" value={photoUrl} onChange={setPhotoUrl} className="h-[220px] sm:h-[250px]" />
          <ImageSlot label="Muqova (ixtiyoriy)" hint="Keng rasm, 3:1" value={coverUrl} onChange={setCoverUrl} className="h-[160px] sm:h-[250px]" />
        </div>
        <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
          <label className="block">
            <span className="mb-1 block text-[12.5px] font-semibold text-fg-2">Rol yorlig&apos;i</span>
            <input value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} maxLength={MENTOR_LIMITS.roleMax} placeholder="Modul ustozi" className="field h-11 w-full text-[14px]" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12.5px] font-semibold text-fg-2">Asosiy sarlavha</span>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={MENTOR_LIMITS.headlineMax} placeholder="Dunyodagi eng yirik frilans platformasida ishlash" className="field h-11 w-full text-[14px]" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-semibold text-fg-2">Tavsif</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={MENTOR_LIMITS.bioMax} rows={5} placeholder="Ustoz haqida: tajriba, nima o'rgatadi, natijalar…" className="field w-full resize-y py-2.5 text-[14px] leading-relaxed" />
        </label>
        <div>
          <span className="mb-1.5 block text-[12.5px] font-semibold text-fg-2">Yo&apos;nalish</span>
          <div className="flex flex-wrap gap-2">
            {MENTOR_CATEGORIES.filter((c) => c.key !== "boshqa").map((c) => (
              <button key={c.key} type="button" onClick={() => toggle(c.key)} aria-pressed={expertise.includes(c.key)} className={cn("inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold transition", expertise.includes(c.key) ? "btn-ink border-transparent" : "border-line text-fg-2 hover:border-fg")}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[12.5px] font-semibold text-fg-2">Ma&apos;lumot kartalari <span className="font-normal text-fg-4">(masalan: «Nima o&apos;rganasiz», raqamlar)</span></span>
            {highlights.length < MENTOR_LIMITS.highlightsMax && (
              <button type="button" onClick={() => setHighlights((l) => [...l, { title: "", text: "" }])} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent-text">
                <Plus size={14} /> Qo&apos;shish
              </button>
            )}
          </div>
          <div className="space-y-2.5">
            {highlights.map((h, i) => (
              <div key={i} className="grid gap-2 rounded-[14px] bg-fg/[0.04] p-3 sm:grid-cols-[200px_minmax(0,1fr)_auto]">
                <input value={h.title} onChange={(e) => setH(i, { title: e.target.value })} maxLength={MENTOR_LIMITS.highlightTitleMax} placeholder="Sarlavha" aria-label="Karta sarlavhasi" className="field h-10 text-[13.5px]" />
                <input value={h.text} onChange={(e) => setH(i, { text: e.target.value })} maxLength={MENTOR_LIMITS.highlightTextMax} placeholder="Qisqa matn" aria-label="Karta matni" className="field h-10 text-[13.5px]" />
                <button type="button" onClick={() => setHighlights((l) => l.filter((_, j) => j !== i))} aria-label="Kartani o'chirish" className="grid h-10 w-10 place-items-center rounded-full text-fg-3 hover:bg-fg/8">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => void save()} disabled={saving} className="btn-accent inline-flex h-11 items-center gap-2 rounded-full px-6 text-[14.5px] font-semibold disabled:opacity-60">
          {saving && <Loader2 size={16} className="animate-spin" />} Saqlash
        </button>
      </section>

      {/* Bo'limlar */}
      <section className="card p-4 sm:p-5">
        <h2 className="font-display text-[16px] font-bold text-fg">
          Bo&apos;limlar <span className="font-normal text-fg-4">· {courses.length}</span>
        </h2>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addSection();
          }}
        >
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={MENTOR_LIMITS.courseTitleMax} placeholder="Yangi bo'lim nomi — masalan «Fiverr'da ishlash»" aria-label="Bo'lim nomi" className="field h-11 min-w-0 flex-1 text-[14px]" />
          <button type="submit" disabled={adding} className="btn-accent inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-5 text-[14px] font-semibold disabled:opacity-60">
            {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={16} />} Qo&apos;shish
          </button>
        </form>
        {courses.length > 0 && (
          <ul className="mt-3 divide-y divide-line">
            {courses.map((c) => (
              <li key={c.id}>
                <Link href={`/kabinet/mentorlik/${c.id}`} className="flex items-center gap-3 py-3 transition hover:opacity-80">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-fg">{c.title}</span>
                    <span className="block text-[12px] text-fg-3">
                      {categoryLabel(c.category)} · {c.lessonsCount} dars · {c.studentsCount} talaba
                    </span>
                  </span>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold", c.isPublished ? "bg-success-soft text-success-text" : "bg-fg/8 text-fg-3")}>{c.isPublished ? "Ochiq" : "Qoralama"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

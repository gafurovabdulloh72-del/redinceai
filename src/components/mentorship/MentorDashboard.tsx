"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Clock, GraduationCap, Loader2, Plus, Sparkles } from "lucide-react";
import { SafeImage } from "@/components/specialists/SafeImage";
import { useToast } from "@/components/ui/toast";
import { MENTOR_CATEGORIES, COURSE_LEVELS, MENTOR_LIMITS, categoryLabel, levelLabel, formatSom } from "@/lib/mentorship/format";
import { cn } from "@/lib/utils";

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  category: string;
  level: string;
  priceFrom: number;
  isPublished: boolean;
  lessonsCount: number;
  studentsCount: number;
  rating: number;
}
interface EnrollRow {
  progressPct: number;
  lastLessonId: string | null;
  title: string;
  slug: string;
  coverUrl: string | null;
  mentorName: string;
  lessonsCount: number;
}

type Status = "none" | "pending" | "approved";

export function MentorDashboard({ status, mentor, courses, enrollments }: { status: Status; mentor: { headline: string; bio: string; expertise: string[] } | null; courses: CourseRow[]; enrollments: EnrollRow[] }) {
  return (
    <div className="space-y-8">
      <header>
        <span className="eyebrow mb-1.5 inline-flex items-center gap-1.5">
          <GraduationCap size={13} className="text-accent" /> Mentorlik
        </span>
        <h1 className="display-xl text-fg">{status === "approved" ? "Mening kurslarim" : "Ustoz bo'ling"}</h1>
      </header>

      {status !== "approved" && <ApplyBlock status={status} mentor={mentor} />}
      {status === "approved" && <MentorCourses courses={courses} />}

      {/* O'qiyotgan kurslar */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-[16px] font-bold text-fg">
          <BookOpen size={17} className="text-fg-3" /> O&apos;qiyotgan kurslarim <span className="text-fg-4">· {enrollments.length}</span>
        </h2>
        {enrollments.length === 0 ? (
          <p className="card p-5 text-[13.5px] text-fg-3">
            Hali kursga yozilmagansiz.{" "}
            <Link href="/mentorlik" className="font-semibold text-accent-text underline underline-offset-2">
              Kurslarni ko&apos;rish
            </Link>
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {enrollments.map((e) => (
              <li key={e.slug}>
                <Link href={e.lastLessonId ? `/mentorlik/dars/${e.lastLessonId}` : `/mentorlik/${e.slug}`} className="card card-hover flex gap-3 p-3">
                  <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-[10px] bg-surface-2">
                    {e.coverUrl ? <SafeImage src={e.coverUrl} alt={e.title} width={160} height={90} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center bg-fg/5"><GraduationCap size={18} className="text-fg-4" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-fg">{e.title}</p>
                    <p className="mt-0.5 truncate text-[12px] text-fg-3">{e.mentorName}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/10">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${e.progressPct}%` }} />
                      </div>
                      <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-fg-3">{e.progressPct}%</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* --------------------------- Mentor bo'lish arizasi --------------------------- */
function ApplyBlock({ status, mentor }: { status: Status; mentor: { headline: string; bio: string; expertise: string[] } | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [headline, setHeadline] = useState(mentor?.headline ?? "");
  const [bio, setBio] = useState(mentor?.bio ?? "");
  const [expertise, setExpertise] = useState<string[]>(mentor?.expertise ?? []);
  const [busy, setBusy] = useState(false);

  const toggle = (k: string) => setExpertise((s) => (s.includes(k) ? s.filter((x) => x !== k) : s.length < MENTOR_LIMITS.expertiseMax ? [...s, k] : s));

  const submit = async () => {
    if (busy) return;
    if (headline.trim().length < 8 || bio.trim().length < 40 || expertise.length < 1) {
      toast("Unvon (8+), bio (40+) va kamida 1 yo'nalish kerak", "info");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/mentorlik/mentor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ headline: headline.trim(), bio: bio.trim(), expertise }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Yuborilmadi");
      toast("Arizangiz yuborildi — admin ko'rib chiqadi", "success");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card-elevated p-5 sm:p-6">
      {status === "pending" && (
        <div className="mb-4 flex items-center gap-2 rounded-[12px] bg-warning-soft px-4 py-2.5 text-[13px] font-semibold text-warning-text">
          <Clock size={15} /> Arizangiz ko&apos;rib chiqilmoqda. Tasdiqlangach kurs ocha olasiz.
        </div>
      )}
      <p className="flex items-center gap-1.5 text-[14px] font-semibold text-fg">
        <Sparkles size={15} className="text-accent" /> O&apos;z sohangizda ustoz bo&apos;ling
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-fg-3">Bilimingizni ulashing, kurs oching va obunachilar yig&apos;ing. Ariza yuboring — admin tasdiqlaydi.</p>

      <label className="mt-4 block">
        <span className="mb-1 block text-[12.5px] font-semibold text-fg-2">Qisqa unvon</span>
        <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={MENTOR_LIMITS.headlineMax} placeholder="10 yillik montajchi · Premiere Pro ustasi" className="field h-11 w-full text-[14px]" />
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-[12.5px] font-semibold text-fg-2">O&apos;zingiz haqingizda</span>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={MENTOR_LIMITS.bioMax} rows={4} placeholder="Tajribangiz, ishlaringiz, nima o'rgatasiz…" className="field w-full resize-y py-2.5 text-[14px] leading-relaxed" />
      </label>
      <div className="mt-3">
        <span className="mb-1.5 block text-[12.5px] font-semibold text-fg-2">Yo&apos;nalishlar (6 tagacha)</span>
        <div className="flex flex-wrap gap-2">
          {MENTOR_CATEGORIES.filter((c) => c.key !== "boshqa").map((c) => (
            <button key={c.key} type="button" onClick={() => toggle(c.key)} className={cn("inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold transition", expertise.includes(c.key) ? "btn-ink border-transparent" : "border-line text-fg-2 hover:border-fg")}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <button onClick={submit} disabled={busy} className="btn-accent mt-4 inline-flex h-11 items-center gap-2 rounded-[14px] px-5 text-[14.5px] font-semibold disabled:opacity-60">
        {busy ? <Loader2 size={16} className="animate-spin" /> : null} {status === "pending" ? "Arizani yangilash" : "Ariza yuborish"}
      </button>
    </section>
  );
}

/* --------------------------- Mentor kurslari --------------------------- */
function MentorCourses({ courses }: { courses: CourseRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("montaj");
  const [level, setLevel] = useState("boshlangich");
  const [price, setPrice] = useState("0");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (busy || title.trim().length < 5) {
      if (title.trim().length < 5) toast("Sarlavha kamida 5 belgi", "info");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/mentorlik/kurslar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), category, level, priceFrom: Number(price) || 0 }) });
      const j = (await res.json()) as { ok: boolean; error?: string; data?: { id: string } };
      if (!res.ok || !j.ok || !j.data) throw new Error(j.error || "Yaratilmadi");
      toast("Kurs yaratildi — darslar qo'shing", "success");
      router.push(`/kabinet/mentorlik/${j.data.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Xatolik", "error");
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-fg">Kurslarim <span className="text-fg-4">· {courses.length}</span></h2>
        <button onClick={() => setOpen((v) => !v)} className="btn-accent inline-flex h-10 items-center gap-1.5 rounded-[12px] px-4 text-[14px] font-semibold">
          <Plus size={16} /> Yangi kurs
        </button>
      </div>

      {open && (
        <div className="expand-in card mb-4 space-y-3 p-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={MENTOR_LIMITS.courseTitleMax} placeholder="Kurs sarlavhasi — masalan «0 dan Premiere Pro»" className="field h-11 w-full text-[14px]" autoFocus />
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-fg-3">Yo&apos;nalish</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="field h-10 w-full text-[13.5px]">
                {MENTOR_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-fg-3">Daraja</span>
              <select value={level} onChange={(e) => setLevel(e.target.value)} className="field h-10 w-full text-[13.5px]">
                {COURSE_LEVELS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-fg-3">Narx (so&apos;m, 0=bepul)</span>
              <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="field h-10 w-full text-[13.5px]" />
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={create} disabled={busy} className="btn-accent inline-flex h-10 items-center gap-2 rounded-[12px] px-4 text-[14px] font-semibold disabled:opacity-60">
              {busy ? <Loader2 size={15} className="animate-spin" /> : null} Yaratish va davom etish
            </button>
            <button onClick={() => setOpen(false)} className="inline-flex h-10 items-center rounded-[12px] px-4 text-[14px] font-semibold text-fg-2 hover:text-fg">Bekor</button>
          </div>
        </div>
      )}

      {courses.length === 0 && !open ? (
        <p className="card p-5 text-[13.5px] text-fg-3">Hali kurs yo&apos;q. «Yangi kurs» bilan boshlang.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {courses.map((c) => (
            <li key={c.id}>
              <Link href={`/kabinet/mentorlik/${c.id}`} className="card card-hover flex gap-3 p-3">
                <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-[10px] bg-surface-2">
                  {c.coverUrl ? <SafeImage src={c.coverUrl} alt={c.title} width={160} height={90} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center bg-fg/5"><GraduationCap size={18} className="text-fg-4" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", c.isPublished ? "bg-success-soft text-success-text" : "bg-fg/8 text-fg-3")}>{c.isPublished ? "Chop etilgan" : "Qoralama"}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug text-fg">{c.title}</p>
                  <p className="mt-1 text-[12px] text-fg-4">{categoryLabel(c.category)} · {levelLabel(c.level)} · {c.lessonsCount} dars · {c.studentsCount} talaba · {formatSom(c.priceFrom)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

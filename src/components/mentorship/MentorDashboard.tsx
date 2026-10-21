"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Clock, GraduationCap, Loader2, Sparkles } from "lucide-react";
import { SafeImage } from "@/components/specialists/SafeImage";
import { useToast } from "@/components/ui/toast";
import { MENTOR_CATEGORIES, MENTOR_LIMITS } from "@/lib/mentorship/format";
import { cn } from "@/lib/utils";

interface EnrollRow {
  progressPct: number;
  lastLessonId: string | null;
  title: string;
  slug: string;
  coverUrl: string | null;
  mentorName: string;
  lessonsCount: number;
}

export type MentorStatus = "none" | "pending";

/** Men o'qiyotgan kurslar — ixcham ro'yxat (yozilmagan bo'lsa ko'rsatilmaydi) */
export function MyEnrollments({ enrollments }: { enrollments: EnrollRow[] }) {
  if (enrollments.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-fg">
        <BookOpen size={16} className="text-fg-3" /> O&apos;qiyotgan kurslarim <span className="font-normal text-fg-4">· {enrollments.length}</span>
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {enrollments.map((e) => (
          <li key={e.slug}>
            <Link href={e.lastLessonId ? `/mentorlik/dars/${e.lastLessonId}` : `/mentorlik/${e.slug}`} className="card card-hover flex gap-3 p-3">
              <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-[10px] bg-surface-2">
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
    </section>
  );
}

/* --------------------------- Mentor bo'lish arizasi --------------------------- */
export function ApplyBlock({ status, mentor }: { status: MentorStatus; mentor: { headline: string; bio: string; expertise: string[] } | null }) {
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
    <section className="card p-5 sm:p-6">
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

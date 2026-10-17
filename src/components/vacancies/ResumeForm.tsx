"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui";
import { Switch } from "@/components/specialists/Filters";
import { REGIONS } from "@/lib/constants";
import { PROFESSIONS, REMOTE_REGION, RESUME_EXPERIENCE, RESUME_FORMAT, RESUME_LINKS_MAX, RESUME_SKILLS_MAX, RESUME_SUMMARY_MAX, type Experience } from "@/lib/vacancies/format";
import { SkillsInput } from "./SkillsInput";

export interface ResumeFormInitial {
  id: string;
  title: string;
  profession: string;
  summary: string;
  skills: string[];
  experience: Experience;
  expectedSalary: number | null;
  format: "any" | "remote" | "hybrid" | "office";
  regionSlug: string | null;
  links: Array<{ label: string; url: string }>;
  isPublic: boolean;
}

const LABEL = "text-[12px] font-bold uppercase tracking-[0.12em] text-fg-3";
const fmtMoney = (n: number | null) => (n ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "");
const LINK_PRESETS = ["Portfolio", "LinkedIn", "GitHub", "Behance", "Telegram kanal", "YouTube"];

/** Rezyume formasi — bitta rezyume, ommaviy/yopiq. Kontakt saqlanmaydi: aloqa chat orqali yoki ariza bilan. */
export function ResumeForm({ initial }: { initial: ResumeFormInitial | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [profession, setProfession] = useState(initial?.profession ?? "");
  const [experience, setExperience] = useState<Experience>(initial?.experience ?? "none");
  const [format, setFormat] = useState<ResumeFormInitial["format"]>(initial?.format ?? "any");
  const [regionSlug, setRegionSlug] = useState(initial?.regionSlug ?? REMOTE_REGION);
  const [expectedSalary, setExpectedSalary] = useState(fmtMoney(initial?.expectedSalary ?? null));
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [skills, setSkills] = useState<string[]>(initial?.skills ?? []);
  const [links, setLinks] = useState<Array<{ label: string; url: string }>>(initial?.links ?? []);
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const valid = title.trim().length >= 3 && profession !== "";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    setErrors({});
    setDone(null);
    try {
      const body = { title: title.trim(), profession, experience, format, regionSlug: format === "remote" ? REMOTE_REGION : regionSlug, expectedSalary: expectedSalary.replace(/\D/g, ""), summary: summary.trim(), skills, links: links.filter((l) => l.label.trim() && l.url.trim()), isPublic };
      const res = await fetch("/api/rezyume", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await res.json()) as { ok: boolean; data?: { id: string }; error?: string; fields?: Record<string, string> };
      if (!res.ok || !j.ok) {
        if (j.fields) setErrors(j.fields);
        throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Saqlab bo'lmadi");
      }
      setDone(isPublic ? "Saqlandi — rezyume katalogda ko'rinadi" : "Saqlandi — rezyume faqat arizalaringizga biriktiriladi");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlab bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch("/api/rezyume", { method: "DELETE" });
      if (res.ok) {
        router.push("/kabinet");
        router.refresh();
        return;
      }
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="card grid gap-5 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 sm:col-span-2">
          <span className={LABEL}>Izlayotgan lavozim</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Masalan: Motion dizayner / SMM menejer / Frontend dasturchi" className="field h-11 w-full text-[14px]" />
          {errors.title && <span className="text-[11.5px] text-danger-text">{errors.title}</span>}
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Kasb / soha</span>
          <select value={profession} onChange={(e) => setProfession(e.target.value)} className="field h-11 w-full text-[14px]">
            <option value="">Tanlang…</option>
            {PROFESSIONS.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
          {errors.profession && <span className="text-[11.5px] text-danger-text">{errors.profession}</span>}
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Tajriba</span>
          <select value={experience} onChange={(e) => setExperience(e.target.value as Experience)} className="field h-11 w-full text-[14px]">
            {(Object.keys(RESUME_EXPERIENCE) as Experience[]).map((k) => (
              <option key={k} value={k}>
                {RESUME_EXPERIENCE[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Ish formati</span>
          <select value={format} onChange={(e) => setFormat(e.target.value as ResumeFormInitial["format"])} className="field h-11 w-full text-[14px]">
            {(Object.keys(RESUME_FORMAT) as Array<keyof typeof RESUME_FORMAT>).map((k) => (
              <option key={k} value={k}>
                {RESUME_FORMAT[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Hudud</span>
          <select value={format === "remote" ? REMOTE_REGION : regionSlug} onChange={(e) => setRegionSlug(e.target.value)} disabled={format === "remote"} className="field h-11 w-full text-[14px] disabled:opacity-60">
            <option value={REMOTE_REGION}>Istalgan hudud</option>
            {REGIONS.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 sm:col-span-2">
          <span className={LABEL}>Kutilayotgan maosh (so&apos;m / oy) — ixtiyoriy</span>
          <input inputMode="numeric" value={expectedSalary} onChange={(e) => setExpectedSalary(fmtMoney(Number(e.target.value.replace(/\D/g, "")) || null))} placeholder="Masalan: 5 000 000" className="field h-11 w-full text-[14px] sm:w-64" />
        </label>
      </div>

      <label className="grid gap-1.5">
        <span className={LABEL}>O&apos;zingiz haqingizda</span>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={RESUME_SUMMARY_MAX} rows={6} placeholder="Tajriba, loyihalar, natijalar, qaysi vositalarda ishlaysiz, qachondan boshlay olasiz…" className="field w-full resize-y py-2.5 text-[14px] leading-relaxed" />
        <span className="text-right text-[11.5px] text-fg-4">
          {summary.length}/{RESUME_SUMMARY_MAX}
        </span>
      </label>

      <div className="grid gap-1.5">
        <label htmlFor="r-skills" className={LABEL}>
          Ko&apos;nikmalar
        </label>
        <SkillsInput id="r-skills" value={skills} onChange={setSkills} max={RESUME_SKILLS_MAX} />
      </div>

      <div className="grid gap-2">
        <span className={LABEL}>Havolalar — portfolio, LinkedIn, GitHub…</span>
        {links.map((l, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,140px)_1fr_auto] gap-2">
            <input list="link-presets" value={l.label} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} maxLength={30} placeholder="Nomi" className="field h-10 w-full text-[13.5px]" />
            <input type="url" value={l.url} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://…" dir="ltr" className="field h-10 w-full text-[13.5px]" />
            <button type="button" aria-label="Havolani olib tashlash" onClick={() => setLinks(links.filter((_, j) => j !== i))} className="flex h-10 w-10 items-center justify-center rounded-full text-fg-3 hover:bg-fg/6 hover:text-fg">
              <X size={15} />
            </button>
          </div>
        ))}
        <datalist id="link-presets">
          {LINK_PRESETS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        {links.length < RESUME_LINKS_MAX && (
          <button type="button" onClick={() => setLinks([...links, { label: "", url: "" }])} className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[13px] font-semibold text-fg-2 hover:text-fg">
            <Plus size={14} /> Havola qo&apos;shish
          </button>
        )}
        {errors.links && <span className="text-[11.5px] text-danger-text">{errors.links}</span>}
      </div>

      <div className="flex items-start justify-between gap-4 rounded-[16px] border border-line px-4 py-3">
        <div>
          <p className="text-[14px] font-semibold text-fg">Katalogda ko&apos;rinsin</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-3">Ish beruvchilar /rezyumelar bo&apos;limida topadi va chat orqali yozadi. O&apos;chirilsa — rezyume faqat arizalaringizga biriktiriladi. Kontakt (email/telefon) hech qayerda ochiq ko&apos;rsatilmaydi.</p>
        </div>
        <Switch checked={isPublic} onChange={setIsPublic} label="Katalogda ko'rinsin" />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button type="submit" variant="primary" size="md" disabled={!valid || busy}>
          {busy ? "Saqlanmoqda…" : initial ? "Saqlash" : "Rezyumeni yaratish"}
        </Button>
        {done && <span className="text-[13px] font-semibold text-success-text">{done}</span>}
        {error && <span className="text-[13px] font-semibold text-danger-text">{error}</span>}
        {initial && (
          <div className="ml-auto flex items-center gap-2">
            {confirmDelete ? (
              <>
                <span className="text-[12.5px] text-fg-2">Rezyume o&apos;chadi. Aniqmi?</span>
                <Button type="button" variant="danger" size="sm" onClick={remove} disabled={busy}>
                  Ha
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  Yo&apos;q
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" size="sm" className="text-danger-text hover:text-danger-text" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} /> O&apos;chirish
              </Button>
            )}
          </div>
        )}
      </div>
    </form>
  );
}

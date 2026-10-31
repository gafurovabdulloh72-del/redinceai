"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Switch } from "@/components/specialists/Filters";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { VAK_RESUME as T } from "@/lib/i18n/dict/vacancies-forms";
import { professionLabelTr, resumeExperienceTr, resumeFormatTr } from "@/lib/i18n/dict/vacancies";
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

/** Rezyume formasi — bitta rezyume, ommaviy/yopiq. Kontakt saqlanmaydi: aloqa chat orqali yoki ariza bilan. */
export function ResumeForm({ initial }: { initial: ResumeFormInitial | null }) {
  const router = useRouter();
  const til = useLocale();
  const { toast } = useToast();
  /* Havola nomi uchun tayyor variantlar — brend nomlari o'zgarmaydi, qolganlari tilga mos */
  const linkPresets = [tr(til, T.presetPortfolio), "LinkedIn", "GitHub", "Behance", tr(til, T.presetTelegram), "YouTube"];
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

  // To'liqlik o'lchagichi: ish beruvchi ko'radigan asosiy maydonlar (har biri — ball)
  const checks: Array<[string, boolean]> = [
    [tr(til, T.checkPosition), title.trim().length >= 3],
    [tr(til, T.checkProfession), profession !== ""],
    [tr(til, T.checkAbout), summary.trim().length >= 80],
    [tr(til, T.checkSkills), skills.length >= 3],
    [tr(til, T.checkLink), links.some((l) => l.url.trim().startsWith("https://"))],
    [tr(til, T.checkSalary), expectedSalary.replace(/\D/g, "").length > 0],
    [tr(til, T.checkLevel), experience !== "none" || summary.trim().length >= 80],
  ];
  const score = Math.round((checks.filter(([, ok]) => ok).length / checks.length) * 100);

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
        throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || tr(til, T.saveFailed));
      }
      setDone(isPublic ? tr(til, T.savedPublic) : tr(til, T.savedPrivate));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr(til, T.saveFailed));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rezyume", { method: "DELETE" });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || tr(til, T.deleteFailed));
      router.push("/kabinet");
      router.refresh();
      return;
    } catch (e) {
      setError(e instanceof Error ? e.message : tr(til, T.deleteFailed));
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  /** Katalogda yuqoriga: updatedAt yangilanadi (24 soatda bir marta) */
  async function bump() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/rezyume", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "bump" }) });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || tr(til, T.failed));
      toast(tr(til, T.bumped), "success");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : tr(til, T.failed), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="card grid gap-5 p-5 sm:p-6">
      {/* To'liqlik */}
      <div className="rounded-[16px] border border-line px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-fg">{tr(til, T.completeness)}</p>
          <p className={`text-[13px] font-bold tabular-nums ${score >= 80 ? "text-success-text" : score >= 50 ? "text-warning-text" : "text-fg-3"}`}>{score}%</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-fg/8" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-label={tr(til, T.completeness)}>
          <div className={`h-full rounded-full transition-[width] duration-500 ease-out ${score >= 80 ? "bg-success" : score >= 50 ? "bg-warning" : "bg-accent"}`} style={{ width: `${score}%` }} />
        </div>
        {score < 100 && <p className="mt-2 text-[12px] text-fg-3">{tr(til, T.addPre)}{checks.filter(([, ok]) => !ok).map(([n]) => n).slice(0, 3).join(" · ")}</p>}
        {score === 100 && <p className="mt-2 text-[12px] text-success-text">{tr(til, T.perfect)}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 sm:col-span-2">
          <span className={LABEL}>{tr(til, T.titleLabel)}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder={tr(til, T.titlePh)} className="field h-11 w-full text-[14px]" />
          {errors.title && <span className="text-[11.5px] text-danger-text">{errors.title}</span>}
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>{tr(til, T.profession)}</span>
          <select value={profession} onChange={(e) => setProfession(e.target.value)} className="field h-11 w-full text-[14px]">
            <option value="">{tr(til, T.choose)}</option>
            {PROFESSIONS.map((p) => (
              <option key={p.slug} value={p.slug}>
                {professionLabelTr(til, p.slug)}
              </option>
            ))}
          </select>
          {errors.profession && <span className="text-[11.5px] text-danger-text">{errors.profession}</span>}
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>{tr(til, T.experience)}</span>
          <select value={experience} onChange={(e) => setExperience(e.target.value as Experience)} className="field h-11 w-full text-[14px]">
            {(Object.keys(RESUME_EXPERIENCE) as Experience[]).map((k) => (
              <option key={k} value={k}>
                {resumeExperienceTr(til, k)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>{tr(til, T.format)}</span>
          <select value={format} onChange={(e) => setFormat(e.target.value as ResumeFormInitial["format"])} className="field h-11 w-full text-[14px]">
            {(Object.keys(RESUME_FORMAT) as Array<keyof typeof RESUME_FORMAT>).map((k) => (
              <option key={k} value={k}>
                {resumeFormatTr(til, k)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>{tr(til, T.region)}</span>
          <select value={format === "remote" ? REMOTE_REGION : regionSlug} onChange={(e) => setRegionSlug(e.target.value)} disabled={format === "remote"} className="field h-11 w-full text-[14px] disabled:opacity-60">
            <option value={REMOTE_REGION}>{tr(til, T.anyRegion)}</option>
            {REGIONS.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 sm:col-span-2">
          <span className={LABEL}>{tr(til, T.expectedSalary)}</span>
          <input inputMode="numeric" value={expectedSalary} onChange={(e) => setExpectedSalary(fmtMoney(Number(e.target.value.replace(/\D/g, "")) || null))} placeholder={tr(til, T.expectedSalaryPh)} className="field h-11 w-full text-[14px] sm:w-64" />
        </label>
      </div>

      <label className="grid gap-1.5">
        <span className={LABEL}>{tr(til, T.about)}</span>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={RESUME_SUMMARY_MAX} rows={6} placeholder={tr(til, T.aboutPh)} className="field w-full resize-y py-2.5 text-[14px] leading-relaxed" />
        <span className="text-right text-[11.5px] text-fg-4">
          {summary.length}/{RESUME_SUMMARY_MAX}
        </span>
      </label>

      <div className="grid gap-1.5">
        <label htmlFor="r-skills" className={LABEL}>
          {tr(til, T.skills)}
        </label>
        <SkillsInput id="r-skills" value={skills} onChange={setSkills} max={RESUME_SKILLS_MAX} />
      </div>

      <div className="grid gap-2">
        <span className={LABEL}>{tr(til, T.links)}</span>
        {links.map((l, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,140px)_1fr_auto] gap-2">
            <input list="link-presets" value={l.label} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} maxLength={30} placeholder={tr(til, T.linkNamePh)} className="field h-10 w-full text-[13.5px]" />
            <input type="url" value={l.url} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://…" dir="ltr" className="field h-10 w-full text-[13.5px]" />
            <button type="button" aria-label={tr(til, T.removeLink)} onClick={() => setLinks(links.filter((_, j) => j !== i))} className="flex h-10 w-10 items-center justify-center rounded-full text-fg-3 hover:bg-fg/6 hover:text-fg">
              <X size={15} />
            </button>
          </div>
        ))}
        <datalist id="link-presets">
          {linkPresets.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        {links.length < RESUME_LINKS_MAX && (
          <button type="button" onClick={() => setLinks([...links, { label: "", url: "" }])} className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[13px] font-semibold text-fg-2 hover:text-fg">
            <Plus size={14} /> {tr(til, T.addLink)}
          </button>
        )}
        {errors.links && <span className="text-[11.5px] text-danger-text">{errors.links}</span>}
      </div>

      <div className="flex items-start justify-between gap-4 rounded-[16px] border border-line px-4 py-3">
        <div>
          <p className="text-[14px] font-semibold text-fg">{tr(til, T.publicTitle)}</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-3">{tr(til, T.publicDesc)}</p>
        </div>
        <Switch checked={isPublic} onChange={setIsPublic} label={tr(til, T.publicTitle)} />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button type="submit" variant="primary" size="md" disabled={!valid || busy}>
          {busy ? tr(til, T.saving) : initial ? tr(til, T.save) : tr(til, T.create)}
        </Button>
        {done && <span className="text-[13px] font-semibold text-success-text">{done}</span>}
        {error && <span className="text-[13px] font-semibold text-danger-text">{error}</span>}
        {initial && initial.isPublic && (
          <Button type="button" variant="outline" size="md" onClick={bump} disabled={busy} title={tr(til, T.bumpTitle)}>
            <ArrowUp size={14} /> {tr(til, T.bump)}
          </Button>
        )}
        {initial && (
          <div className="ml-auto flex items-center gap-2">
            {confirmDelete ? (
              <span className="expand-in inline-flex items-center gap-2" role="group" aria-label={tr(til, T.confirmDeleteAria)}>
                <span className="text-[12.5px] text-fg-2">{tr(til, T.deleteWarn)}</span>
                <Button type="button" variant="danger" size="sm" onClick={remove} disabled={busy}>
                  {tr(til, T.yes)}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  {tr(til, T.no)}
                </Button>
              </span>
            ) : (
              <Button type="button" variant="ghost" size="sm" className="text-danger-text hover:text-danger-text" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} /> {tr(til, T.delete)}
              </Button>
            )}
          </div>
        )}
      </div>
    </form>
  );
}

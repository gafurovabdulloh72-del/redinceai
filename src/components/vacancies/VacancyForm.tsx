"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { VAK_FORM as T } from "@/lib/i18n/dict/vacancies-forms";
import { employmentTr, experienceTr, professionLabelTr, workFormatTr } from "@/lib/i18n/dict/vacancies";
import { REGIONS } from "@/lib/constants";
import { EMPLOYMENT, EXPERIENCE, PROFESSIONS, REMOTE_REGION, VACANCY_DESC_MAX, VACANCY_DESC_MIN, VACANCY_REQ_MAX, VACANCY_SKILLS_MAX, VACANCY_TITLE_MAX, VACANCY_TITLE_MIN, WORK_FORMAT, type Employment, type Experience, type WorkFormat } from "@/lib/vacancies/format";
import { SkillsInput } from "./SkillsInput";

export interface VacancyFormInitial {
  id: string;
  title: string;
  company: string;
  profession: string;
  description: string;
  requirements: string;
  format: WorkFormat;
  employment: Employment;
  experience: Experience;
  salaryMin: number | null;
  salaryMax: number | null;
  regionSlug: string | null;
  skills: string[];
  applyUrl: string | null;
  status: "open" | "closed";
  expired: boolean;
}

type ApiResp = { ok: boolean; data?: { id?: string }; error?: string; fields?: Record<string, string> };
const LABEL = "text-[12px] font-bold uppercase tracking-[0.12em] text-fg-3";
const fmtMoney = (n: number | null) => (n ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "");

/**
 * Vakansiya formasi (yaratish / tahrirlash). Tahrirda: yopish / qayta ochib uzaytirish / o'chirish. To'lovsiz.
 * `mode="create"` + `initial` — nusxa olish (/vakansiyalar/yangi?nusxa=<id>): maydonlar to'ldirilgan, yangi e'lon yaratiladi.
 */
export function VacancyForm({ mode, initial }: { mode: "create" | "edit"; initial?: VacancyFormInitial }) {
  const router = useRouter();
  const til = useLocale();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [profession, setProfession] = useState(initial?.profession ?? "");
  const [format, setFormat] = useState<WorkFormat>(initial?.format ?? "remote");
  const [employment, setEmployment] = useState<Employment>(initial?.employment ?? "full");
  const [experience, setExperience] = useState<Experience>(initial?.experience ?? "none");
  const [salaryMin, setSalaryMin] = useState(fmtMoney(initial?.salaryMin ?? null));
  const [salaryMax, setSalaryMax] = useState(fmtMoney(initial?.salaryMax ?? null));
  const [regionSlug, setRegionSlug] = useState(initial?.regionSlug ?? REMOTE_REGION);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [requirements, setRequirements] = useState(initial?.requirements ?? "");
  const [skills, setSkills] = useState<string[]>(initial?.skills ?? []);
  const [applyUrl, setApplyUrl] = useState(initial?.applyUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const valid = title.trim().length >= VACANCY_TITLE_MIN && profession !== "" && description.trim().length >= VACANCY_DESC_MIN;

  function payload() {
    return {
      title: title.trim(),
      company: company.trim(),
      profession,
      description: description.trim(),
      requirements: requirements.trim(),
      format,
      employment,
      experience,
      salaryMin: salaryMin.replace(/\D/g, ""),
      salaryMax: salaryMax.replace(/\D/g, ""),
      regionSlug: format === "remote" ? REMOTE_REGION : regionSlug,
      skills,
      applyUrl: applyUrl.trim(),
    };
  }

  async function send(body: Record<string, unknown>, method: "POST" | "PATCH" | "DELETE", after: (j: ApiResp) => void) {
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const res = await fetch(mode === "create" ? "/api/vakansiyalar" : `/api/vakansiyalar/${encodeURIComponent(initial?.id ?? "")}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "DELETE" ? undefined : JSON.stringify(body),
      });
      const j = (await res.json()) as ApiResp;
      if (!res.ok || !j.ok) {
        if (j.fields) setErrors(j.fields);
        throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || tr(til, T.saveFailed));
      }
      after(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr(til, T.saveFailed));
      setBusy(false);
    }
  }

  const goTo = (id: string) => {
    router.push(`/vakansiyalar/${id}`);
    router.refresh();
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid || busy) return;
        void send(payload(), mode === "create" ? "POST" : "PATCH", (j) => goTo(j.data?.id ?? initial?.id ?? ""));
      }}
      className="card grid gap-5 p-5 sm:p-6"
    >
      <label className="grid gap-1.5">
        <span className={LABEL}>{tr(til, T.position)}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={VACANCY_TITLE_MAX} placeholder={tr(til, T.positionPh)} className="field h-11 w-full text-[14px]" autoFocus={mode === "create" && !initial} />
        <span className="flex justify-between text-[11.5px] text-fg-4">
          <span className="text-danger-text">{errors.title}</span>
          <span>
            {title.trim().length}/{VACANCY_TITLE_MAX}
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className={LABEL}>{tr(til, T.company)}</span>
          <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={80} placeholder={tr(til, T.companyPh)} className="field h-11 w-full text-[14px]" />
          {errors.company && <span className="text-[11.5px] text-danger-text">{errors.company}</span>}
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
      </div>

      <div className="grid gap-1.5">
        <span className={LABEL}>{tr(til, T.format)}</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={tr(til, T.format)}>
          {(Object.keys(WORK_FORMAT) as WorkFormat[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={format === k}
              onClick={() => setFormat(k)}
              className={`press inline-flex h-10 items-center rounded-full border px-4 text-[13px] font-semibold transition ${format === k ? "border-transparent bg-ink text-ink-fg" : "border-line-2 text-fg-2 hover:border-fg hover:text-fg"}`}
            >
              {workFormatTr(til, k)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-1.5">
          <span className={LABEL}>{tr(til, T.employment)}</span>
          <select value={employment} onChange={(e) => setEmployment(e.target.value as Employment)} className="field h-11 w-full text-[14px]">
            {(Object.keys(EMPLOYMENT) as Employment[]).map((k) => (
              <option key={k} value={k}>
                {employmentTr(til, k)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>{tr(til, T.experience)}</span>
          <select value={experience} onChange={(e) => setExperience(e.target.value as Experience)} className="field h-11 w-full text-[14px]">
            {(Object.keys(EXPERIENCE) as Experience[]).map((k) => (
              <option key={k} value={k}>
                {experienceTr(til, k)}
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
      </div>

      <div className="grid gap-1.5">
        <span className={LABEL}>{tr(til, T.salary)}</span>
        <div className="grid grid-cols-2 gap-3">
          <input inputMode="numeric" value={salaryMin} onChange={(e) => setSalaryMin(fmtMoney(Number(e.target.value.replace(/\D/g, "")) || null))} placeholder={tr(til, T.salaryFromPh)} className="field h-11 w-full text-[14px]" aria-label={tr(til, T.salaryFromAria)} />
          <input inputMode="numeric" value={salaryMax} onChange={(e) => setSalaryMax(fmtMoney(Number(e.target.value.replace(/\D/g, "")) || null))} placeholder={tr(til, T.salaryToPh)} className="field h-11 w-full text-[14px]" aria-label={tr(til, T.salaryToAria)} />
        </div>
        {(errors.salaryMin || errors.salaryMax) && <span className="text-[11.5px] text-danger-text">{errors.salaryMin || errors.salaryMax}</span>}
        {!salaryMin && !salaryMax && <span className="text-[12px] text-fg-4">{tr(til, T.salaryHint)}</span>}
      </div>

      <label className="grid gap-1.5">
        <span className={LABEL}>{tr(til, T.description)}</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={VACANCY_DESC_MAX} rows={7} placeholder={tr(til, T.descriptionPh)} className="field w-full resize-y py-2.5 text-[14px] leading-relaxed" />
        <span className="flex justify-between text-[11.5px] text-fg-4">
          <span className="text-danger-text">{errors.description}</span>
          <span>
            {description.length}/{VACANCY_DESC_MAX}
          </span>
        </span>
      </label>

      <label className="grid gap-1.5">
        <span className={LABEL}>{tr(til, T.requirements)}</span>
        <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} maxLength={VACANCY_REQ_MAX} rows={4} placeholder={tr(til, T.requirementsPh)} className="field w-full resize-y py-2.5 text-[14px] leading-relaxed" />
      </label>

      <div className="grid gap-1.5">
        <label htmlFor="v-skills" className={LABEL}>
          {tr(til, T.skills)}
        </label>
        <SkillsInput id="v-skills" value={skills} onChange={setSkills} max={VACANCY_SKILLS_MAX} />
        {errors.skills && <span className="text-[11.5px] text-danger-text">{errors.skills}</span>}
      </div>

      <label className="grid gap-1.5">
        <span className={LABEL}>{tr(til, T.applyUrl)}</span>
        <input type="url" value={applyUrl} onChange={(e) => setApplyUrl(e.target.value)} placeholder={tr(til, T.applyUrlPh)} dir="ltr" className="field h-11 w-full text-[14px]" />
        {errors.applyUrl && <span className="text-[11.5px] text-danger-text">{errors.applyUrl}</span>}
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button type="submit" variant="primary" size="md" disabled={!valid || busy}>
          {busy ? tr(til, T.saving) : mode === "create" ? (initial ? tr(til, T.postCopy) : tr(til, T.post)) : tr(til, T.save)}
        </Button>
        <Button type="button" variant="outline" size="md" onClick={() => router.back()} disabled={busy}>
          {tr(til, T.cancel)}
        </Button>
        {mode === "edit" && initial && (
          <>
            {initial.status === "open" && !initial.expired ? (
              <Button type="button" variant="ghost" size="md" disabled={busy} onClick={() => void send({ status: "closed" }, "PATCH", () => goTo(initial.id))}>
                {tr(til, T.close)}
              </Button>
            ) : (
              <Button type="button" variant="accent" size="md" disabled={busy} onClick={() => void send({ extend: true }, "PATCH", () => goTo(initial.id))}>
                {tr(til, T.reopen)}
              </Button>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {confirmDelete ? (
                <span className="expand-in inline-flex flex-wrap items-center gap-2" role="group" aria-label={tr(til, T.confirmDeleteAria)}>
                  <span className="text-[12.5px] text-fg-2">{tr(til, T.deleteWarn)}</span>
                  <Button type="button" variant="danger" size="sm" disabled={busy} onClick={() => void send({}, "DELETE", () => { router.push("/kabinet/vakansiyalar"); router.refresh(); })}>
                    {tr(til, T.yesDelete)}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                    {tr(til, T.cancel)}
                  </Button>
                </span>
              ) : (
                <Button type="button" variant="ghost" size="sm" className="text-danger-text hover:text-danger-text" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={14} /> {tr(til, T.delete)}
                </Button>
              )}
            </div>
          </>
        )}
        {error && <span className="basis-full text-[13px] font-semibold text-danger-text">{error}</span>}
      </div>
      {mode === "create" && <p className="text-[12.5px] leading-relaxed text-fg-3">{tr(til, T.createNote)}</p>}
    </form>
  );
}

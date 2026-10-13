"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AlertCircle, Check, Eye, MapPin, PencilLine, Plus, Send, Wifi, X } from "lucide-react";
import { Spinner } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { JobCard } from "./JobCard";
import { CATEGORIES, REGIONS } from "@/lib/constants";
import { BUDGET_TYPE_LABEL, budgetLabel, JOB_DESC_MAX, JOB_DESC_MIN, JOB_SKILLS_MAX, JOB_TITLE_MAX, JOB_TITLE_MIN, jobRegionLabel, REMOTE_REGION } from "@/lib/jobs/format";
import { cn } from "@/lib/utils";

export interface JobFormInitial {
  id: string;
  title: string;
  description: string;
  category: string;
  regionSlug: string | null;
  budgetType: "fixed" | "hourly";
  budgetMin: number | null;
  budgetMax: number | null;
  deadline: string | null;
  skills: string[];
}

/** Yangi e'lon uchun oldindan to'ldirish (buyurtma sehrgari / «obuna faol emas» havolasi) — forma yaratish rejimida qoladi */
export interface JobFormPrefill {
  category?: string;
  regionSlug?: string | null;
  remote?: boolean;
  budgetMax?: number | null;
  deadline?: string | null;
}

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

const DEADLINE_HINTS = ["1 hafta ichida", "2 hafta ichida", "1 oy ichida", "Shoshilinch", "Doimiy ish"];
const FIELD_ORDER = ["title", "description", "category", "regionSlug", "budgetMin", "budgetMax", "deadline", "skills"] as const;

/** Yo'nalish bo'yicha tez qo'shiladigan ko'nikmalar */
const SKILL_HINTS: Record<string, string[]> = {
  videograf: ["To'y", "Reklama", "Cinematic", "Dron", "Event"],
  montajor: ["Premiere Pro", "DaVinci Resolve", "Reels/TikTok", "Rang korreksiya", "Subtitr"],
  dizayner: ["Logo", "Brending", "SMM dizayn", "Adobe Illustrator", "Figma"],
  "motion-dizayner": ["After Effects", "2D animatsiya", "3D animatsiya", "Infografika", "Intro"],
  fotograf: ["Portret", "Mahsulot", "To'y", "Studiya", "Retush"],
  "3d-artist": ["Blender", "3ds Max", "Render", "Eksteryer", "Interyer"],
  "ui-ux": ["Figma", "Mobil UI", "Veb-sayt", "Prototip", "UX tadqiqot"],
  ovoz: ["Diktor", "Dublyaj", "Mastering", "Ovoz yozish", "Musiqa"],
};

const num = (v: string) => {
  const d = v.replace(/\D/g, "");
  return d ? Number(d) : null;
};

/**
 * E'lon formasi (yaratish / tahrirlash) + jonli ko'rinish (preview). Yuborish: POST /api/jobs yoki PATCH /api/jobs/[id].
 * Xatolar server javobidan maydonlar bo'yicha ko'rsatiladi, birinchi noto'g'ri maydonga fokus.
 */
export function JobForm({ initial, prefill, clientFirstName, emailVerified }: { initial?: JobFormInitial; prefill?: JobFormPrefill; clientFirstName: string; emailVerified: boolean }) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? prefill?.category ?? "");
  const [remote, setRemote] = useState(initial ? !initial.regionSlug : Boolean(prefill?.remote));
  const [region, setRegion] = useState(initial?.regionSlug ?? prefill?.regionSlug ?? "");
  const [budgetType, setBudgetType] = useState<"fixed" | "hourly">(initial?.budgetType ?? "fixed");
  const [budgetMin, setBudgetMin] = useState(initial?.budgetMin ? String(initial.budgetMin) : "");
  const [budgetMax, setBudgetMax] = useState(initial ? (initial.budgetMax ? String(initial.budgetMax) : "") : prefill?.budgetMax ? String(prefill.budgetMax) : "");
  const [deadline, setDeadline] = useState(initial?.deadline ?? prefill?.deadline ?? "");
  const [skills, setSkills] = useState<string[]>(initial?.skills ?? []);
  const [skillDraft, setSkillDraft] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refs = useRef<Partial<Record<(typeof FIELD_ORDER)[number], HTMLElement | null>>>({});
  const setRef = (k: (typeof FIELD_ORDER)[number]) => (el: HTMLElement | null) => {
    refs.current[k] = el;
  };

  const min = num(budgetMin);
  const max = num(budgetMax);
  const budgetText = budgetLabel(min, max, budgetType);
  const regionSlug = remote ? null : region || null;

  const preview = useMemo(
    () => ({
      id: initial?.id ?? "preview",
      title: title.trim() || "E'lon sarlavhasi",
      excerpt: description.replace(/\s+/g, " ").trim().slice(0, 220) || "Loyiha tavsifi shu yerda ko'rinadi.",
      category: category || CATEGORIES[0].slug,
      regionSlug,
      budgetMin: min,
      budgetMax: max,
      budgetType,
      skills,
      proposalsCount: 0,
      createdAt: new Date(),
      client: { firstName: clientFirstName, emailVerified },
    }),
    [initial?.id, title, description, category, regionSlug, min, max, budgetType, skills, clientFirstName, emailVerified],
  );

  const addSkill = (raw: string) => {
    const s = raw.trim().replace(/,+$/, "").slice(0, 40);
    if (!s) return;
    setSkills((cur) => (cur.length >= JOB_SKILLS_MAX || cur.some((x) => x.toLowerCase() === s.toLowerCase()) ? cur : [...cur, s]));
    setSkillDraft("");
  };
  const onSkillKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill(skillDraft);
    } else if (e.key === "Backspace" && !skillDraft && skills.length) {
      setSkills((cur) => cur.slice(0, -1));
    }
  };

  /** Klient tomonida tez tekshiruv (server baribir tekshiradi) */
  const localErrors = (): Record<string, string> => {
    const out: Record<string, string> = {};
    if (title.trim().length < JOB_TITLE_MIN) out.title = `Sarlavha kamida ${JOB_TITLE_MIN} ta belgi`;
    if (description.trim().length < JOB_DESC_MIN) out.description = `Tavsif kamida ${JOB_DESC_MIN} ta belgi — vazifani batafsilroq yozing`;
    if (!category) out.category = "Yo'nalishni tanlang";
    if (!remote && !region) out.regionSlug = "Hududni tanlang yoki «Masofaviy»ni belgilang";
    if (min && max && max < min) out.budgetMax = "Maksimal summa minimaldan kam bo'lmasin";
    return out;
  };

  const focusFirst = (fields: Record<string, string>) => {
    const key = FIELD_ORDER.find((k) => fields[k]);
    const el = key ? refs.current[key] : null;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setError(null);
    const local = localErrors();
    if (Object.keys(local).length) {
      setErrors(local);
      setMode("edit");
      window.setTimeout(() => focusFirst(local), 0);
      return;
    }
    setErrors({});
    setBusy(true);
    const body = {
      title,
      description,
      category,
      regionSlug: remote ? REMOTE_REGION : region,
      budgetType,
      budgetMin: min,
      budgetMax: max,
      deadline: deadline.trim(),
      skills: skillDraft.trim() ? [...skills, skillDraft.trim()].slice(0, JOB_SKILLS_MAX) : skills,
    };
    try {
      const res = await fetch(editing ? `/api/jobs/${initial!.id}` : "/api/jobs", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { action: "edit", ...body } : body),
      });
      const json = (await res.json()) as ApiResponse<{ id: string }>;
      if (!json.ok) {
        setError(json.error);
        if (json.fields) {
          setErrors(json.fields);
          setMode("edit");
          window.setTimeout(() => focusFirst(json.fields!), 0);
        }
        return;
      }
      router.push(`/ishlar/${json.data.id}${editing ? "" : "?yangi=1"}`);
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  const chipCls = (on: boolean) =>
    cn(
      "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition active:scale-[0.97]",
      on ? "btn-ink border-transparent" : "border-line bg-surface text-fg-2 hover:border-line-2 hover:text-fg",
    );
  const err = (k: string) =>
    errors[k] ? (
      <p id={`job-${k}-err`} className="field-error">
        {errors[k]}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} noValidate className="min-w-0">
      {/* Tahrirlash / Ko'rib chiqish */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="segment" role="tablist" aria-label="Forma rejimi">
          <button type="button" role="tab" aria-selected={mode === "edit"} data-active={mode === "edit"} onClick={() => setMode("edit")} className="segment-item inline-flex min-h-10 items-center gap-1.5">
            <PencilLine size={14} aria-hidden="true" /> Tahrirlash
          </button>
          <button type="button" role="tab" aria-selected={mode === "preview"} data-active={mode === "preview"} onClick={() => setMode("preview")} className="segment-item inline-flex min-h-10 items-center gap-1.5">
            <Eye size={14} aria-hidden="true" /> Ko'rib chiqish
          </button>
        </div>
        <p className="text-[12.5px] text-fg-3">E'lon {editing ? "saqlangach" : "joylangach"} 30 kun ochiq turadi.</p>
      </div>

      {mode === "preview" ? (
        <div className="space-y-4">
          <p className="text-[13px] font-semibold text-fg-3">Ro'yxatda shunday ko'rinadi:</p>
          <div className="pointer-events-none max-w-xl" aria-hidden="true">
            <JobCard job={preview} headingLevel="h3" />
          </div>
          <div className="card p-5 sm:p-6">
            <p className="text-[13px] font-semibold text-fg-3">To'liq tavsif</p>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-fg-2">{description.trim() || "—"}</p>
            <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4 text-[13.5px] sm:grid-cols-3">
              <div>
                <dt className="text-fg-3">Byudjet</dt>
                <dd className="font-semibold text-fg">
                  {budgetText} <span className="font-normal text-fg-3">· {BUDGET_TYPE_LABEL[budgetType]}</span>
                </dd>
              </div>
              <div>
                <dt className="text-fg-3">Hudud</dt>
                <dd className="font-semibold text-fg">{jobRegionLabel(regionSlug, true)}</dd>
              </div>
              <div>
                <dt className="text-fg-3">Muddat</dt>
                <dd className="font-semibold text-fg">{deadline.trim() || "Kelishiladi"}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : (
        <div className="card space-y-7 p-5 sm:p-7">
          {/* Sarlavha */}
          <div>
            <label htmlFor="job-title" className="field-label">
              E'lon sarlavhasi
            </label>
            <input
              ref={setRef("title")}
              id="job-title"
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={JOB_TITLE_MAX}
              placeholder="Masalan: Kafe uchun 30 soniyalik reklama roligi"
              autoComplete="off"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "job-title-err" : "job-title-hint"}
            />
            {err("title") ?? (
              <p id="job-title-hint" className="mt-1 text-[12px] text-fg-4">
                Nima kerakligini bir jumlada — mutaxassis ro'yxatda birinchi shuni ko'radi.
              </p>
            )}
          </div>

          {/* Tavsif */}
          <div>
            <label htmlFor="job-desc" className="field-label">
              Batafsil tavsif
            </label>
            <textarea
              ref={setRef("description")}
              id="job-desc"
              className="field min-h-[160px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={JOB_DESC_MAX}
              placeholder="Vazifa, joy va sana, davomiylik, kutilgan natija, namunalar havolasi… Qanchalik aniq bo'lsa, takliflar shunchalik aniq bo'ladi."
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? "job-description-err" : "job-desc-hint"}
            />
            <div className="mt-1 flex items-start justify-between gap-3">
              {errors.description ? (
                <p id="job-description-err" className="field-error !mt-0">
                  {errors.description}
                </p>
              ) : (
                <span id="job-desc-hint" className={cn("text-[12px]", description.trim().length > 0 && description.trim().length < JOB_DESC_MIN ? "text-warning-text" : "text-fg-4")}>
                  Kamida {JOB_DESC_MIN} ta belgi.
                </span>
              )}
              <span className="shrink-0 text-[12px] tabular-nums text-fg-4">
                {description.length}/{JOB_DESC_MAX}
              </span>
            </div>
          </div>

          {/* Yo'nalish */}
          <fieldset>
            <legend className="field-label">Yo'nalish</legend>
            <div ref={setRef("category")} tabIndex={-1} className="flex flex-wrap gap-1.5 outline-none" role="radiogroup" aria-label="Yo'nalish" aria-invalid={Boolean(errors.category)}>
              {CATEGORIES.map((c) => {
                const on = category === c.slug;
                return (
                  <button key={c.slug} type="button" role="radio" aria-checked={on} onClick={() => setCategory(c.slug)} className={chipCls(on)}>
                    <CategoryIcon icon={c.icon} size={14} aria-hidden="true" />
                    {c.name}
                  </button>
                );
              })}
            </div>
            {err("category")}
          </fieldset>

          {/* Hudud */}
          <fieldset>
            <legend className="field-label">Qayerda bajariladi</legend>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Ish joyi">
              <button type="button" role="radio" aria-checked={!remote} onClick={() => setRemote(false)} className={chipCls(!remote)}>
                <MapPin size={14} aria-hidden="true" /> Joyida (hudud)
              </button>
              <button type="button" role="radio" aria-checked={remote} onClick={() => setRemote(true)} className={chipCls(remote)}>
                <Wifi size={14} aria-hidden="true" /> Masofaviy
              </button>
            </div>
            {!remote && (
              <div className="mt-2.5 max-w-sm">
                <label htmlFor="job-region" className="sr-only">
                  Hudud
                </label>
                <select
                  ref={setRef("regionSlug")}
                  id="job-region"
                  className="field"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  aria-invalid={Boolean(errors.regionSlug)}
                  aria-describedby={errors.regionSlug ? "job-regionSlug-err" : undefined}
                >
                  <option value="">Hududni tanlang</option>
                  {REGIONS.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {remote && <p className="mt-2 text-[12px] text-fg-4">Istalgan hududdagi mutaxassis taklif yubora oladi.</p>}
            {err("regionSlug")}
          </fieldset>

          {/* Byudjet */}
          <fieldset>
            <legend className="field-label">Byudjet</legend>
            <div className="segment" role="radiogroup" aria-label="Byudjet turi">
              {(["fixed", "hourly"] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={budgetType === t} data-active={budgetType === t} onClick={() => setBudgetType(t)} className="segment-item min-h-10">
                  {BUDGET_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <div className="mt-2.5 grid max-w-md grid-cols-2 gap-2.5">
              <div className="relative">
                <label htmlFor="job-bmin" className="sr-only">
                  Minimal summa
                </label>
                <input
                  ref={setRef("budgetMin")}
                  id="job-bmin"
                  className="field pr-12"
                  inputMode="numeric"
                  placeholder="dan"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value.replace(/[^\d\s]/g, ""))}
                  aria-invalid={Boolean(errors.budgetMin)}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[12px] font-medium text-fg-3">so'm</span>
              </div>
              <div className="relative">
                <label htmlFor="job-bmax" className="sr-only">
                  Maksimal summa
                </label>
                <input
                  ref={setRef("budgetMax")}
                  id="job-bmax"
                  className="field pr-12"
                  inputMode="numeric"
                  placeholder="gacha"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value.replace(/[^\d\s]/g, ""))}
                  aria-invalid={Boolean(errors.budgetMax)}
                  aria-describedby={errors.budgetMax ? "job-budgetMax-err" : undefined}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[12px] font-medium text-fg-3">so'm</span>
              </div>
            </div>
            {err("budgetMin")}
            {err("budgetMax")}
            <p className="mt-1.5 text-[12px] text-fg-4">
              Ko'rinishi: <span className="font-semibold text-fg-2">{budgetText}</span>
              {budgetType === "hourly" ? " — soatbay ish. Taklifda mutaxassis umumiy taxminiy summani yozadi." : ". Bo'sh qoldirsangiz — «Kelishiladi»."}
            </p>
          </fieldset>

          {/* Muddat */}
          <div>
            <label htmlFor="job-deadline" className="field-label">
              Muddat <span className="font-normal text-fg-4">(ixtiyoriy)</span>
            </label>
            <input
              ref={setRef("deadline")}
              id="job-deadline"
              className="field max-w-md"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              maxLength={40}
              placeholder="Masalan: 25-noyabrgacha"
              autoComplete="off"
              aria-invalid={Boolean(errors.deadline)}
            />
            {err("deadline")}
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Muddat tez tanlovi">
              {DEADLINE_HINTS.map((h) => {
                const on = deadline === h;
                return (
                  <button key={h} type="button" aria-pressed={on} onClick={() => setDeadline(on ? "" : h)} className={chipCls(on)}>
                    {on && <Check size={13} aria-hidden="true" />}
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ko'nikmalar */}
          <div>
            <label htmlFor="job-skill" className="field-label">
              Kerakli ko'nikmalar <span className="font-normal text-fg-4">(ixtiyoriy, {JOB_SKILLS_MAX} tagacha)</span>
            </label>
            {skills.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Tanlangan ko'nikmalar">
                {skills.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => setSkills((cur) => cur.filter((x) => x !== s))}
                      className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent-soft px-3.5 text-[13px] font-semibold text-accent-text transition hover:brightness-105"
                      aria-label={`${s} — olib tashlash`}
                    >
                      {s} <X size={13} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex max-w-md gap-2">
              <input
                ref={setRef("skills")}
                id="job-skill"
                className="field"
                value={skillDraft}
                onChange={(e) => setSkillDraft(e.target.value)}
                onKeyDown={onSkillKey}
                maxLength={40}
                placeholder="Masalan: After Effects"
                disabled={skills.length >= JOB_SKILLS_MAX}
                autoComplete="off"
                aria-describedby="job-skill-hint"
              />
              <button
                type="button"
                onClick={() => addSkill(skillDraft)}
                disabled={!skillDraft.trim() || skills.length >= JOB_SKILLS_MAX}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg transition hover:border-fg disabled:opacity-50"
              >
                <Plus size={14} aria-hidden="true" /> Qo'shish
              </button>
            </div>
            <p id="job-skill-hint" className="mt-1 text-[12px] text-fg-4">
              Enter yoki vergul bilan qo'shing.
            </p>
            {err("skills")}
            {category && SKILL_HINTS[category] && (
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Tavsiya etilgan ko'nikmalar">
                {SKILL_HINTS[category]
                  .filter((h) => !skills.some((s) => s.toLowerCase() === h.toLowerCase()))
                  .map((h) => (
                    <button key={h} type="button" onClick={() => addSkill(h)} disabled={skills.length >= JOB_SKILLS_MAX} className={chipCls(false)}>
                      <Plus size={12} aria-hidden="true" /> {h}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-5 inline-flex items-center gap-2 rounded-full bg-danger-soft px-3.5 py-2 text-[13px] font-medium text-danger-text">
          <AlertCircle size={15} aria-hidden="true" /> {error}
        </div>
      )}

      <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end">
        {mode === "edit" ? (
          <button type="button" onClick={() => setMode("preview")} className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line-2 px-6 text-[14px] font-semibold text-fg transition hover:border-fg">
            <Eye size={16} aria-hidden="true" /> Ko'rib chiqish
          </button>
        ) : (
          <button type="button" onClick={() => setMode("edit")} className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line-2 px-6 text-[14px] font-semibold text-fg transition hover:border-fg">
            <PencilLine size={16} aria-hidden="true" /> Tahrirlashga qaytish
          </button>
        )}
        <button type="submit" disabled={busy} className="btn-accent inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-[15px] font-semibold disabled:opacity-60">
          {busy ? <Spinner /> : <Send size={16} aria-hidden="true" />}
          {editing ? "O'zgarishlarni saqlash" : "E'lonni joylash"}
        </button>
      </div>
    </form>
  );
}

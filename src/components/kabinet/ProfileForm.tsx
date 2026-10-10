"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Camera,
  CheckCircle2,
  Globe,
  ImagePlus,
  Instagram,
  Languages,
  Link2,
  MapPin,
  Plus,
  Send,
  Sparkles,
  Tags,
  Trash2,
  Wallet,
  X,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { Button, ButtonLink, Spinner } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { SafeImage } from "@/components/specialists/SafeImage";
import { CATEGORIES, EXPERIENCE_LEVELS, REGIONS, REGION_BY_SLUG } from "@/lib/constants";
import { cn, formatPrice } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Turlar va konstantalar                                              */
/* ------------------------------------------------------------------ */
type Experience = (typeof EXPERIENCE_LEVELS)[number]["value"];

export interface ProfileInitial {
  slug: string;
  title: string;
  category: string;
  regionSlug: string;
  city: string;
  bio: string;
  priceFrom: number;
  priceTo: number | null;
  experience: Experience;
  skills: string[];
  languages: string[];
  telegram: string;
  instagram: string;
  youtube: string;
  website: string;
  coverUrl: string;
  isAvailable: boolean;
}

interface FormState {
  title: string;
  category: string;
  regionSlug: string;
  city: string;
  bio: string;
  priceFrom: string;
  priceTo: string;
  experience: Experience;
  skills: string[];
  languages: string[];
  telegram: string;
  instagram: string;
  youtube: string;
  website: string;
  coverUrl: string;
  isAvailable: boolean;
}

const LANGS = [
  { code: "uz", label: "O'zbek" },
  { code: "ru", label: "Rus" },
  { code: "en", label: "Ingliz" },
  { code: "kaa", label: "Qoraqalpoq" },
  { code: "tg", label: "Tojik" },
] as const;

/** Yo'nalish bo'yicha ko'nikma takliflari */
const SKILL_SUGGESTIONS: Record<string, string[]> = {
  videograf: ["Sony FX3", "Sony A7S III", "Canon R6", "DJI Ronin", "Dron DJI Mavic", "Cinematic", "Wedding", "Intervyu", "Reklama", "Slow-motion", "Yorug'lik"],
  montajor: ["Premiere Pro", "DaVinci Resolve", "After Effects", "Final Cut", "Rang korreksiya", "Sound design", "Reels/TikTok", "YouTube", "Subtitr", "Motion grafika"],
  dizayner: ["Figma", "Adobe Illustrator", "Photoshop", "Brending", "Logo", "Poster", "SMM dizayn", "Tipografika", "Bosma", "Qadoq"],
  "motion-dizayner": ["After Effects", "Cinema 4D", "Blender", "Lottie", "2D animatsiya", "3D animatsiya", "Infografika", "Intro", "Rigging"],
  fotograf: ["Portret", "Fashion", "To'y", "Mahsulot", "Studiya yorug'ligi", "Lightroom", "Photoshop", "Retush", "Canon", "Sony"],
  "3d-artist": ["Blender", "3ds Max", "Corona", "V-Ray", "Cinema 4D", "Substance", "Interyer", "Eksteryer", "Mahsulot render", "Unreal Engine"],
  "ui-ux": ["Figma", "Dizayn tizimi", "Prototip", "UX tadqiqot", "Mobil UI", "Web UI", "Framer", "Webflow"],
  ovoz: ["Pro Tools", "Logic Pro", "Audition", "Diktor", "Dublyaj", "Mastering", "Podkast", "Studiya"],
};

const OTHER_CITY = "__other__";
const MAX_SKILLS = 20;
const MAX_BIO = 2000;
const DEFAULT_REGION = "toshkent-shahri";

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

function toAbsolute(url: string) {
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
}

function initialState(initial: ProfileInitial | null): FormState {
  return {
    title: initial?.title ?? "",
    category: initial?.category ?? CATEGORIES[0].slug,
    regionSlug: initial?.regionSlug ?? DEFAULT_REGION,
    city: initial?.city ?? REGION_BY_SLUG[DEFAULT_REGION].capital,
    bio: initial?.bio ?? "",
    priceFrom: initial && initial.priceFrom > 0 ? String(initial.priceFrom) : "",
    priceTo: initial?.priceTo ? String(initial.priceTo) : "",
    experience: initial?.experience ?? "middle",
    skills: initial?.skills ?? [],
    languages: initial?.languages.length ? initial.languages : ["uz"],
    telegram: initial?.telegram ?? "",
    instagram: initial?.instagram ?? "",
    youtube: initial?.youtube ?? "",
    website: initial?.website ?? "",
    coverUrl: initial?.coverUrl ?? "",
    isAvailable: initial?.isAvailable ?? true,
  };
}

/* ------------------------------------------------------------------ */
/* Kichik yordamchi komponentlar                                       */
/* ------------------------------------------------------------------ */
function Section({ icon: Icon, title, hint, children }: { icon: LucideIcon; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="border-t border-hairline pt-6 first:border-t-0 first:pt-0">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="glass-tint flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]">
          <Icon size={15} />
        </span>
        <div>
          <h3 className="text-[15px] font-semibold leading-tight text-fg">{title}</h3>
          {hint && <p className="text-[12px] text-fg-3">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint/50",
        checked ? "bg-ios-green" : "bg-fg/15",
      )}
    >
      <span
        className={cn(
          "absolute left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.25)] transition-transform duration-300",
          checked && "translate-x-[20px]",
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Asosiy forma                                                        */
/* ------------------------------------------------------------------ */
export function ProfileForm({
  initial,
  mode,
  ctaFirst = false,
}: {
  initial: ProfileInitial | null;
  mode: "create" | "edit";
  /** Mijoz uchun: avval «Mutaxassis bo'lish» kartasi, bosilganda forma ochiladi */
  ctaFirst?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!ctaFirst);
  const [f, setF] = useState<FormState>(() => initialState(initial));
  const [customCity, setCustomCity] = useState(() => {
    if (!initial) return false;
    return !(REGION_BY_SLUG[initial.regionSlug]?.cities ?? []).includes(initial.city);
  });
  const [skillInput, setSkillInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLFormElement>(null);

  const set = (patch: Partial<FormState>) => setF((s) => ({ ...s, ...patch }));

  const baseline = useMemo(() => JSON.stringify(initialState(initial)), [initial]);
  const dirty = JSON.stringify(f) !== baseline;

  useEffect(() => {
    if (!savedSlug) return;
    const t = window.setTimeout(() => setSavedSlug(null), 8000);
    return () => window.clearTimeout(t);
  }, [savedSlug]);

  const region = REGION_BY_SLUG[f.regionSlug];
  const cities = region?.cities ?? [];
  const category = CATEGORIES.find((c) => c.slug === f.category);
  const suggestions = (SKILL_SUGGESTIONS[f.category] ?? []).filter((s) => !f.skills.some((x) => x.toLowerCase() === s.toLowerCase())).slice(0, 10);

  const priceFromNum = Number(f.priceFrom.replace(/\s/g, ""));
  const priceToNum = Number(f.priceTo.replace(/\s/g, ""));
  const priceHint =
    priceFromNum > 0
      ? priceToNum > priceFromNum
        ? `${formatPrice(priceFromNum, { compact: true })} – ${formatPrice(priceToNum, { compact: true })}`
        : `${formatPrice(priceFromNum, { compact: true })} dan`
      : "Narx ko'rsatilmasa «Kelishiladi» deb chiqadi";

  /* ---------- Ko'nikmalar ---------- */
  const addSkill = (raw: string) => {
    const v = raw.trim().replace(/,+$/, "").trim().slice(0, 40);
    if (!v) return;
    if (f.skills.length >= MAX_SKILLS) return;
    if (f.skills.some((s) => s.toLowerCase() === v.toLowerCase())) {
      setSkillInput("");
      return;
    }
    set({ skills: [...f.skills, v] });
    setSkillInput("");
  };
  const removeSkill = (s: string) => set({ skills: f.skills.filter((x) => x !== s) });
  const onSkillKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill(skillInput);
    } else if (e.key === "Backspace" && skillInput === "" && f.skills.length > 0) {
      set({ skills: f.skills.slice(0, -1) });
    }
  };

  /* ---------- Hudud / shahar ---------- */
  const onRegion = (slug: string) => {
    const r = REGION_BY_SLUG[slug];
    setCustomCity(false);
    set({ regionSlug: slug, city: r?.capital ?? "" });
  };
  const onCity = (v: string) => {
    if (v === OTHER_CITY) {
      setCustomCity(true);
      set({ city: "" });
    } else {
      setCustomCity(false);
      set({ city: v });
    }
  };

  /* ---------- Muqova ---------- */
  const uploadCover = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = (await res.json()) as ApiResponse<{ url: string }>;
      if (!json.ok) {
        setError(json.error);
        return;
      }
      set({ coverUrl: toAbsolute(json.data.url) });
    } catch {
      setError("Rasmni yuklab bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setUploading(false);
      if (coverRef.current) coverRef.current.value = "";
    }
  };

  /* ---------- Yuborish ---------- */
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setErrors({});
    setSavedSlug(null);

    const local: Record<string, string> = {};
    if (f.title.trim().length < 5) local.title = "Sarlavha kamida 5 ta belgi";
    if (f.city.trim().length < 2) local.city = "Shaharni kiriting";
    if (f.languages.length === 0) local.languages = "Kamida bitta tilni tanlang";
    if (f.priceTo.trim() && priceToNum < priceFromNum) local.priceTo = "Maksimal narx minimaldan kam bo'lmasin";
    if (Object.keys(local).length) {
      setErrors(local);
      setError("Ba'zi maydonlarni tekshiring");
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: f.title.trim(),
          category: f.category,
          regionSlug: f.regionSlug,
          city: f.city.trim(),
          bio: f.bio.trim(),
          priceFrom: priceFromNum > 0 ? priceFromNum : 0,
          priceTo: f.priceTo.trim() ? priceToNum : null,
          experience: f.experience,
          skills: f.skills,
          languages: f.languages,
          telegram: f.telegram.trim().replace(/^@/, ""),
          instagram: f.instagram.trim().replace(/^@/, ""),
          youtube: f.youtube.trim(),
          website: f.website.trim(),
          coverUrl: f.coverUrl.trim(),
          isAvailable: f.isAvailable,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ id: string; slug: string }>;
      if (!json.ok) {
        setError(json.error);
        if (json.fields) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(json.fields)) mapped[k.split(".")[0]] = v;
          setErrors(mapped);
        }
        topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      setSavedSlug(json.data.slug);
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Mijoz uchun CTA ---------- */
  if (!open) {
    return (
      <div id="mutaxassis" className="glass-strong relative overflow-hidden p-6 sm:p-8">
        <span className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-tint/20 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-20 -right-12 h-56 w-56 rounded-full bg-ios-purple/20 blur-3xl" />
        <span className="glass-weak glass-pill inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-tint">
          <Sparkles size={12} /> Ijodkorlar uchun
        </span>
        <h2 className="mt-4 text-[24px] font-bold leading-tight tracking-tight text-fg sm:text-[30px]">Mutaxassis bo'lish</h2>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-fg-2">
          Videograf, montajor, dizaynermisiz? Profil oching — mijozlar sizni xaritadan topadi, buyurtmalar to'g'ridan-to'g'ri kabinetingizga keladi. Bepul.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {["Portfolio", "Narxlar", "Sharhlar", "Xaritada ko'rinish"].map((t) => (
            <li key={t} className="glass-weak glass-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-fg-2">
              <CheckCircle2 size={12} className="text-ios-green" /> {t}
            </li>
          ))}
        </ul>
        <Button type="button" size="lg" className="mt-6" onClick={() => setOpen(true)}>
          Profil yaratish <ArrowRight size={18} />
        </Button>
      </div>
    );
  }

  const experienceLabel = EXPERIENCE_LEVELS.find((e) => e.value === f.experience)?.label ?? "";

  return (
    <form ref={topRef} id="mutaxassis" onSubmit={submit} className="glass scroll-mt-28 p-5 sm:p-7" noValidate>
      {/* Sarlavha */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="glass-tint flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
            <Briefcase size={20} />
          </span>
          <div>
            <h2 className="text-[20px] font-bold tracking-tight text-fg">{mode === "edit" ? "Mutaxassis profili" : "Mutaxassis profilini yaratish"}</h2>
            <p className="mt-0.5 text-[13px] text-fg-3">
              {mode === "edit" ? "Bu ma'lumotlar ommaviy profilingizda va xaritada ko'rinadi." : "Yo'nalish, hudud va narxlarni kiriting — profilingiz xaritada paydo bo'ladi."}
            </p>
          </div>
        </div>
        {initial && (
          <ButtonLink href={`/mutaxassislar/${initial.slug}`} variant="glass" size="sm" className="shrink-0">
            Ommaviy profil <ArrowUpRight size={14} />
          </ButtonLink>
        )}
      </div>

      {/* Muvaffaqiyat */}
      {savedSlug && (
        <div
          role="status"
          className="glass-weak mt-5 flex flex-col gap-3 !rounded-[18px] p-4 animate-fade-up sm:flex-row sm:items-center sm:justify-between"
          style={{ animationDuration: "0.35s" }}
        >
          <p className="flex items-center gap-2 text-[14px] font-semibold text-fg">
            <CheckCircle2 size={18} className="text-ios-green" />
            {mode === "edit" ? "Profil saqlandi" : "Profil yaratildi! Endi portfolio qo'shing."}
          </p>
          <div className="flex gap-2">
            <Link href={`/mutaxassislar/${savedSlug}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-tint transition hover:opacity-80">
              Ommaviy profilni ko'rish <ArrowUpRight size={14} />
            </Link>
            {mode === "create" && (
              <Link href="/kabinet/portfolio" className="inline-flex items-center gap-1 text-[13px] font-semibold text-tint transition hover:opacity-80">
                Portfolio <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-5 inline-flex items-center gap-2 rounded-full bg-ios-red/12 px-3.5 py-2 text-[13px] font-medium text-ios-red">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="mt-6 space-y-6">
        {/* ============ Asosiy ============ */}
        <Section icon={Sparkles} title="Asosiy ma'lumotlar" hint="Sarlavha va yo'nalish — mijoz birinchi ko'radigan narsa">
          <div>
            <label htmlFor="pf-title" className="field-label">
              Sarlavha
            </label>
            <input
              id="pf-title"
              className="field"
              value={f.title}
              onChange={(e) => set({ title: e.target.value })}
              maxLength={90}
              placeholder="Masalan: To'y va event videografi | Sony FX3"
              aria-invalid={Boolean(errors.title)}
            />
            <div className="mt-1 flex items-start justify-between gap-3">
              {errors.title ? <p className="field-error !mt-0">{errors.title}</p> : <span className="text-[12px] text-fg-4">5–90 belgi. Qisqa va aniq.</span>}
              <span className="shrink-0 text-[12px] tabular-nums text-fg-4">{f.title.length}/90</span>
            </div>
          </div>

          <div className="mt-5">
            <span className="field-label">Yo'nalish</span>
            <div role="radiogroup" aria-label="Yo'nalish" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CATEGORIES.map((c) => {
                const active = f.category === c.slug;
                return (
                  <button
                    key={c.slug}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => set({ category: c.slug })}
                    className={cn(
                      "glass glass-hover flex items-center gap-2.5 !rounded-[18px] p-3 text-left transition",
                      active && "ring-2 ring-tint/60 !bg-[var(--glass-strong)]",
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-white" style={{ background: `linear-gradient(145deg, ${c.accent}, ${c.accent}aa)` }}>
                      <CategoryIcon icon={c.icon} size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-fg">{c.name}</span>
                    </span>
                    {active && <CheckCircle2 size={16} className="ml-auto shrink-0 text-tint" />}
                  </button>
                );
              })}
            </div>
            {errors.category && <p className="field-error">{errors.category}</p>}
          </div>

          <div className="mt-5">
            <span className="field-label">Tajriba</span>
            <div className="no-scrollbar -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
              <div className="segment" role="radiogroup" aria-label="Tajriba darajasi">
                {EXPERIENCE_LEVELS.map((lvl) => (
                  <button
                    key={lvl.value}
                    type="button"
                    role="radio"
                    aria-checked={f.experience === lvl.value}
                    className="segment-item"
                    data-active={f.experience === lvl.value}
                    onClick={() => set({ experience: lvl.value })}
                  >
                    {lvl.label.split(" (")[0]}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1.5 text-[12px] text-fg-4">{experienceLabel}</p>
            {errors.experience && <p className="field-error">{errors.experience}</p>}
          </div>
        </Section>

        {/* ============ Hudud ============ */}
        <Section icon={MapPin} title="Hudud" hint="Xaritada shu hududda ko'rinasiz">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="pf-region" className="field-label">
                Viloyat
              </label>
              <select id="pf-region" className="field" value={f.regionSlug} onChange={(e) => onRegion(e.target.value)} aria-invalid={Boolean(errors.regionSlug)}>
                {REGIONS.map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.name}
                  </option>
                ))}
              </select>
              {errors.regionSlug && <p className="field-error">{errors.regionSlug}</p>}
            </div>
            <div>
              <label htmlFor="pf-city" className="field-label">
                Shahar / tuman
              </label>
              <select id="pf-city" className="field" value={customCity ? OTHER_CITY : f.city} onChange={(e) => onCity(e.target.value)} aria-invalid={Boolean(errors.city)}>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={OTHER_CITY}>Boshqa…</option>
              </select>
              {customCity && (
                <input
                  className="field mt-2 animate-fade-up"
                  style={{ animationDuration: "0.3s" }}
                  value={f.city}
                  onChange={(e) => set({ city: e.target.value })}
                  maxLength={60}
                  placeholder="Shahar yoki tuman nomi"
                  autoFocus
                  aria-label="Shahar nomi"
                  aria-invalid={Boolean(errors.city)}
                />
              )}
              {errors.city && <p className="field-error">{errors.city}</p>}
            </div>
          </div>
        </Section>

        {/* ============ Haqida ============ */}
        <Section icon={Tags} title="O'zingiz haqingizda" hint="Tajriba, uslub, qanday loyihalar bilan ishlaysiz">
          <div>
            <label htmlFor="pf-bio" className="field-label">
              Bio
            </label>
            <textarea
              id="pf-bio"
              className="field min-h-[140px] resize-y"
              value={f.bio}
              onChange={(e) => set({ bio: e.target.value.slice(0, MAX_BIO) })}
              maxLength={MAX_BIO}
              placeholder="5 yildan beri to'y va reklama videolarini suratga olaman. Sony FX3 va dron bilan ishlayman…"
              aria-invalid={Boolean(errors.bio)}
            />
            <div className="mt-1 flex items-start justify-between gap-3">
              {errors.bio ? <p className="field-error !mt-0">{errors.bio}</p> : <span className="text-[12px] text-fg-4">To'liq bio ishonchni oshiradi.</span>}
              <span className={cn("shrink-0 text-[12px] tabular-nums", f.bio.length > MAX_BIO - 100 ? "text-ios-orange" : "text-fg-4")}>
                {f.bio.length}/{MAX_BIO}
              </span>
            </div>
          </div>

          {/* Ko'nikmalar */}
          <div className="mt-5">
            <label htmlFor="pf-skill" className="field-label">
              Ko'nikmalar <span className="font-normal text-fg-4">({f.skills.length}/{MAX_SKILLS})</span>
            </label>
            <div
              className={cn("field flex flex-wrap items-center gap-1.5 !py-2", f.skills.length >= MAX_SKILLS && "opacity-80")}
              onClick={() => document.getElementById("pf-skill")?.focus()}
            >
              {f.skills.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSkill(s);
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-tint-soft px-2.5 py-1 text-[12px] font-semibold text-tint transition hover:brightness-110 active:scale-95"
                  aria-label={`${s} — olib tashlash`}
                >
                  {s} <X size={12} />
                </button>
              ))}
              <input
                id="pf-skill"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={onSkillKey}
                onBlur={() => skillInput.trim() && addSkill(skillInput)}
                disabled={f.skills.length >= MAX_SKILLS}
                maxLength={40}
                placeholder={f.skills.length ? "Yana…" : "Masalan: Premiere Pro — Enter bilan qo'shing"}
                className="min-w-[140px] flex-1 bg-transparent py-1 text-[14px] text-fg outline-none placeholder:text-fg-4"
              />
            </div>
            {errors.skills ? <p className="field-error">{errors.skills}</p> : <p className="mt-1 text-[12px] text-fg-4">Enter yoki vergul bilan qo'shing, chipni bosib olib tashlang.</p>}
            {suggestions.length > 0 && f.skills.length < MAX_SKILLS && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addSkill(s)}
                    className="inline-flex items-center gap-1 rounded-full bg-fg/6 px-2.5 py-1 text-[12px] font-medium text-fg-2 transition hover:bg-fg/10 active:scale-95"
                  >
                    <Plus size={11} /> {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tillar */}
          <div className="mt-5">
            <span className="field-label">
              <Languages size={13} className="mr-1 inline -mt-0.5 text-tint" />
              Muloqot tillari
            </span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Tillar">
              {LANGS.map((l) => {
                const on = f.languages.includes(l.code);
                return (
                  <button
                    key={l.code}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ languages: on ? f.languages.filter((x) => x !== l.code) : [...f.languages, l.code] })}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition active:scale-95",
                      on ? "glass-tint" : "glass glass-pill text-fg-2 hover:text-fg",
                    )}
                  >
                    {on && <CheckCircle2 size={13} />}
                    {l.label}
                  </button>
                );
              })}
            </div>
            {errors.languages && <p className="field-error">{errors.languages}</p>}
          </div>
        </Section>

        {/* ============ Narx ============ */}
        <Section icon={Wallet} title="Narxlar" hint="So'mda. Diapazon ko'rsatsangiz, mijozga tushunarli bo'ladi">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="pf-price-from" className="field-label">
                Minimal narx
              </label>
              <div className="relative">
                <input
                  id="pf-price-from"
                  className="field pr-16"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={50000}
                  value={f.priceFrom}
                  onChange={(e) => set({ priceFrom: e.target.value })}
                  placeholder="500 000"
                  aria-invalid={Boolean(errors.priceFrom)}
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[13px] font-medium text-fg-3">so'm</span>
              </div>
              {errors.priceFrom && <p className="field-error">{errors.priceFrom}</p>}
            </div>
            <div>
              <label htmlFor="pf-price-to" className="field-label">
                Maksimal narx <span className="font-normal text-fg-4">(ixtiyoriy)</span>
              </label>
              <div className="relative">
                <input
                  id="pf-price-to"
                  className="field pr-16"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={50000}
                  value={f.priceTo}
                  onChange={(e) => set({ priceTo: e.target.value })}
                  placeholder="3 000 000"
                  aria-invalid={Boolean(errors.priceTo)}
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[13px] font-medium text-fg-3">so'm</span>
              </div>
              {errors.priceTo && <p className="field-error">{errors.priceTo}</p>}
            </div>
          </div>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-fg/6 px-3 py-1 text-[12px] font-medium text-fg-2">
            Profilda: <span className="font-semibold text-fg">{priceHint}</span>
          </p>
        </Section>

        {/* ============ Aloqa ============ */}
        <Section icon={Send} title="Aloqa va havolalar" hint="Mijozlar siz bilan qanday bog'lanadi">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="pf-telegram" className="field-label">
                Telegram
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[15px] font-medium text-fg-3">@</span>
                <input id="pf-telegram" className="field pl-9" value={f.telegram} onChange={(e) => set({ telegram: e.target.value })} maxLength={60} placeholder="username" autoComplete="off" aria-invalid={Boolean(errors.telegram)} />
              </div>
              {errors.telegram && <p className="field-error">{errors.telegram}</p>}
            </div>
            <div>
              <label htmlFor="pf-instagram" className="field-label">
                <Instagram size={13} className="mr-1 inline -mt-0.5 text-fg-3" />
                Instagram
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[15px] font-medium text-fg-3">@</span>
                <input id="pf-instagram" className="field pl-9" value={f.instagram} onChange={(e) => set({ instagram: e.target.value })} maxLength={60} placeholder="username" autoComplete="off" aria-invalid={Boolean(errors.instagram)} />
              </div>
              {errors.instagram && <p className="field-error">{errors.instagram}</p>}
            </div>
            <div>
              <label htmlFor="pf-youtube" className="field-label">
                <Youtube size={13} className="mr-1 inline -mt-0.5 text-fg-3" />
                YouTube kanal
              </label>
              <input id="pf-youtube" className="field" type="url" inputMode="url" value={f.youtube} onChange={(e) => set({ youtube: e.target.value })} maxLength={300} placeholder="https://youtube.com/@kanal" aria-invalid={Boolean(errors.youtube)} />
              {errors.youtube && <p className="field-error">{errors.youtube}</p>}
            </div>
            <div>
              <label htmlFor="pf-website" className="field-label">
                <Globe size={13} className="mr-1 inline -mt-0.5 text-fg-3" />
                Veb-sayt
              </label>
              <input id="pf-website" className="field" type="url" inputMode="url" value={f.website} onChange={(e) => set({ website: e.target.value })} maxLength={300} placeholder="https://" aria-invalid={Boolean(errors.website)} />
              {errors.website && <p className="field-error">{errors.website}</p>}
            </div>
          </div>
        </Section>

        {/* ============ Muqova ============ */}
        <Section icon={ImagePlus} title="Muqova rasmi" hint="Profil sarlavhasida keng rasm (tavsiya: 1600×600)">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_240px]">
            <div>
              <label htmlFor="pf-cover" className="field-label">
                Rasm havolasi
              </label>
              <div className="relative">
                <Link2 size={15} className="pointer-events-none absolute inset-y-0 left-4 my-auto text-fg-4" />
                <input id="pf-cover" className="field pl-10" type="url" inputMode="url" value={f.coverUrl} onChange={(e) => set({ coverUrl: e.target.value })} maxLength={300} placeholder="https://… yoki quyidan yuklang" aria-invalid={Boolean(errors.coverUrl)} />
              </div>
              {errors.coverUrl && <p className="field-error">{errors.coverUrl}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="glass" size="sm" onClick={() => coverRef.current?.click()} disabled={uploading}>
                  {uploading ? <Spinner /> : <Camera size={14} />} Rasm yuklash
                </Button>
                {f.coverUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => set({ coverUrl: "" })} className="text-ios-red hover:bg-ios-red/10 hover:text-ios-red">
                    <Trash2 size={14} /> Olib tashlash
                  </Button>
                )}
                <input
                  ref={coverRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadCover(file);
                  }}
                />
              </div>
              <p className="mt-2 text-[12px] text-fg-4">JPG, PNG, WEBP · 5 MB gacha.</p>
            </div>
            <div className="glass-weak relative h-32 overflow-hidden !rounded-[18px] sm:h-full sm:min-h-[128px]">
              {f.coverUrl ? (
                <SafeImage
                  key={f.coverUrl}
                  src={f.coverUrl}
                  alt="Muqova ko'rinishi"
                  className="h-full w-full object-cover"
                  fallback={
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[12px] text-fg-3">
                      <ImagePlus size={20} className="text-fg-4" /> Rasm yuklanmadi
                    </div>
                  }
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[12px] text-fg-3">
                  <ImagePlus size={20} className="text-fg-4" /> Ko'rinish
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* ============ Holat ============ */}
        <Section icon={CheckCircle2} title="Holat">
          <div className="glass-weak flex items-center justify-between gap-4 !rounded-[18px] px-4 py-3">
            <div>
              <p className="text-[15px] font-semibold text-fg">Buyurtma qabul qilaman</p>
              <p className="text-[12px] text-fg-3">{f.isAvailable ? "Profilda «Bo'sh» belgisi ko'rinadi." : "Profilda «Band» belgisi ko'rinadi, buyurtmalar navbatga tushadi."}</p>
            </div>
            <Switch checked={f.isAvailable} onChange={(v) => set({ isAvailable: v })} label="Buyurtma qabul qilish holati" />
          </div>
        </Section>
      </div>

      {/* Pastki panel */}
      <div className="mt-7 flex flex-col-reverse items-stretch gap-3 border-t border-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[13px]" aria-live="polite">
          {savedSlug ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#1f9d46] dark:text-ios-green">
              <CheckCircle2 size={15} /> Saqlandi
            </span>
          ) : dirty ? (
            <span className="text-fg-3">O'zgarishlar hali saqlanmagan</span>
          ) : mode === "edit" ? (
            <span className="text-fg-4">Hammasi saqlangan</span>
          ) : (
            <span className="text-fg-4">{category ? `${category.name} sifatida ro'yxatdan o'tasiz` : ""}</span>
          )}
        </div>
        <div className="flex gap-2">
          {ctaFirst && (
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Bekor qilish
            </Button>
          )}
          <Button type="submit" disabled={busy || uploading} className="flex-1 sm:min-w-[200px]">
            {busy ? <Spinner /> : mode === "edit" ? "Saqlash" : "Profilni yaratish"}
          </Button>
        </div>
      </div>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { AlertCircle, ArrowRight, ArrowUpRight, BadgeCheck, Briefcase, Camera, CheckCircle2, ChevronDown, Globe, ImagePlus, Instagram, Languages, Link2, MapPin, Package, Plus, Send, Sparkles, Tags, Trash2, Wallet, Wrench, X, Youtube, type LucideIcon, GraduationCap } from "lucide-react";
import { Button, ButtonLink, Spinner } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { SafeImage } from "@/components/specialists/SafeImage";
import { ImageCropper } from "@/components/kabinet/ImageCropper";
import { useUnsavedGuard } from "@/components/kabinet/useUnsavedGuard";
import { clearDraft, loadDraft, saveDraft } from "@/lib/draft";
import { VisibilityChip } from "@/components/kabinet/VisibilityChip";
import { CategoryField } from "@/components/ui/CategoryPicker";
import { MoneyInput, groupDigits, parseMoney } from "@/components/ui/MoneyInput";
import { PRICE_MIN, PRICE_MIN_USD, suggestPrice } from "@/lib/pricing";
import { CATEGORIES, EXPERIENCE_LEVELS, PACKAGE_TIERS, REGIONS, REGION_BY_SLUG, WORK_TYPES, type PackageTierKey } from "@/lib/constants";
import type { Certificate, EducationItem, ServicePackage, SpecialistRates, WorkItem } from "@/lib/db/schema";
import type { ResolvedVisibility } from "@/lib/privacy";
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
  priceCurrency?: "UZS" | "USD";
  priceUsdFrom?: number | null;
  priceUsdTo?: number | null;
  experience: Experience;
  skills: string[];
  /** Jihozlar (F51) — eski chaqiruvlar uchun ixtiyoriy */
  equipment?: string[];
  languages: string[];
  telegram: string;
  instagram: string;
  youtube: string;
  website: string;
  coverUrl: string;
  isAvailable: boolean;
  /** F31 / F64 / F52 / F70 — eski chaqiruvlar uchun ixtiyoriy */
  packages?: ServicePackage[];
  certificates?: Certificate[];
  workHistory?: WorkItem[];
  education?: EducationItem[];
  workTypes?: string[];
  rates?: SpecialistRates;
}

/** Paket qoralamasi: uchala daraja har doim bor, `enabled` — saqlanadimi */
interface PackageDraft {
  key: PackageTierKey;
  enabled: boolean;
  title: string;
  price: string;
  deliveryDays: string;
  revisions: string;
  features: string[];
}
interface CertificateDraft {
  title: string;
  issuer: string;
  year: string;
  url: string;
}
interface WorkDraft {
  role: string;
  company: string;
  fromYear: string;
  toYear: string;
  description: string;
}
interface EducationDraft {
  school: string;
  degree: string;
  fromYear: string;
  toYear: string;
}

interface FormState {
  title: string;
  category: string;
  regionSlug: string;
  city: string;
  bio: string;
  priceFrom: string;
  priceTo: string;
  /** Narx valyutasi: priceFrom/priceTo shu valyutadagi summalar (guruhlangan matn) */
  currency: "UZS" | "USD";
  experience: Experience;
  skills: string[];
  equipment: string[];
  languages: string[];
  telegram: string;
  instagram: string;
  youtube: string;
  website: string;
  coverUrl: string;
  isAvailable: boolean;
  workTypes: string[];
  packages: PackageDraft[];
  certificates: CertificateDraft[];
  workHistory: WorkDraft[];
  education: EducationDraft[];
  rates: { hourly: string; daily: string; project: string; unit: string };
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

/** Jihoz takliflari (F51): yo'nalishga mos, bo'lmasa umumiy ro'yxat */
const EQUIPMENT_GENERAL = ["Sony A7IV", "Canon R6", "DJI Mini 4 Pro", "DJI Ronin RS3", "Godox SL60", "Rode Wireless GO II", "MacBook Pro M3", "Wacom Intuos Pro"];
const EQUIPMENT_SUGGESTIONS: Record<string, string[]> = {
  videograf: ["Sony A7IV", "Sony FX3", "Canon R6", "DJI Mini 4 Pro", "DJI Mavic 3", "DJI Ronin RS3", "Godox SL60", "Aputure 300d", "Rode Wireless GO II"],
  fotograf: ["Canon R6", "Sony A7IV", "Nikon Z6 II", "Fujifilm X-T5", "Godox AD200", "Profoto B10", "Sigma 35mm Art", "DJI Mini 4 Pro"],
  montajor: ["MacBook Pro M3", "Mac Studio", "Blackmagic Speed Editor", "Eizo ColorEdge", "Sony WH-1000XM5"],
  dizayner: ["Wacom Intuos Pro", "iPad Pro", "Apple Pencil", "MacBook Pro M3", "Eizo ColorEdge"],
  "motion-dizayner": ["MacBook Pro M3", "RTX 4090", "Wacom Intuos Pro", "iPad Pro"],
  "3d-artist": ["RTX 4090", "SpaceMouse", "Wacom Intuos Pro", "Ryzen 9 7950X"],
  "ui-ux": ["MacBook Pro M3", "iPad Pro", "Apple Pencil", "Wacom Intuos Pro"],
  ovoz: ["Shure SM7B", "Neumann U87", "Rode NT1", "Zoom H6", "Focusrite Scarlett", "Beyerdynamic DT 770"],
};

const OTHER_CITY = "__other__";
const MAX_PACKAGE_FEATURES = 6;
const MAX_CERTIFICATES = 10;
const MAX_EXPERIENCE = 10;
const MAX_EDUCATION = 6;
/** Yangi paket uchun standart nomlar (mutaxassis o'zgartiradi) */
const PACKAGE_DEFAULT_TITLE: Record<PackageTierKey, string> = { basic: "Boshlang'ich", standard: "Standart", premium: "Premium" };

function packageDrafts(list: ServicePackage[] | undefined): PackageDraft[] {
  return PACKAGE_TIERS.map((t) => {
    const p = list?.find((x) => x.key === t.key);
    return {
      key: t.key,
      enabled: Boolean(p),
      title: p?.title ?? "",
      price: p ? String(p.price) : "",
      deliveryDays: p ? String(p.deliveryDays) : "",
      revisions: p ? String(p.revisions) : "",
      features: p?.features ?? [],
    };
  });
}
const numOrEmpty = (n: number | undefined) => (n && n > 0 ? String(n) : "");
const toInt = (v: string) => Number(v.replace(/\s/g, ""));
const MAX_SKILLS = 20;
const MAX_EQUIPMENT = 20;
const MAX_BIO = 2000;
const DEFAULT_REGION = "toshkent-shahri";

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

/** Ro'yxatdan o'tishdan kelgan oldindan to'ldirish (?category=&experience=&region=) — faqat yangi profil uchun */
export interface ProfilePrefill {
  category?: string;
  experience?: Experience;
  regionSlug?: string;
}

function initialState(initial: ProfileInitial | null, prefill?: ProfilePrefill | null): FormState {
  const category = initial?.category ?? prefill?.category ?? CATEGORIES[0].slug;
  const regionSlug = initial?.regionSlug ?? prefill?.regionSlug ?? DEFAULT_REGION;
  const experience = initial?.experience ?? prefill?.experience ?? "middle";
  const usd = initial?.priceCurrency === "USD";
  // Yangi profil: kasb/tajriba/hududga ko'ra bozor tahlili asosidagi boshlang'ich narx (200 000 so'mdan past bo'lmaydi) — keyin o'zgartiriladi
  const sug = !initial ? suggestPrice({ category, experience, regionSlug }) : null;
  return {
    title: initial?.title ?? "",
    category,
    regionSlug,
    city: initial?.city ?? REGION_BY_SLUG[regionSlug]?.capital ?? REGION_BY_SLUG[DEFAULT_REGION].capital,
    bio: initial?.bio ?? "",
    currency: usd ? "USD" : "UZS",
    priceFrom: usd ? (initial?.priceUsdFrom ? groupDigits(String(initial.priceUsdFrom)) : "") : initial && initial.priceFrom > 0 ? groupDigits(String(initial.priceFrom)) : sug ? groupDigits(String(sug.from)) : "",
    priceTo: usd ? (initial?.priceUsdTo ? groupDigits(String(initial.priceUsdTo)) : "") : initial?.priceTo ? groupDigits(String(initial.priceTo)) : sug ? groupDigits(String(sug.to)) : "",
    experience,
    skills: initial?.skills ?? [],
    equipment: initial?.equipment ?? [],
    languages: initial?.languages.length ? initial.languages : ["uz"],
    telegram: initial?.telegram ?? "",
    instagram: initial?.instagram ?? "",
    youtube: initial?.youtube ?? "",
    website: initial?.website ?? "",
    coverUrl: initial?.coverUrl ?? "",
    isAvailable: initial?.isAvailable ?? true,
    workTypes: initial?.workTypes ?? [],
    packages: packageDrafts(initial?.packages),
    certificates: (initial?.certificates ?? []).map((c) => ({ title: c.title, issuer: c.issuer, year: String(c.year), url: c.url ?? "" })),
    workHistory: (initial?.workHistory ?? []).map((e) => ({ role: e.role, company: e.company, fromYear: String(e.fromYear), toYear: e.toYear ? String(e.toYear) : "", description: e.description ?? "" })),
    education: (initial?.education ?? []).map((e) => ({ school: e.school, degree: e.degree, fromYear: String(e.fromYear), toYear: e.toYear ? String(e.toYear) : "" })),
    rates: { hourly: groupDigits(numOrEmpty(initial?.rates?.hourly)), daily: groupDigits(numOrEmpty(initial?.rates?.daily)), project: groupDigits(numOrEmpty(initial?.rates?.project)), unit: groupDigits(numOrEmpty(initial?.rates?.unit)) },
  };
}

/* ------------------------------------------------------------------ */
/* Kichik yordamchi komponentlar                                       */
/* ------------------------------------------------------------------ */
/** Forma bo'limlari (E95): yopishqoq navigatsiya, progress va «Keyingi bo'lim» shu ro'yxatdan */
const SECTIONS = [
  { id: "pf-asosiy", label: "Asosiy" },
  { id: "pf-hudud", label: "Hudud" },
  { id: "pf-haqida", label: "Haqida" },
  { id: "pf-narx", label: "Narx" },
  { id: "pf-paketlar", label: "Paketlar" },
  { id: "pf-sertifikat", label: "Sertifikatlar" },
  { id: "pf-tajriba", label: "Tajriba" },
  { id: "pf-aloqa", label: "Aloqa" },
  { id: "pf-muqova", label: "Muqova" },
  { id: "pf-holat", label: "Holat" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

/** Server/forma xatosi qaysi bo'limda — xatodan keyin o'sha bo'limga o'tiladi */
const FIELD_SECTION: Record<string, SectionId> = {
  title: "pf-asosiy",
  category: "pf-asosiy",
  experience: "pf-asosiy",
  regionSlug: "pf-hudud",
  city: "pf-hudud",
  bio: "pf-haqida",
  skills: "pf-haqida",
  equipment: "pf-haqida",
  languages: "pf-haqida",
  priceFrom: "pf-narx",
  priceTo: "pf-narx",
  rates: "pf-narx",
  workTypes: "pf-haqida",
  packages: "pf-paketlar",
  certificates: "pf-sertifikat",
  workHistory: "pf-tajriba",
  education: "pf-tajriba",
  telegram: "pf-aloqa",
  instagram: "pf-aloqa",
  youtube: "pf-aloqa",
  website: "pf-aloqa",
  coverUrl: "pf-muqova",
};

/**
 * Bo'limga silliq o'tish; fokus bo'lim sarlavhasiga (tabIndex=-1) — klaviatura/ekran o'quvchi joyini yo'qotmaydi,
 * mobilda esa klaviatura o'z-o'zidan ochilib ketmaydi.
 */
function goToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  document.getElementById(`${id}-title`)?.focus({ preventScroll: true });
}

function Section({ id, icon: Icon, title, hint, next, children }: { id: SectionId; icon: LucideIcon; title: string; hint?: string; next?: { id: string; label: string }; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-[150px] border-t border-line pt-6 first:border-t-0 first:pt-0 sm:scroll-mt-[160px]">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="btn-ink flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]">
          <Icon size={15} />
        </span>
        <div>
          <h3 id={`${id}-title`} tabIndex={-1} className="text-[15px] font-semibold leading-tight text-fg outline-none">
            {title}
          </h3>
          {hint && <p className="text-[12px] text-fg-3">{hint}</p>}
        </div>
      </div>
      {children}
      {next && (
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => goToSection(next.id)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-fg-2 transition hover:bg-fg/6 hover:text-fg active:scale-[0.97]"
          >
            Keyingi bo'lim: {next.label} <ChevronDown size={15} />
          </button>
        </div>
      )}
    </section>
  );
}

/** Chip kiritish (jihozlar): Enter/vergul bilan qo'shish, Backspace bilan oxirgisini o'chirish, takliflar */
function ChipInput({
  id,
  values,
  onChange,
  max,
  placeholder,
  suggestions,
}: {
  id: string;
  values: string[];
  onChange: (next: string[]) => void;
  max: number;
  placeholder: string;
  suggestions: string[];
}) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const v = raw.trim().replace(/,+$/, "").trim().slice(0, 40);
    setText("");
    if (!v || values.length >= max || values.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...values, v]);
  };
  const left = suggestions.filter((s) => !values.some((x) => x.toLowerCase() === s.toLowerCase())).slice(0, 8);
  return (
    <>
      <div className={cn("field flex flex-wrap items-center gap-2 !py-2", values.length >= max && "opacity-80")} onClick={() => document.getElementById(id)?.focus()}>
        {values.map((v) => (
          <button
            key={v}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(values.filter((x) => x !== v));
            }}
            className="inline-flex min-h-8 items-center gap-1 rounded-full bg-fg/8 px-2.5 py-1.5 text-[12px] font-semibold text-fg transition hover:bg-fg/12 active:scale-95"
            aria-label={`${v} — olib tashlash`}
          >
            {v} <X size={12} />
          </button>
        ))}
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && text === "" && values.length > 0) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => text.trim() && add(text)}
          disabled={values.length >= max}
          maxLength={40}
          placeholder={values.length ? "Yana…" : placeholder}
          className="min-w-[140px] flex-1 bg-transparent py-1 text-[14px] text-fg outline-none placeholder:text-fg-4"
        />
      </div>
      {left.length > 0 && values.length < max && (
        <div className="mt-2 flex flex-wrap gap-2">
          {left.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex min-h-8 items-center gap-1 rounded-full bg-fg/6 px-2.5 py-1.5 text-[12px] font-medium text-fg-2 transition hover:bg-fg/10 active:scale-95"
            >
              <Plus size={11} /> {s}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="switch" />;
}

/** Bio uchun yordamchi andozalar — bosilganda matn oxiriga qo'shiladi */
const BIO_PROMPTS: Array<{ key: string; label: string; text: string }> = [
  { key: "exp", label: "Tajriba", text: "Tajriba: __ yildan beri __ yo'nalishida ishlayman. Eng ko'p __ loyihalar bilan ishlaganman." },
  { key: "style", label: "Uslub", text: "Uslub: __ (masalan, kinematik, minimal, yorqin). Har loyihaga mijoz brendi va maqsadidan kelib chiqib yondashaman." },
  { key: "gear", label: "Jihozlar", text: "Jihozlar va dasturlar: __ (kamera/obyektivlar, dron, yorug'lik; Premiere Pro, DaVinci, After Effects)." },
  { key: "flow", label: "Ish jarayoni", text: "Ish jarayoni: brif → ssenariy/moodboard → suratga olish → montaj → 2 marta tuzatish → topshirish. Muddat: odatda __ kun." },
];

/** Avto-balandlik: matn ko'paygan sari textarea o'sadi (skroll o'rniga) */
function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(640, Math.max(160, el.scrollHeight + 2))}px`;
}

/* ------------------------------------------------------------------ */
/* Asosiy forma                                                        */
/* ------------------------------------------------------------------ */
export function ProfileForm({
  initial,
  mode,
  ctaFirst = false,
  visibility = null,
  prefill = null,
  usdRate = 12_500,
}: {
  initial: ProfileInitial | null;
  /** Ro'yxatdan o'tishdan kelgan kasb/tajriba/hudud (faqat yangi profil) */
  prefill?: ProfilePrefill | null;
  /** 1 USD necha so'm (platforma sozlamasi) — dollarda belgilangan narxning so'mdagi ekvivalenti uchun */
  usdRate?: number;
  mode: "create" | "edit";
  /** Mijoz uchun: avval «Mutaxassis bo'lish» kartasi, bosilganda forma ochiladi */
  ctaFirst?: boolean;
  /** Joriy maxfiylik darajalari — aloqa maydonlari yonida «kimga ko'rinadi» belgisi */
  visibility?: ResolvedVisibility | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!ctaFirst);
  const [f, setF] = useState<FormState>(() => initialState(initial, prefill));
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
  /** Tanlangan muqova fayli — yuklashdan oldin kesish oynasida moslash uchun */
  const [cropCover, setCropCover] = useState<File | null>(null);
  const topRef = useRef<HTMLFormElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const sectionNavRef = useRef<HTMLElement>(null);
  const [activeSection, setActiveSection] = useState<SectionId>(SECTIONS[0].id);

  // Mavjud bio uzun bo'lsa, ochilganda textarea unga moslashsin
  useEffect(() => {
    autosize(bioRef.current);
  }, [open]);

  const set = (patch: Partial<FormState>) => setF((s) => ({ ...s, ...patch }));

  const baseline = useMemo(() => JSON.stringify(initialState(initial, prefill)), [initial, prefill]);
  const dirty = JSON.stringify(f) !== baseline;
  useUnsavedGuard(dirty && !busy);

  /* ---------- Qoralama (localStorage): yozilganlar sahifa yopilsa ham yo'qolmasin ---------- */
  const draftKey = `profile:${initial?.slug ?? "new"}`;
  const [draftRestored, setDraftRestored] = useState(false);
  const draftReady = useRef(false);
  useEffect(() => {
    // Birinchi chizishdan keyin: saqlangan qoralama bo'lsa va u hozirgi (server) holatdan farq qilsa — tiklaymiz
    const saved = loadDraft<FormState>(draftKey);
    if (saved && JSON.stringify(saved) !== baseline) {
      setF(saved);
      setDraftRestored(true);
      if (!open) setOpen(true);
    }
    draftReady.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  useEffect(() => {
    if (!draftReady.current) return;
    if (!dirty) {
      clearDraft(draftKey);
      return;
    }
    const t = window.setTimeout(() => saveDraft(draftKey, f), 600);
    return () => window.clearTimeout(t);
  }, [f, dirty, draftKey]);
  const discardDraft = () => {
    clearDraft(draftKey);
    setF(initialState(initial, prefill));
    setDraftRestored(false);
  };

  useEffect(() => {
    if (!savedSlug) return;
    const t = window.setTimeout(() => setSavedSlug(null), 8000);
    return () => window.clearTimeout(t);
  }, [savedSlug]);

  const region = REGION_BY_SLUG[f.regionSlug];
  const cities = region?.cities ?? [];
  const category = CATEGORIES.find((c) => c.slug === f.category);
  const suggestions = (SKILL_SUGGESTIONS[f.category] ?? []).filter((s) => !f.skills.some((x) => x.toLowerCase() === s.toLowerCase())).slice(0, 10);

  const usdMode = f.currency === "USD";
  const priceFromNum = parseMoney(f.priceFrom);
  const priceToNum = parseMoney(f.priceTo);
  // So'mdagi ekvivalent (USD rejimida kurs bo'yicha, 1 000 ga yaxlitlanadi) — filtr/saralash va minimal narx tekshiruvi shunga tayanadi
  const toUzs = (n: number) => (usdMode ? Math.round((n * usdRate) / 1000) * 1000 : n);
  const priceFromUzs = toUzs(priceFromNum);
  const priceToUzs = toUzs(priceToNum);
  const money = (n: number) => (usdMode ? `$${groupDigits(String(n))}` : formatPrice(n));
  const priceHint =
    priceFromNum > 0
      ? priceToNum > priceFromNum
        ? `${money(priceFromNum)} – ${money(priceToNum)}`
        : `${money(priceFromNum)} dan`
      : "Narx ko'rsatilmasa «Kelishiladi» deb chiqadi";
  const sug = suggestPrice({ category: f.category, experience: f.experience, regionSlug: f.regionSlug });
  const sugFrom = usdMode ? Math.max(PRICE_MIN_USD, Math.round(sug.from / usdRate / 5) * 5) : sug.from;
  const sugTo = usdMode ? Math.max(sugFrom + 10, Math.round(sug.to / usdRate / 5) * 5) : sug.to;

  /* ---------- Bo'limlar to'liqligi va progress (E95) — «Holat» doim tayyor, hisobga kirmaydi ---------- */
  const sectionDone: Record<SectionId, boolean> = {
    "pf-asosiy": f.title.trim().length >= 5,
    "pf-hudud": f.city.trim().length >= 2,
    "pf-haqida": f.bio.trim().length >= 80 && f.skills.length >= 3 && f.languages.length > 0,
    "pf-narx": priceFromUzs >= PRICE_MIN,
    "pf-aloqa": Boolean(f.telegram.trim() || f.instagram.trim()),
    "pf-muqova": Boolean(f.coverUrl.trim()),
    "pf-holat": true,
    // Ixtiyoriy bo'limlar — progressga kirmaydi, faqat belgi
    "pf-paketlar": f.packages.some((p) => p.enabled),
    "pf-sertifikat": f.certificates.length > 0,
    "pf-tajriba": f.workHistory.length > 0 || f.education.length > 0,
  };
  const OPTIONAL: SectionId[] = ["pf-holat", "pf-paketlar", "pf-sertifikat", "pf-tajriba"];
  const counted = SECTIONS.filter((x) => !OPTIONAL.includes(x.id));
  const progress = Math.round((counted.filter((x) => sectionDone[x.id]).length / counted.length) * 100);
  const nextOf = (id: SectionId) => {
    const i = SECTIONS.findIndex((x) => x.id === id);
    const n = SECTIONS[i + 1];
    return n ? { id: n.id, label: n.label } : undefined;
  };
  const equipmentSuggestions = EQUIPMENT_SUGGESTIONS[f.category] ?? EQUIPMENT_GENERAL;

  /* Ko'rinib turgan bo'lim — yopishqoq navigatsiyada belgilanadi */
  useEffect(() => {
    if (!open) return;
    const els = SECTIONS.map((x) => document.getElementById(x.id)).filter((el): el is HTMLElement => Boolean(el));
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.id as SectionId);
      },
      { rootMargin: "-170px 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [open]);

  /* Faol chip mobil qatorda ko'rinadigan joyga (sahifa skrolliga tegmasdan) */
  useEffect(() => {
    const nav = sectionNavRef.current;
    const btn = nav?.querySelector<HTMLElement>(`[data-section="${activeSection}"]`);
    if (!nav || !btn) return;
    const nb = nav.getBoundingClientRect();
    const bb = btn.getBoundingClientRect();
    if (bb.left < nb.left || bb.right > nb.right) nav.scrollTo({ left: Math.max(0, nav.scrollLeft + (bb.left - nb.left) - 12) });
  }, [activeSection]);

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

  /* ---------- Paketlar (F31) va sertifikatlar (F64) ---------- */
  const setPkg = (key: PackageTierKey, patch: Partial<PackageDraft>) =>
    setF((st) => ({ ...st, packages: st.packages.map((p) => (p.key === key ? { ...p, ...patch } : p)) }));
  const togglePkg = (key: PackageTierKey, on: boolean) =>
    setF((st) => ({
      ...st,
      packages: st.packages.map((p) =>
        p.key === key
          ? { ...p, enabled: on, title: on && !p.title ? PACKAGE_DEFAULT_TITLE[key] : p.title, revisions: on && !p.revisions ? "1" : p.revisions }
          : p,
      ),
    }));
  const setCert = (i: number, patch: Partial<CertificateDraft>) => setF((st) => ({ ...st, certificates: st.certificates.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const setWork = (i: number, patch: Partial<WorkDraft>) => setF((st) => ({ ...st, workHistory: st.workHistory.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const setEdu = (i: number, patch: Partial<EducationDraft>) => setF((st) => ({ ...st, education: st.education.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const thisYear = new Date().getFullYear();

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
      // Server qaytargan yo'l o'zgarishsiz saqlanadi (/uploads/… — domen bazaga yozilmaydi)
      set({ coverUrl: json.data.url });
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
    if (priceFromUzs < PRICE_MIN || (usdMode && priceFromNum < PRICE_MIN_USD)) local.priceFrom = usdMode ? `Minimal narx — $${PRICE_MIN_USD}` : `Minimal narx — ${formatPrice(PRICE_MIN)}`;
    if (f.priceTo.trim() && priceToNum < priceFromNum) local.priceTo = "Maksimal narx minimaldan kam bo'lmasin";
    for (const p of f.packages) {
      if (!p.enabled) continue;
      if (p.title.trim().length < 2) local[`pkg.${p.key}.title`] = "Paket nomini yozing";
      if (!(toInt(p.price) >= 1000)) local[`pkg.${p.key}.price`] = "Narx kamida 1 000 so'm";
      if (!(toInt(p.deliveryDays) >= 1 && toInt(p.deliveryDays) <= 365)) local[`pkg.${p.key}.deliveryDays`] = "1–365 kun";
      if (p.revisions.trim() && !(toInt(p.revisions) >= 0 && toInt(p.revisions) <= 20)) local[`pkg.${p.key}.revisions`] = "0–20";
    }
    f.certificates.forEach((c, i) => {
      if (c.title.trim().length < 2) local[`cert.${i}.title`] = "Nomini yozing";
      if (c.issuer.trim().length < 2) local[`cert.${i}.issuer`] = "Kim berganini yozing";
      const y = toInt(c.year);
      if (!(y >= 1970 && y <= thisYear + 1)) local[`cert.${i}.year`] = `1970–${thisYear + 1}`;
      if (c.url.trim() && !/^https:\/\/\S+$/i.test(c.url.trim())) local[`cert.${i}.url`] = "https:// bilan boshlansin";
    });
    const yearOk = (v: string) => toInt(v) >= 1970 && toInt(v) <= thisYear + 1;
    f.workHistory.forEach((e, i) => {
      if (e.role.trim().length < 2) local[`work.${i}.role`] = "Lavozimni yozing";
      if (e.company.trim().length < 2) local[`work.${i}.company`] = "Kompaniya yoki loyihani yozing";
      if (!yearOk(e.fromYear)) local[`work.${i}.fromYear`] = `1970–${thisYear + 1}`;
      if (e.toYear.trim() && (!yearOk(e.toYear) || toInt(e.toYear) < toInt(e.fromYear))) local[`work.${i}.toYear`] = "Boshlanishdan keyin, kelajakda emas";
    });
    f.education.forEach((e, i) => {
      if (e.school.trim().length < 2) local[`edu.${i}.school`] = "Muassasani yozing";
      if (e.degree.trim().length < 2) local[`edu.${i}.degree`] = "Yo'nalish/darajani yozing";
      if (!yearOk(e.fromYear)) local[`edu.${i}.fromYear`] = `1970–${thisYear + 1}`;
      if (e.toYear.trim() && (!yearOk(e.toYear) || toInt(e.toYear) < toInt(e.fromYear))) local[`edu.${i}.toYear`] = "Boshlanishdan keyin, kelajakda emas";
    });
    if (Object.keys(local).length) {
      setErrors(local);
      setError("Ba'zi maydonlarni tekshiring");
      const firstKey = Object.keys(local)[0];
      goToSection(firstKey.startsWith("pkg.") ? "pf-paketlar" : firstKey.startsWith("cert.") ? "pf-sertifikat" : firstKey.startsWith("work.") || firstKey.startsWith("edu.") ? "pf-tajriba" : (FIELD_SECTION[firstKey] ?? SECTIONS[0].id));
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
          // So'mdagi ekvivalent (USD rejimida server kurs bo'yicha qayta hisoblaydi); USD — asl summalar alohida
          priceFrom: priceFromUzs,
          priceTo: f.priceTo.trim() ? priceToUzs : null,
          priceCurrency: f.currency,
          priceUsdFrom: usdMode ? priceFromNum : null,
          priceUsdTo: usdMode && f.priceTo.trim() ? priceToNum : null,
          experience: f.experience,
          skills: f.skills,
          equipment: f.equipment,
          languages: f.languages,
          telegram: f.telegram.trim().replace(/^@/, ""),
          instagram: f.instagram.trim().replace(/^@/, ""),
          youtube: f.youtube.trim(),
          website: f.website.trim(),
          coverUrl: f.coverUrl.trim(),
          isAvailable: f.isAvailable,
          workTypes: f.workTypes,
          rates: {
            hourly: toInt(f.rates.hourly) > 0 ? toInt(f.rates.hourly) : null,
            daily: toInt(f.rates.daily) > 0 ? toInt(f.rates.daily) : null,
            project: toInt(f.rates.project) > 0 ? toInt(f.rates.project) : null,
            unit: toInt(f.rates.unit) > 0 ? toInt(f.rates.unit) : null,
          },
          packages: f.packages
            .filter((p) => p.enabled)
            .map((p) => ({
              key: p.key,
              title: p.title.trim(),
              price: toInt(p.price),
              deliveryDays: toInt(p.deliveryDays),
              revisions: toInt(p.revisions) || 0,
              features: p.features.map((x) => x.trim()).filter(Boolean).slice(0, MAX_PACKAGE_FEATURES),
            })),
          certificates: f.certificates.map((c) => ({ title: c.title.trim(), issuer: c.issuer.trim(), year: toInt(c.year), url: c.url.trim() })),
          workHistory: f.workHistory.map((e) => ({ role: e.role.trim(), company: e.company.trim(), fromYear: toInt(e.fromYear), toYear: e.toYear.trim() ? toInt(e.toYear) : null, description: e.description.trim() })),
          education: f.education.map((e) => ({ school: e.school.trim(), degree: e.degree.trim(), fromYear: toInt(e.fromYear), toYear: e.toYear.trim() ? toInt(e.toYear) : null })),
        }),
      });
      const json = (await res.json()) as ApiResponse<{ id: string; slug: string }>;
      if (!json.ok) {
        setError(json.error);
        if (json.fields) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(json.fields)) {
            mapped[k.split(".")[0]] = v;
            mapped[k] = v;
          }
          setErrors(mapped);
          const first = Object.keys(mapped).find((k) => FIELD_SECTION[k]);
          if (first) {
            goToSection(FIELD_SECTION[first]);
            return;
          }
        }
        topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      setSavedSlug(json.data.slug);
      clearDraft(draftKey);
      setDraftRestored(false);
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
      <div id="mutaxassis" className="card relative scroll-mt-28 overflow-hidden p-6 sm:p-8">
        <span className="eyebrow">Ijodkorlar uchun</span>
        <h2 className="mt-4 font-display text-[24px] font-semibold leading-tight tracking-tight text-fg sm:text-[30px]">
          Mutaxassis <span className="accent-serif text-accent">bo'lish</span>
        </h2>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-fg-2">
          Videograf, montajor, dizaynermisiz? Profil oching — mijozlar sizni xaritadan topadi, buyurtmalar to'g'ridan-to'g'ri kabinetingizga keladi. Bepul.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {["Portfolio", "Narxlar", "Sharhlar", "Xaritada ko'rinish"].map((t) => (
            <li key={t} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] font-medium text-fg-2">
              <CheckCircle2 size={12} className="text-accent" /> {t}
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
    <form ref={topRef} id="mutaxassis" onSubmit={submit} className="card scroll-mt-28 p-5 sm:p-6" noValidate aria-busy={busy}>
      {/* Sarlavha */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="btn-ink flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]">
            <Briefcase size={18} />
          </span>
          <div>
            <h2 className="font-display text-[19px] font-semibold tracking-tight text-fg">{mode === "edit" ? "Mutaxassis profili" : "Mutaxassis profilini yaratish"}</h2>
            <p className="mt-0.5 text-[13px] text-fg-3">
              {mode === "edit" ? "Bu ma'lumotlar ommaviy profilingizda va xaritada ko'rinadi." : "Yo'nalish, hudud va narxlarni kiriting — profilingiz xaritada paydo bo'ladi."}
            </p>
          </div>
        </div>
        {initial && (
          <ButtonLink href={`/mutaxassislar/${initial.slug}`} variant="outline" size="sm" className="shrink-0">
            Ommaviy profil <ArrowUpRight size={14} />
          </ButtonLink>
        )}
      </div>

      {/* Muvaffaqiyat */}
      {savedSlug && (
        <div
          role="status"
          className="card-outline mt-5 flex flex-col gap-3 !rounded-[18px] p-4 animate-fade-up sm:flex-row sm:items-center sm:justify-between"
          style={{ animationDuration: "0.35s" }}
        >
          <p className="flex items-center gap-2 text-[14px] font-semibold text-fg">
            <CheckCircle2 size={18} className="text-success-text" />
            {mode === "edit" ? "Profil saqlandi" : "Profil yaratildi! Endi portfolio qo'shing."}
          </p>
          <div className="flex gap-2">
            {/* text-accent-text: 13px matn uchun to'qroq coral (AA) */}
            <Link href={`/mutaxassislar/${savedSlug}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent-text transition hover:opacity-80">
              Ommaviy profilni ko'rish <ArrowUpRight size={14} />
            </Link>
            {mode === "create" && (
              <Link href="/kabinet/portfolio" className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent-text transition hover:opacity-80">
                Portfolio <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
      )}

      {draftRestored && (
        <div role="status" className="expand-in mt-5 flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-line bg-surface-2 px-4 py-2.5 text-[13px] text-fg">
          <span>
            <span className="font-semibold">Qoralama tiklandi</span> <span className="text-fg-3">— oxirgi marta saqlanmagan o&apos;zgarishlaringiz.</span>
          </span>
          <button type="button" onClick={discardDraft} className="press inline-flex min-h-8 items-center rounded-full px-3 text-[12.5px] font-semibold text-fg-2 transition hover:bg-fg/6 hover:text-fg">
            Bekor qilish
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-5 inline-flex items-center gap-2 rounded-full bg-danger-soft px-3.5 py-2 text-[13px] font-medium text-danger-text">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Yopishqoq bo'limlar navigatsiyasi + to'liqlik (E95) */}
      <div className="sticky top-[76px] z-20 -mx-5 mt-5 border-y border-line bg-surface px-5 py-2 sm:top-[88px] sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex shrink-0 items-center gap-2" title="Profil to'liqligi">
            <span className="text-[12px] font-bold tabular-nums text-fg">{progress}%</span>
            <div
              className="h-1.5 w-12 overflow-hidden rounded-full bg-fg/8 sm:w-20"
              role="progressbar"
              aria-label="Profil to'liqligi"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div className={cn("h-full rounded-full transition-all duration-500", progress === 100 ? "bg-success" : "bg-accent")} style={{ width: `${progress}%` }} />
            </div>
          </div>
          <nav ref={sectionNavRef} aria-label="Profil bo'limlari" className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
            <ul className="flex w-max gap-1">
              {SECTIONS.map((x) => {
                const active = activeSection === x.id;
                const done = x.id !== "pf-holat" && sectionDone[x.id];
                return (
                  <li key={x.id}>
                    <button
                      type="button"
                      data-section={x.id}
                      onClick={() => {
                        setActiveSection(x.id);
                        goToSection(x.id);
                      }}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold transition active:scale-[0.97]",
                        active ? "btn-ink" : "text-fg-2 hover:bg-fg/6 hover:text-fg",
                      )}
                    >
                      {done && <CheckCircle2 size={12} className={active ? undefined : "text-success"} aria-hidden="true" />}
                      {x.label}
                      {done && <span className="sr-only"> (to'ldirilgan)</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {/* ============ Asosiy ============ */}
        <Section id="pf-asosiy" next={nextOf("pf-asosiy")} icon={Sparkles} title="Asosiy ma'lumotlar" hint="Sarlavha va yo'nalish — mijoz birinchi ko'radigan narsa">
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
            <CategoryField value={f.category} onChange={(slug) => set({ category: slug })} title="Kasbingizni tanlang" />
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
            {errors.workHistory && <p className="field-error">{errors.workHistory}</p>}
          </div>
        </Section>

        {/* ============ Hudud ============ */}
        <Section id="pf-hudud" next={nextOf("pf-hudud")} icon={MapPin} title="Hudud" hint="Xaritada shu hududda ko'rinasiz">
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
        <Section id="pf-haqida" next={nextOf("pf-haqida")} icon={Tags} title="O'zingiz haqingizda" hint="Tajriba, uslub, jihozlar va ish jarayoni — mijoz ishonchini oshiradigan narsalar">
          <div>
            <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
              <label htmlFor="pf-bio" className="field-label !mb-0">
                Bio
              </label>
              <span className="text-[12px] text-fg-4">Yangi qatorlar profilda saqlanadi</span>
            </div>
            <textarea
              id="pf-bio"
              ref={bioRef}
              className="field min-h-[160px] resize-none leading-relaxed"
              value={f.bio}
              onChange={(e) => {
                set({ bio: e.target.value.slice(0, MAX_BIO) });
                autosize(e.target);
              }}
              maxLength={MAX_BIO}
              placeholder={
                "Masalan:\n9 yildan beri to'y va reklama videolarini suratga olaman. Uslubim — kinematik, tabiiy yorug'lik va jonli hissiyotlar.\n\nJihozlar: Sony FX3, 24–70 f/2.8, DJI Mavic 3. Montaj — DaVinci Resolve.\n\nIsh jarayoni: brif → suratga olish → 7 kun ichida montaj → 2 marta tuzatish."
              }
              aria-invalid={Boolean(errors.bio)}
              aria-describedby="pf-bio-hint"
            />
            <div className="mt-1 flex items-start justify-between gap-3">
              {errors.bio ? (
                <p className="field-error !mt-0">{errors.bio}</p>
              ) : (
                <span id="pf-bio-hint" className="text-[12px] text-fg-4">
                  {f.bio.trim().length < 80 ? "Kamida 2–3 jumla yozing — to'liq bio ishonchni oshiradi." : "Zo'r! Qisqa abzatslar o'qishni osonlashtiradi."}
                </span>
              )}
              <span className={cn("shrink-0 text-[12px] tabular-nums", f.bio.length > MAX_BIO - 100 ? "text-warning-text" : "text-fg-4")}>
                {f.bio.length}/{MAX_BIO}
              </span>
            </div>
            {/* Yordamchi andozalar */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1 text-[12px] font-semibold text-fg-3">
                <Sparkles size={12} className="text-accent" /> Nima yozsam bo'ladi?
              </span>
              {BIO_PROMPTS.map((pr) => {
                const used = f.bio.includes(pr.text.split(":")[0] + ":");
                return (
                  <button
                    key={pr.key}
                    type="button"
                    disabled={used || f.bio.length + pr.text.length + 2 > MAX_BIO}
                    onClick={() => {
                      const sep = f.bio.trim() ? "\n\n" : "";
                      set({ bio: (f.bio.trimEnd() + sep + pr.text).slice(0, MAX_BIO) });
                      window.requestAnimationFrame(() => {
                        autosize(bioRef.current);
                        bioRef.current?.focus();
                      });
                    }}
                    className="inline-flex min-h-8 items-center gap-1 rounded-full border border-line px-3 text-[12px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg active:scale-95 disabled:opacity-40"
                  >
                    <Plus size={11} /> {pr.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ko'nikmalar */}
          <div className="mt-5">
            <label htmlFor="pf-skill" className="field-label">
              Ko'nikmalar <span className="font-normal text-fg-4">({f.skills.length}/{MAX_SKILLS})</span>
            </label>
            <div
              className={cn("field flex flex-wrap items-center gap-2 !py-2", f.skills.length >= MAX_SKILLS && "opacity-80")}
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
                  className="inline-flex min-h-8 items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1.5 text-[12px] font-semibold text-accent-text transition hover:brightness-110 active:scale-95"
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
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addSkill(s)}
                    className="inline-flex min-h-8 items-center gap-1 rounded-full bg-fg/6 px-2.5 py-1.5 text-[12px] font-medium text-fg-2 transition hover:bg-fg/10 active:scale-95"
                  >
                    <Plus size={11} /> {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ish turlari (F52) */}
          <div className="mt-5">
            <span className="field-label">
              Ish turlari <span className="font-normal text-fg-4">(qaysi loyihalar bilan ishlaysiz)</span>
            </span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Ish turlari">
              {WORK_TYPES.map((w) => {
                const on = f.workTypes.includes(w.slug);
                return (
                  <button
                    key={w.slug}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ workTypes: on ? f.workTypes.filter((x) => x !== w.slug) : [...f.workTypes, w.slug] })}
                    className={cn(
                      "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition active:scale-95",
                      on ? "btn-ink" : "border border-line bg-surface text-fg-2 hover:border-fg hover:text-fg",
                    )}
                  >
                    {on && <CheckCircle2 size={13} />}
                    {w.label}
                  </button>
                );
              })}
            </div>
            {errors.workTypes ? <p className="field-error">{errors.workTypes}</p> : <p className="mt-1 text-[12px] text-fg-4">Mijozlar ro'yxatda «Ish turi» bo'yicha filtrlaydi.</p>}
          </div>

          {/* Jihozlar (F51) */}
          <div className="mt-5">
            <label htmlFor="pf-equipment" className="field-label">
              <Wrench size={13} className="mr-1 inline -mt-0.5 text-accent" />
              Jihozlar <span className="font-normal text-fg-4">({f.equipment.length}/{MAX_EQUIPMENT})</span>
            </label>
            <ChipInput
              id="pf-equipment"
              values={f.equipment}
              onChange={(equipment) => set({ equipment })}
              max={MAX_EQUIPMENT}
              placeholder="Masalan: Sony A7IV — Enter bilan qo'shing"
              suggestions={equipmentSuggestions}
            />
            {errors.equipment ? <p className="field-error">{errors.equipment}</p> : <p className="mt-1 text-[12px] text-fg-4">Kamera, dron, stabilizator, yorug'lik yoki dasturiy-texnik jihozlar. Mijozlar jihoz bo'yicha qidira oladi.</p>}
          </div>

          {/* Tillar */}
          <div className="mt-5">
            <span className="field-label">
              <Languages size={13} className="mr-1 inline -mt-0.5 text-accent" />
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
                      on ? "btn-ink" : "border border-line bg-surface text-fg-2 hover:border-fg hover:text-fg",
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
        <Section id="pf-narx" next={nextOf("pf-narx")} icon={Wallet} title="Narxlar" hint={`Minimal narx — ${formatPrice(PRICE_MIN)} (yoki $${PRICE_MIN_USD}). Diapazon ko'rsatsangiz, mijozga tushunarli bo'ladi`}>
          {/* Valyuta: so'm yoki dollar */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="field-label !mb-0">Valyuta</span>
            <div role="radiogroup" aria-label="Narx valyutasi" className="segment">
              {(
                [
                  { v: "UZS", label: "So'm" },
                  { v: "USD", label: "Dollar ($)" },
                ] as const
              ).map((c) => (
                <button
                  key={c.v}
                  type="button"
                  role="radio"
                  aria-checked={f.currency === c.v}
                  data-active={f.currency === c.v}
                  onClick={() => {
                    if (f.currency === c.v) return;
                    // Valyuta almashganda mavjud summalar kurs bo'yicha o'giriladi (yumaloqlab)
                    const conv = (txt: string) => {
                      const n = parseMoney(txt);
                      if (!n) return "";
                      return groupDigits(String(c.v === "USD" ? Math.max(PRICE_MIN_USD, Math.round(n / usdRate)) : Math.round((n * usdRate) / 50_000) * 50_000));
                    };
                    set({ currency: c.v, priceFrom: conv(f.priceFrom), priceTo: conv(f.priceTo) });
                  }}
                  className="segment-item min-h-[38px] !px-4"
                >
                  {c.label}
                </button>
              ))}
            </div>
            {usdMode && <span className="text-[12px] text-fg-3">Kurs: 1 $ ≈ {formatPrice(usdRate)} — katalogda so'mdagi ekvivalenti bilan saralanadi</span>}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="pf-price-from" className="field-label">
                Minimal narx
              </label>
              <MoneyInput id="pf-price-from" value={f.priceFrom} onChange={(v) => set({ priceFrom: v })} placeholder={usdMode ? "50" : "500 000"} suffix={usdMode ? "$" : "so'm"} aria-invalid={Boolean(errors.priceFrom)} />
              {errors.priceFrom && <p className="field-error">{errors.priceFrom}</p>}
            </div>
            <div>
              <label htmlFor="pf-price-to" className="field-label">
                Maksimal narx <span className="font-normal text-fg-4">(ixtiyoriy)</span>
              </label>
              <MoneyInput id="pf-price-to" value={f.priceTo} onChange={(v) => set({ priceTo: v })} placeholder={usdMode ? "300" : "3 000 000"} suffix={usdMode ? "$" : "so'm"} aria-invalid={Boolean(errors.priceTo)} />
              {errors.priceTo && <p className="field-error">{errors.priceTo}</p>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-fg/6 px-3 py-1 text-[12px] font-medium text-fg-2">
              Profilda: <span className="font-semibold text-fg">{priceHint}</span>
            </p>
            {/* Bozor tahlili: kasb × tajriba × hudud bo'yicha tavsiya — bir bosishda qo'llanadi */}
            <button
              type="button"
              onClick={() => set({ priceFrom: groupDigits(String(sugFrom)), priceTo: groupDigits(String(sugTo)) })}
              className="press inline-flex items-center gap-1.5 rounded-full border border-dashed border-accent/50 px-3 py-1 text-[12px] font-semibold text-accent-text transition hover:bg-accent-soft/50"
            >
              <Sparkles size={12} aria-hidden="true" /> Bozor tavsiyasi: {usdMode ? `$${groupDigits(String(sugFrom))} – $${groupDigits(String(sugTo))}` : `${formatPrice(sugFrom)} – ${formatPrice(sugTo)}`}
            </button>
          </div>

          {/* Tariflar (F70) — profildagi narx kalkulyatori shulardan hisoblaydi */}
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-[14px] font-semibold text-fg">Tariflar <span className="font-normal text-fg-4">(ixtiyoriy)</span></p>
            <p className="mt-0.5 text-[12px] text-fg-3">Profilda «Narx kalkulyatori» chiqadi: mijoz soat, kun yoki dona sonini kiritib taxminiy narxni ko'radi.</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  { k: "hourly", label: "Soatbay", ph: "200 000" },
                  { k: "daily", label: "Kunbay", ph: "1 500 000" },
                  { k: "project", label: "Loyihabay (dan)", ph: "3 000 000" },
                  { k: "unit", label: "Donabay (1 dona ish)", ph: "150 000" },
                ] as const
              ).map((r) => (
                <div key={r.k}>
                  <label htmlFor={`pf-rate-${r.k}`} className="field-label">
                    {r.label}
                  </label>
                  <MoneyInput id={`pf-rate-${r.k}`} className="pr-14" value={f.rates[r.k]} onChange={(v) => set({ rates: { ...f.rates, [r.k]: v } })} placeholder={r.ph} />
                </div>
              ))}
            </div>
            {errors.rates && <p className="field-error">{errors.rates}</p>}
          </div>
        </Section>

        {/* ============ Paketlar (F31) ============ */}
        <Section
          id="pf-paketlar"
          next={nextOf("pf-paketlar")}
          icon={Package}
          title="Xizmat paketlari"
          hint="3 tagacha tayyor paket — mijoz narx va muddatni darhol ko'radi, «Tanlash» bilan buyurtma beradi"
        >
          <div className="space-y-3">
            {f.packages.map((p) => {
              const tier = PACKAGE_TIERS.find((t) => t.key === p.key)?.label ?? p.key;
              const err = (k: string) => errors[`pkg.${p.key}.${k}`];
              return (
                <div key={p.key} className={cn("card-outline !rounded-[var(--r-md)] p-4", p.enabled && "ring-1 ring-fg/10")}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-semibold text-fg">{tier}</p>
                      <p className="text-[12px] text-fg-3">{p.enabled ? "Profilda ko'rinadi" : "O'chirilgan"}</p>
                    </div>
                    <Switch checked={p.enabled} onChange={(v) => togglePkg(p.key, v)} label={`${tier} paketi`} />
                  </div>
                  {p.enabled && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label htmlFor={`pf-pkg-${p.key}-title`} className="field-label">
                          Paket nomi
                        </label>
                        <input
                          id={`pf-pkg-${p.key}-title`}
                          className="field"
                          value={p.title}
                          maxLength={60}
                          onChange={(e) => setPkg(p.key, { title: e.target.value })}
                          placeholder="Masalan: 30 soniyalik reklama roligi"
                          aria-invalid={Boolean(err("title"))}
                        />
                        {err("title") && <p className="field-error">{err("title")}</p>}
                      </div>
                      <div>
                        <label htmlFor={`pf-pkg-${p.key}-price`} className="field-label">
                          Narx
                        </label>
                        <div className="relative">
                          <input
                            id={`pf-pkg-${p.key}-price`}
                            className="field pr-14"
                            type="number"
                            inputMode="numeric"
                            min={1000}
                            step={50000}
                            value={p.price}
                            onChange={(e) => setPkg(p.key, { price: e.target.value })}
                            placeholder="1 500 000"
                            aria-invalid={Boolean(err("price"))}
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[13px] font-medium text-fg-3">so'm</span>
                        </div>
                        {err("price") && <p className="field-error">{err("price")}</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor={`pf-pkg-${p.key}-days`} className="field-label">
                            Muddat (kun)
                          </label>
                          <input
                            id={`pf-pkg-${p.key}-days`}
                            className="field"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={365}
                            value={p.deliveryDays}
                            onChange={(e) => setPkg(p.key, { deliveryDays: e.target.value })}
                            placeholder="7"
                            aria-invalid={Boolean(err("deliveryDays"))}
                          />
                          {err("deliveryDays") && <p className="field-error">{err("deliveryDays")}</p>}
                        </div>
                        <div>
                          <label htmlFor={`pf-pkg-${p.key}-rev`} className="field-label">
                            Tuzatishlar
                          </label>
                          <input
                            id={`pf-pkg-${p.key}-rev`}
                            className="field"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={20}
                            value={p.revisions}
                            onChange={(e) => setPkg(p.key, { revisions: e.target.value })}
                            placeholder="2"
                            aria-invalid={Boolean(err("revisions"))}
                          />
                          {err("revisions") && <p className="field-error">{err("revisions")}</p>}
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="field-label">
                          Nimalar kiradi <span className="font-normal text-fg-4">({p.features.length}/{MAX_PACKAGE_FEATURES})</span>
                        </span>
                        <ul className="space-y-2">
                          {p.features.map((feat, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <input
                                className="field"
                                value={feat}
                                maxLength={80}
                                onChange={(e) => setPkg(p.key, { features: p.features.map((x, j) => (j === i ? e.target.value : x)) })}
                                placeholder="Masalan: Musiqa va ovoz effektlari"
                                aria-label={`${tier}: imkoniyat ${i + 1}`}
                              />
                              <button
                                type="button"
                                onClick={() => setPkg(p.key, { features: p.features.filter((_, j) => j !== i) })}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-danger-soft hover:text-danger-text"
                                aria-label={`${i + 1}-imkoniyatni olib tashlash`}
                              >
                                <X size={16} />
                              </button>
                            </li>
                          ))}
                        </ul>
                        {p.features.length < MAX_PACKAGE_FEATURES && (
                          <button
                            type="button"
                            onClick={() => setPkg(p.key, { features: [...p.features, ""] })}
                            className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-dashed border-line-2 px-3.5 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg"
                          >
                            <Plus size={14} /> Imkoniyat qo'shish
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {errors.packages && <p className="field-error">{errors.packages}</p>}
          <p className="mt-2 text-[12px] text-fg-4">Minimal narx bo'sh bo'lsa, profilda eng arzon paket narxi «… dan» bo'lib ko'rinadi.</p>
        </Section>

        {/* ============ Sertifikatlar (F64) ============ */}
        <Section
          id="pf-sertifikat"
          next={nextOf("pf-sertifikat")}
          icon={BadgeCheck}
          title="Sertifikatlar va litsenziyalar"
          hint="Kurslar, diplomlar, dron uchish ruxsatnomasi — ishonchni oshiradi"
        >
          {f.certificates.length > 0 && (
            <ul className="space-y-3">
              {f.certificates.map((c, i) => {
                const err = (k: string) => errors[`cert.${i}.${k}`] ?? errors[`certificates.${i}.${k}`];
                return (
                  <li key={i} className="card-outline !rounded-[var(--r-md)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-semibold text-fg-2">Sertifikat {i + 1}</p>
                      <button
                        type="button"
                        onClick={() => set({ certificates: f.certificates.filter((_, j) => j !== i) })}
                        className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold text-fg-3 transition hover:bg-danger-soft hover:text-danger-text"
                      >
                        <Trash2 size={14} /> O'chirish
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label htmlFor={`pf-cert-${i}-title`} className="field-label">
                          Nomi
                        </label>
                        <input
                          id={`pf-cert-${i}-title`}
                          className="field"
                          value={c.title}
                          maxLength={100}
                          onChange={(e) => setCert(i, { title: e.target.value })}
                          placeholder="Masalan: Dron uchish ruxsatnomasi"
                          aria-invalid={Boolean(err("title"))}
                        />
                        {err("title") && <p className="field-error">{err("title")}</p>}
                      </div>
                      <div>
                        <label htmlFor={`pf-cert-${i}-issuer`} className="field-label">
                          Kim bergan
                        </label>
                        <input
                          id={`pf-cert-${i}-issuer`}
                          className="field"
                          value={c.issuer}
                          maxLength={100}
                          onChange={(e) => setCert(i, { issuer: e.target.value })}
                          placeholder="Masalan: Aviatsiya agentligi"
                          aria-invalid={Boolean(err("issuer"))}
                        />
                        {err("issuer") && <p className="field-error">{err("issuer")}</p>}
                      </div>
                      <div>
                        <label htmlFor={`pf-cert-${i}-year`} className="field-label">
                          Yil
                        </label>
                        <input
                          id={`pf-cert-${i}-year`}
                          className="field"
                          type="number"
                          inputMode="numeric"
                          min={1970}
                          max={thisYear + 1}
                          value={c.year}
                          onChange={(e) => setCert(i, { year: e.target.value })}
                          placeholder={String(thisYear)}
                          aria-invalid={Boolean(err("year"))}
                        />
                        {err("year") && <p className="field-error">{err("year")}</p>}
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor={`pf-cert-${i}-url`} className="field-label">
                          Havola <span className="font-normal text-fg-4">(ixtiyoriy, https://)</span>
                        </label>
                        <input
                          id={`pf-cert-${i}-url`}
                          className="field"
                          type="url"
                          inputMode="url"
                          value={c.url}
                          maxLength={300}
                          onChange={(e) => setCert(i, { url: e.target.value })}
                          placeholder="https://"
                          aria-invalid={Boolean(err("url"))}
                        />
                        {err("url") && <p className="field-error">{err("url")}</p>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {f.certificates.length < MAX_CERTIFICATES && (
            <button
              type="button"
              onClick={() => set({ certificates: [...f.certificates, { title: "", issuer: "", year: String(thisYear), url: "" }] })}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-line-2 px-4 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg",
                f.certificates.length > 0 && "mt-3",
              )}
            >
              <Plus size={14} /> Sertifikat qo'shish
            </button>
          )}
          {errors.certificates && <p className="field-error">{errors.certificates}</p>}
        </Section>

        {/* ============ Tajriba va ta'lim (LinkedIn uslubi) ============ */}
        <Section id="pf-tajriba" next={nextOf("pf-tajriba")} icon={Briefcase} title="Tajriba va ta'lim" hint="Qayerda ishlagansiz, nimani o'qigansiz — profil «Haqida» bo'limi ostida chiqadi">
          <p className="flex items-center gap-2 text-[13px] font-bold text-fg">
            <Briefcase size={14} className="text-fg-3" /> Ish tajribasi
          </p>
          {f.workHistory.length > 0 && (
            <ul className="mt-3 space-y-3">
              {f.workHistory.map((e, i) => {
                const err = (k: string) => errors[`work.${i}.${k}`] ?? errors[`workHistory.${i}.${k}`];
                return (
                  <li key={i} className="card-outline !rounded-[var(--r-md)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-semibold text-fg-2">Tajriba {i + 1}</p>
                      <button type="button" onClick={() => set({ workHistory: f.workHistory.filter((_, j) => j !== i) })} className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold text-fg-3 transition hover:bg-danger-soft hover:text-danger-text">
                        <Trash2 size={14} /> O'chirish
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor={`pf-exp-${i}-role`} className="field-label">
                          Lavozim
                        </label>
                        <input id={`pf-exp-${i}-role`} className="field" value={e.role} maxLength={100} onChange={(ev) => setWork(i, { role: ev.target.value })} placeholder="Masalan: Montajor" aria-invalid={Boolean(err("role"))} />
                        {err("role") && <p className="field-error">{err("role")}</p>}
                      </div>
                      <div>
                        <label htmlFor={`pf-exp-${i}-company`} className="field-label">
                          Kompaniya / loyiha
                        </label>
                        <input id={`pf-exp-${i}-company`} className="field" value={e.company} maxLength={100} onChange={(ev) => setWork(i, { company: ev.target.value })} placeholder="Masalan: Sevimli TV" aria-invalid={Boolean(err("company"))} />
                        {err("company") && <p className="field-error">{err("company")}</p>}
                      </div>
                      <div>
                        <label htmlFor={`pf-exp-${i}-from`} className="field-label">
                          Boshlanish yili
                        </label>
                        <input id={`pf-exp-${i}-from`} className="field" type="number" inputMode="numeric" min={1970} max={thisYear + 1} value={e.fromYear} onChange={(ev) => setWork(i, { fromYear: ev.target.value })} aria-invalid={Boolean(err("fromYear"))} />
                        {err("fromYear") && <p className="field-error">{err("fromYear")}</p>}
                      </div>
                      <div>
                        <label htmlFor={`pf-exp-${i}-to`} className="field-label">
                          Tugash yili <span className="font-normal text-fg-4">(bo'sh — hozirgacha)</span>
                        </label>
                        <input id={`pf-exp-${i}-to`} className="field" type="number" inputMode="numeric" min={1970} max={thisYear + 1} value={e.toYear} onChange={(ev) => setWork(i, { toYear: ev.target.value })} placeholder="hozirgacha" aria-invalid={Boolean(err("toYear"))} />
                        {err("toYear") && <p className="field-error">{err("toYear")}</p>}
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor={`pf-exp-${i}-desc`} className="field-label">
                          Qisqa tavsif <span className="font-normal text-fg-4">(ixtiyoriy)</span>
                        </label>
                        <textarea id={`pf-exp-${i}-desc`} className="field min-h-[64px] resize-y" value={e.description} maxLength={300} onChange={(ev) => setWork(i, { description: ev.target.value })} placeholder="Nima qildingiz, qanday natija?" />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {f.workHistory.length < MAX_EXPERIENCE && (
            <button
              type="button"
              onClick={() => set({ workHistory: [...f.workHistory, { role: "", company: "", fromYear: String(thisYear), toYear: "", description: "" }] })}
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-line-2 px-4 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg"
            >
              <Plus size={14} /> Tajriba qo'shish
            </button>
          )}
          {errors.workHistory && <p className="field-error">{errors.workHistory}</p>}

          <p className="mt-6 flex items-center gap-2 text-[13px] font-bold text-fg">
            <GraduationCap size={14} className="text-fg-3" /> Ta'lim
          </p>
          {f.education.length > 0 && (
            <ul className="mt-3 space-y-3">
              {f.education.map((e, i) => {
                const err = (k: string) => errors[`edu.${i}.${k}`] ?? errors[`education.${i}.${k}`];
                return (
                  <li key={i} className="card-outline !rounded-[var(--r-md)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-semibold text-fg-2">Ta'lim {i + 1}</p>
                      <button type="button" onClick={() => set({ education: f.education.filter((_, j) => j !== i) })} className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold text-fg-3 transition hover:bg-danger-soft hover:text-danger-text">
                        <Trash2 size={14} /> O'chirish
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor={`pf-edu-${i}-school`} className="field-label">
                          Muassasa
                        </label>
                        <input id={`pf-edu-${i}-school`} className="field" value={e.school} maxLength={120} onChange={(ev) => setEdu(i, { school: ev.target.value })} placeholder="Masalan: O'zDSMI" aria-invalid={Boolean(err("school"))} />
                        {err("school") && <p className="field-error">{err("school")}</p>}
                      </div>
                      <div>
                        <label htmlFor={`pf-edu-${i}-degree`} className="field-label">
                          Yo'nalish / daraja
                        </label>
                        <input id={`pf-edu-${i}-degree`} className="field" value={e.degree} maxLength={120} onChange={(ev) => setEdu(i, { degree: ev.target.value })} placeholder="Masalan: Kino va TV rejissyorligi, bakalavr" aria-invalid={Boolean(err("degree"))} />
                        {err("degree") && <p className="field-error">{err("degree")}</p>}
                      </div>
                      <div>
                        <label htmlFor={`pf-edu-${i}-from`} className="field-label">
                          Boshlanish yili
                        </label>
                        <input id={`pf-edu-${i}-from`} className="field" type="number" inputMode="numeric" min={1970} max={thisYear + 1} value={e.fromYear} onChange={(ev) => setEdu(i, { fromYear: ev.target.value })} aria-invalid={Boolean(err("fromYear"))} />
                        {err("fromYear") && <p className="field-error">{err("fromYear")}</p>}
                      </div>
                      <div>
                        <label htmlFor={`pf-edu-${i}-to`} className="field-label">
                          Tugash yili <span className="font-normal text-fg-4">(bo'sh — o'qimoqda)</span>
                        </label>
                        <input id={`pf-edu-${i}-to`} className="field" type="number" inputMode="numeric" min={1970} max={thisYear + 1} value={e.toYear} onChange={(ev) => setEdu(i, { toYear: ev.target.value })} placeholder="o'qimoqda" aria-invalid={Boolean(err("toYear"))} />
                        {err("toYear") && <p className="field-error">{err("toYear")}</p>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {f.education.length < MAX_EDUCATION && (
            <button
              type="button"
              onClick={() => set({ education: [...f.education, { school: "", degree: "", fromYear: String(thisYear - 4), toYear: String(thisYear) }] })}
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-line-2 px-4 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg"
            >
              <Plus size={14} /> Ta'lim qo'shish
            </button>
          )}
          {errors.education && <p className="field-error">{errors.education}</p>}
        </Section>

        {/* ============ Aloqa ============ */}
        <Section id="pf-aloqa" next={nextOf("pf-aloqa")} icon={Send} title="Aloqa va havolalar" hint="Mijozlar siz bilan qanday bog'lanadi">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="pf-telegram" className="field-label !mb-0">
                  Telegram
                </label>
                {visibility && <VisibilityChip level={visibility.telegram} />}
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[15px] font-medium text-fg-3">@</span>
                <input id="pf-telegram" className="field pl-9" value={f.telegram} onChange={(e) => set({ telegram: e.target.value })} maxLength={60} placeholder="username" autoComplete="off" aria-invalid={Boolean(errors.telegram)} />
              </div>
              {errors.telegram && <p className="field-error">{errors.telegram}</p>}
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="pf-instagram" className="field-label !mb-0">
                  <Instagram size={13} className="mr-1 inline -mt-0.5 text-fg-3" />
                  Instagram
                </label>
                {visibility && <VisibilityChip level={visibility.instagram} />}
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[15px] font-medium text-fg-3">@</span>
                <input id="pf-instagram" className="field pl-9" value={f.instagram} onChange={(e) => set({ instagram: e.target.value })} maxLength={60} placeholder="username" autoComplete="off" aria-invalid={Boolean(errors.instagram)} />
              </div>
              {errors.instagram && <p className="field-error">{errors.instagram}</p>}
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="pf-youtube" className="field-label !mb-0">
                  <Youtube size={13} className="mr-1 inline -mt-0.5 text-fg-3" />
                  YouTube kanal
                </label>
                {visibility && <VisibilityChip level={visibility.youtube} />}
              </div>
              <input id="pf-youtube" className="field" type="url" inputMode="url" value={f.youtube} onChange={(e) => set({ youtube: e.target.value })} maxLength={300} placeholder="https://youtube.com/@kanal" aria-invalid={Boolean(errors.youtube)} />
              {errors.youtube && <p className="field-error">{errors.youtube}</p>}
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="pf-website" className="field-label !mb-0">
                  <Globe size={13} className="mr-1 inline -mt-0.5 text-fg-3" />
                  Veb-sayt
                </label>
                {visibility && <VisibilityChip level={visibility.website} />}
              </div>
              <input id="pf-website" className="field" type="url" inputMode="url" value={f.website} onChange={(e) => set({ website: e.target.value })} maxLength={300} placeholder="https://" aria-invalid={Boolean(errors.website)} />
              {errors.website && <p className="field-error">{errors.website}</p>}
            </div>
          </div>
        </Section>

        {/* ============ Muqova ============ */}
        <Section id="pf-muqova" next={nextOf("pf-muqova")} icon={ImagePlus} title="Muqova rasmi" hint="Profil sarlavhasida keng rasm — yuklashda kesish oynasi 4:1 nisbatga o'zi moslaydi">
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
                <Button type="button" variant="outline" size="sm" onClick={() => coverRef.current?.click()} disabled={uploading}>
                  {uploading ? <Spinner /> : <Camera size={14} />} Rasm yuklash
                </Button>
                {f.coverUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => set({ coverUrl: "" })} className="text-danger-text hover:bg-danger-soft hover:text-danger-text">
                    <Trash2 size={14} /> Olib tashlash
                  </Button>
                )}
                <input
                  ref={coverRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-label="Muqova rasmini yuklash"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setCropCover(file);
                  }}
                />
              </div>
              <p className="mt-2 text-[12px] text-fg-4">JPG, PNG, WEBP · 5 MB gacha. Yuklashdan oldin rasmni surish va kattalashtirish mumkin.</p>
              {cropCover && (
                <ImageCropper
                  file={cropCover}
                  aspect={4}
                  outWidth={1600}
                  title="Muqovani moslang"
                  onCancel={() => setCropCover(null)}
                  onDone={(file) => {
                    setCropCover(null);
                    void uploadCover(file);
                  }}
                />
              )}
            </div>
            <div className="card-outline relative h-32 overflow-hidden !rounded-[18px] sm:h-full sm:min-h-[128px]">
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
        <Section id="pf-holat" icon={CheckCircle2} title="Holat">
          <div className="card-outline flex items-center justify-between gap-4 !rounded-[18px] px-4 py-3">
            <div>
              <p className="text-[15px] font-semibold text-fg">Buyurtma qabul qilaman</p>
              <p className="text-[12px] text-fg-3">{f.isAvailable ? "Profilda «Bo'sh» belgisi ko'rinadi." : "Profilda «Band» belgisi ko'rinadi, buyurtmalar navbatga tushadi."}</p>
            </div>
            <Switch checked={f.isAvailable} onChange={(v) => set({ isAvailable: v })} label="Buyurtma qabul qilish holati" />
          </div>
        </Section>
      </div>

      {/* Pastki panel */}
      <div className="mt-7 flex flex-col-reverse items-stretch gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[13px]" aria-live="polite">
          {savedSlug ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-success-text">
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

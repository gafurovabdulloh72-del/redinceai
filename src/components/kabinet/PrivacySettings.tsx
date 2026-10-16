"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Eye,
  EyeOff,
  ExternalLink,
  Globe,
  Handshake,
  Instagram,
  Lock,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Send,
  ShieldCheck,
  UserRound,
  Users,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { DEFAULT_VISIBILITY, VISIBILITY_FIELDS, VISIBILITY_LEVELS, type VisibilityFieldKey, type VisibilityLevelValue } from "@/lib/constants";
import { FORCED_ORDER_FIELDS, canView, type Viewer } from "@/lib/privacy";
import { cn } from "@/lib/utils";

type VisibilityState = Record<VisibilityFieldKey, VisibilityLevelValue>;
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

const FIELD_ICON: Record<VisibilityFieldKey, LucideIcon> = {
  phone: Phone,
  telegram: Send,
  instagram: Instagram,
  youtube: Youtube,
  website: Globe,
  email: Mail,
  schedule: CalendarClock,
  gender: UserRound,
  city: MapPin,
};

const LEVEL_ICON: Record<VisibilityLevelValue, LucideIcon> = {
  public: Globe,
  clients: Users,
  orders: Handshake,
  hidden: EyeOff,
};

/** Segmentdagi qisqa nom (to'liq nomi VISIBILITY_LEVELS'da) */
const LEVEL_SHORT: Record<VisibilityLevelValue, string> = {
  public: "Hammaga",
  clients: "Ro'yxatdan o'tganlar",
  orders: "Buyurtmachilar",
  hidden: "Yashirin",
};

/** Aloqa maydonlari (FORCED_ORDER_FIELDS) uchun platforma qoidasi izohi — public/clients tanlab bo'lmaydi */
const CONTACT_RULE_NOTE = "Platforma qoidasi: aloqa ma'lumotlari faqat buyurtma qabul qilingach ochiladi";
/** Aloqa maydonlarida tanlash mumkin bo'lgan darajalar: faqat "Buyurtmachilar" yoki "Yashirin" */
const CONTACT_LEVELS = VISIBILITY_LEVELS.filter((l) => l.value === "orders" || l.value === "hidden");

/** `short` — telefonda (390px) segment pill ichiga sig'ishi uchun qisqa nom; to'liq nomi aria-label/title'da */
const PREVIEW_AS: Array<{ key: "guest" | "client" | "order"; label: string; short?: string; viewer: Viewer }> = [
  { key: "guest", label: "Mehmon", viewer: { userId: null } },
  { key: "client", label: "Ro'yxatdan o'tgan", short: "Mijoz", viewer: { userId: "x", role: "client" } },
  { key: "order", label: "Buyurtmachi", viewer: { userId: "x", role: "client", hasOrder: true } },
];

export function PrivacySettings({
  initial,
  slug,
  present,
}: {
  initial: VisibilityState;
  slug: string;
  /** Qaysi maydonlar to'ldirilgan (bo'sh maydon uchun "ko'rsatilmagan" izohi) */
  present: Partial<Record<VisibilityFieldKey, boolean>>;
}) {
  const router = useRouter();
  const [v, setV] = useState<VisibilityState>(initial);
  const [previewAs, setPreviewAs] = useState<(typeof PREVIEW_AS)[number]["key"]>("guest");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = useMemo(() => VISIBILITY_FIELDS.some((f) => v[f.key] !== initial[f.key]), [v, initial]);
  const isDefault = VISIBILITY_FIELDS.every((f) => v[f.key] === DEFAULT_VISIBILITY[f.key]);

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), 4000);
    return () => window.clearTimeout(t);
  }, [saved]);

  const previewViewer = PREVIEW_AS.find((p) => p.key === previewAs)!.viewer;
  const previewRows = VISIBILITY_FIELDS.filter((f) => present[f.key] !== false).map((f) => ({ ...f, visible: canView(v[f.key], previewViewer) }));
  const hiddenNow = previewRows.filter((r) => !r.visible).length;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !dirty) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: v }),
      });
      const json = (await res.json()) as ApiResponse<{ visibility: VisibilityState }>;
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} id="maxfiylik" className="card scroll-mt-28 p-5 sm:p-7" noValidate>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="btn-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
            <ShieldCheck size={20} />
          </span>
          <div>
            <h2 className="font-display text-[20px] font-semibold tracking-tight text-fg">Maxfiylik</h2>
            <p className="mt-0.5 text-[13px] text-fg-3">
              Har bir shaxsiy maydon kimga ko'rinishini o'zingiz hal qilasiz. Aloqa ma'lumotlari (telefon, Telegram, Instagram, email) platforma qoidasiga ko'ra faqat
              buyurtma qabul qilingach ochiladi. Siz va admin hamma narsani ko'rasiz.
            </p>
          </div>
        </div>
        <a
          href={`/mutaxassislar/${slug}?preview=${previewAs}`}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-full border border-line-2 px-3.5 text-[13px] font-semibold text-fg transition hover:border-fg hover:bg-fg/4"
        >
          <Eye size={14} /> Sahifada ko'rish <ExternalLink size={12} className="text-fg-3" />
        </a>
      </div>

      {/* Daraja izohi */}
      <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {VISIBILITY_LEVELS.map((l) => {
          const Icon = LEVEL_ICON[l.value];
          return (
            <li key={l.value} className="card-outline flex items-start gap-2 !rounded-[16px] p-3">
              <Icon size={15} className="mt-0.5 shrink-0 text-accent" />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-fg">{LEVEL_SHORT[l.value]}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-fg-3">{l.description}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Maydonlar */}
      <div className="mt-5 divide-y divide-line border-t border-line">
        {VISIBILITY_FIELDS.map((f) => {
          const Icon = FIELD_ICON[f.key];
          const level = v[f.key];
          const has = present[f.key] !== false;
          // Platforma qoidasi: aloqa maydonlari faqat "orders" yoki "hidden" bo'la oladi
          const contactOnly = FORCED_ORDER_FIELDS.includes(f.key);
          const levels = contactOnly ? CONTACT_LEVELS : VISIBILITY_LEVELS;
          return (
            <div key={f.key} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]", level === "hidden" ? "bg-surface-3 text-fg-3" : "bg-accent-soft text-accent")}>
                  <Icon size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-fg">
                    {f.label}
                    {!has && <span className="ml-2 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-semibold text-fg-3">to'ldirilmagan</span>}
                  </p>
                  <p className="mt-0.5 text-[12px] text-fg-3">
                    {contactOnly && level !== "hidden" ? CONTACT_RULE_NOTE : VISIBILITY_LEVELS.find((l) => l.value === level)?.description}
                  </p>
                </div>
              </div>
              <div className="segment flex w-full shrink-0 sm:w-auto" role="radiogroup" aria-label={`${f.label} — kimga ko'rinadi`}>
                {levels.map((l) => {
                  const LIcon = LEVEL_ICON[l.value];
                  const active = level === l.value;
                  return (
                    <button
                      key={l.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={LEVEL_SHORT[l.value]}
                      title={LEVEL_SHORT[l.value]}
                      data-active={active}
                      onClick={() => setV((s) => ({ ...s, [f.key]: l.value }))}
                      className="segment-item inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 !px-2.5 sm:flex-none sm:!px-3"
                    >
                      <LIcon size={14} />
                      <span className="hidden lg:inline">{LEVEL_SHORT[l.value]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Jonli ko'rinish */}
      <div className="card-outline mt-5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[14px] font-semibold text-fg">
              <Eye size={15} className="text-accent" /> Profilingiz boshqalarga shunday ko'rinadi
            </p>
            <p className="mt-0.5 text-[12px] text-fg-3">
              {hiddenNow === 0 ? "Tanlangan ko'ruvchi hamma maydonni ko'radi." : `${hiddenNow} ta maydon bu ko'ruvchidan yashirin.`}
              {dirty && " Saqlanmagan o'zgarishlar hisobga olingan."}
            </p>
          </div>
          <div className="segment flex w-full sm:w-auto" role="radiogroup" aria-label="Kim sifatida ko'rish">
            {PREVIEW_AS.map((p) => (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={previewAs === p.key}
                data-active={previewAs === p.key}
                onClick={() => setPreviewAs(p.key)}
                aria-label={p.label}
                title={p.label}
                className="segment-item min-h-9 flex-1 !px-3 sm:flex-none"
              >
                {p.short ? (
                  <>
                    <span className="sm:hidden">{p.short}</span>
                    <span className="hidden sm:inline">{p.label}</span>
                  </>
                ) : (
                  p.label
                )}
              </button>
            ))}
          </div>
        </div>
        <ul className="mt-4 grid gap-1.5 sm:grid-cols-3">
          {previewRows.map((r) => {
            const Icon = FIELD_ICON[r.key];
            return (
              <li key={r.key} className={cn("flex items-center gap-2 rounded-[12px] px-3 py-2 text-[13px]", r.visible ? "bg-surface text-fg" : "bg-surface-3/70 text-fg-3")}>
                <Icon size={14} className={r.visible ? "text-accent" : "text-fg-4"} />
                <span className="flex-1 truncate">{r.label}</span>
                {r.visible ? <Eye size={14} className="text-[#15803d] dark:text-ios-green" aria-label="ko'rinadi" /> : <Lock size={13} aria-label="yopiq" />}
              </li>
            );
          })}
        </ul>
      </div>

      {error && (
        <div role="alert" className="mt-5 inline-flex items-center gap-2 rounded-full bg-ios-red/12 px-3.5 py-2 text-[13px] font-medium text-ios-red">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse items-stretch gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-[13px]" aria-live="polite">
          {saved ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#15803d] dark:text-ios-green">
              <CheckCircle2 size={15} /> Saqlandi
            </span>
          ) : dirty ? (
            <span className="text-fg-3">O'zgarishlar hali saqlanmagan</span>
          ) : (
            <span className="text-fg-4">Hammasi saqlangan</span>
          )}
          {!isDefault && (
            <button type="button" onClick={() => setV({ ...DEFAULT_VISIBILITY })} className="-my-2 inline-flex min-h-9 items-center gap-1 px-1 text-[12px] font-semibold text-fg-3 transition hover:text-fg">
              <RotateCcw size={12} /> Tavsiya etilganga qaytarish
            </button>
          )}
        </div>
        <Button type="submit" disabled={busy || !dirty} className="sm:min-w-[160px]">
          {busy ? <Spinner /> : "Saqlash"}
        </Button>
      </div>
    </form>
  );
}

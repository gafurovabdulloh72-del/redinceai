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
import { useUnsavedGuard } from "@/components/kabinet/useUnsavedGuard";
import { DEFAULT_VISIBILITY, VISIBILITY_FIELDS, VISIBILITY_LEVELS, type VisibilityFieldKey, type VisibilityLevelValue } from "@/lib/constants";
import { FORCED_ORDER_FIELDS, canView, type Viewer } from "@/lib/privacy";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr, type Tr } from "@/lib/i18n";
import { FORMA, KORINISH_SEGMENT, KORINISH_SOZLAMA as K, visibilityFieldLabel, visibilityLevelDesc } from "@/lib/i18n/dict/kabinet-forms";

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

/** Segmentdagi qisqa nom (to'liq nomi VISIBILITY_LEVELS'da) — til-mos: KORINISH_SEGMENT */
const LEVEL_SHORT: Record<VisibilityLevelValue, Tr> = KORINISH_SEGMENT as Record<VisibilityLevelValue, Tr>;

/** Aloqa maydonlari (FORCED_ORDER_FIELDS) uchun platforma qoidasi izohi — public/clients tanlab bo'lmaydi */
const CONTACT_RULE_NOTE = K.contactRule;
/** Aloqa maydonlarida tanlash mumkin bo'lgan darajalar: faqat "Buyurtmachilar" yoki "Yashirin" */
const CONTACT_LEVELS = VISIBILITY_LEVELS.filter((l) => l.value === "orders" || l.value === "hidden");

/** `short` — telefonda (390px) segment pill ichiga sig'ishi uchun qisqa nom; to'liq nomi aria-label/title'da */
const PREVIEW_AS: Array<{ key: "guest" | "client" | "order"; label: Tr; short?: Tr; viewer: Viewer }> = [
  { key: "guest", label: K.previewGuest, viewer: { userId: null } },
  { key: "client", label: K.previewClient, short: K.previewClientShort, viewer: { userId: "x", role: "client" } },
  { key: "order", label: K.previewOrder, viewer: { userId: "x", role: "client", hasOrder: true } },
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
  const til = useLocale();
  const [v, setV] = useState<VisibilityState>(initial);
  const [previewAs, setPreviewAs] = useState<(typeof PREVIEW_AS)[number]["key"]>("guest");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = useMemo(() => VISIBILITY_FIELDS.some((f) => v[f.key] !== initial[f.key]), [v, initial]);
  useUnsavedGuard(dirty && !busy);
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
      setError(tr(til, FORMA.networkError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} id="maxfiylik" className="card scroll-mt-28 p-5 sm:p-6" noValidate aria-busy={busy}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="btn-ink flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]">
            <ShieldCheck size={18} />
          </span>
          <div>
            <h2 className="font-display text-[19px] font-semibold tracking-tight text-fg">{tr(til, K.title)}</h2>
            <p className="mt-0.5 text-[13px] text-fg-3">
              {tr(til, K.desc)}
            </p>
          </div>
        </div>
        <a
          href={`/mutaxassislar/${slug}?preview=${previewAs}`}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-full border border-line-2 px-3.5 text-[13px] font-semibold text-fg transition hover:border-fg hover:bg-fg/4"
        >
          <Eye size={14} /> {tr(til, K.viewOnPage)} <ExternalLink size={12} className="text-fg-3" />
        </a>
      </div>

      {/* Daraja izohi */}
      <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {VISIBILITY_LEVELS.map((l) => {
          const Icon = LEVEL_ICON[l.value];
          return (
            <li key={l.value} className="card-outline flex items-start gap-2 !rounded-[16px] p-3">
              <Icon size={15} className="mt-0.5 shrink-0 text-fg-3" />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-fg">{tr(til, LEVEL_SHORT[l.value])}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-fg-3">{visibilityLevelDesc(til, l.value, l.description)}</p>
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
                    {visibilityFieldLabel(til, f.key, f.label)}
                    {!has && <span className="ml-2 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-fg-3">{tr(til, K.notFilled)}</span>}
                  </p>
                  <p className="mt-0.5 text-[12px] text-fg-3">
                    {contactOnly && level !== "hidden" ? tr(til, CONTACT_RULE_NOTE) : visibilityLevelDesc(til, level, VISIBILITY_LEVELS.find((l) => l.value === level)?.description ?? "")}
                  </p>
                </div>
              </div>
              <div className="segment flex w-full shrink-0 sm:w-auto" role="radiogroup" aria-label={K.whoSeesAria[til](visibilityFieldLabel(til, f.key, f.label))}>
                {levels.map((l) => {
                  const LIcon = LEVEL_ICON[l.value];
                  const active = level === l.value;
                  return (
                    <button
                      key={l.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={tr(til, LEVEL_SHORT[l.value])}
                      title={tr(til, LEVEL_SHORT[l.value])}
                      data-active={active}
                      onClick={() => setV((s) => ({ ...s, [f.key]: l.value }))}
                      className="segment-item inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 !px-2.5 sm:flex-none sm:!px-3"
                    >
                      <LIcon size={14} />
                      <span className="hidden lg:inline">{tr(til, LEVEL_SHORT[l.value])}</span>
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
              <Eye size={15} className="text-fg-3" /> {tr(til, K.previewTitle)}
            </p>
            <p className="mt-0.5 text-[12px] text-fg-3">
              {hiddenNow === 0 ? tr(til, K.previewAll) : K.previewHidden[til](hiddenNow)}
              {dirty && tr(til, K.previewDirty)}
            </p>
          </div>
          <div className="segment flex w-full sm:w-auto" role="radiogroup" aria-label={tr(til, K.previewAsAria)}>
            {PREVIEW_AS.map((p) => (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={previewAs === p.key}
                data-active={previewAs === p.key}
                onClick={() => setPreviewAs(p.key)}
                aria-label={tr(til, p.label)}
                title={tr(til, p.label)}
                className="segment-item min-h-9 flex-1 !px-3 sm:flex-none"
              >
                {p.short ? (
                  <>
                    <span className="sm:hidden">{tr(til, p.short)}</span>
                    <span className="hidden sm:inline">{tr(til, p.label)}</span>
                  </>
                ) : (
                  tr(til, p.label)
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
                <Icon size={14} className={r.visible ? "text-fg-2" : "text-fg-4"} />
                <span className="flex-1 truncate">{visibilityFieldLabel(til, r.key, r.label)}</span>
                {/* lucide ikonkasi aria-hidden — holat matni sr-only bilan */}
                {r.visible ? <Eye size={14} className="text-success-text" /> : <Lock size={13} />}
                <span className="sr-only">{tr(til, r.visible ? K.visible : K.locked)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {error && (
        <div role="alert" className="mt-5 inline-flex items-center gap-2 rounded-full bg-danger-soft px-3.5 py-2 text-[13px] font-medium text-danger-text">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse items-stretch gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-[13px]" aria-live="polite">
          {saved ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-success-text">
              <CheckCircle2 size={15} /> {tr(til, FORMA.saved)}
            </span>
          ) : dirty ? (
            <span className="text-fg-3">{tr(til, FORMA.unsaved)}</span>
          ) : (
            <span className="text-fg-4">{tr(til, FORMA.allSaved)}</span>
          )}
          {!isDefault && (
            <button type="button" onClick={() => setV({ ...DEFAULT_VISIBILITY })} className="-my-2 inline-flex min-h-9 items-center gap-1 px-1 text-[12px] font-semibold text-fg-3 transition hover:text-fg">
              <RotateCcw size={12} /> {tr(til, K.resetDefault)}
            </button>
          )}
        </div>
        <Button type="submit" disabled={busy || !dirty} className="sm:min-w-[160px]">
          {busy ? <Spinner /> : tr(til, FORMA.save)}
        </Button>
      </div>
    </form>
  );
}

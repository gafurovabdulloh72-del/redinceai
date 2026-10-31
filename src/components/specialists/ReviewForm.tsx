"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardCheck, ImagePlus, LogIn, PencilLine, Star, ThumbsUp, Trash2, X } from "lucide-react";
import { Button, ButtonLink, Spinner } from "@/components/ui";
import { MAX_REVIEW_MEDIA, UPLOAD_ACCEPT, uploadAttachment } from "@/components/chat/attachments";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { RATING_CRITERIA, type RatingCriterionKey } from "@/lib/constants";
import { tr } from "@/lib/i18n";
import { MEZON, PROFIL, RF_X } from "@/lib/i18n/dict/profile";
import { cn } from "@/lib/utils";

type ApiResponse = { ok: true; data: { saved: boolean; updated: boolean } } | { ok: false; error: string; fields?: Record<string, string> };

/** Avval qoldirilgan sharh (tahrirlash) — v2 maydonlari ixtiyoriy */
export interface ExistingReview {
  rating: number;
  text: string;
  quality?: number | null;
  timeliness?: number | null;
  communication?: number | null;
  media?: string[];
  recommend?: boolean | null;
}

/** Mezon bo'yicha kichik yulduzlar (F44) — har bir tugma 40px */
function CriterionStars({ label, value, onChange, names }: { label: string; value: number; onChange: (v: number) => void; names: Record<number, string> }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <span className="text-[13px] font-medium text-fg-2">{label}</span>
      <div role="radiogroup" aria-label={`${label} (1–5)`} className="flex items-center">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${label}: ${n} — ${names[n]}`}
            onClick={() => onChange(value === n ? 0 : n)}
            className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-fg/6 active:scale-90"
          >
            <Star size={18} className={cn("transition", n <= value ? "fill-accent-3 text-accent-3" : "text-fg-4")} />
          </button>
        ))}
      </div>
    </div>
  );
}
type DeleteResponse = { ok: true; data: { deleted: boolean } } | { ok: false; error: string };

export function ReviewForm({
  specialistId,
  canReview,
  needsOrder = false,
  orderHref,
  existing,
  loginHref,
  isOwner = false,
}: {
  specialistId: string;
  /** Kirgan, profil egasi bo'lmagan va shu mutaxassis bilan qabul qilingan buyurtmasi bor (yoki sharhi bor) foydalanuvchi */
  canReview: boolean;
  /** Kirgan, lekin hali buyurtmasi qabul qilinmagan — server ham shu shartni tekshiradi */
  needsOrder?: boolean;
  orderHref?: string | null;
  /** Avval qoldirilgan sharh (tahrirlash rejimi) */
  existing?: ExistingReview | null;
  loginHref: string;
  isOwner?: boolean;
}) {
  const til = useLocale();
  const RATING_LABEL = PROFIL.rf.ratingNames[til];
  const router = useRouter();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState(existing?.text ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | "created" | "updated" | "deleted">(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** Mezonlar (F44); 0 — tanlanmagan */
  const [criteria, setCriteria] = useState<Record<RatingCriterionKey, number>>({
    quality: existing?.quality ?? 0,
    timeliness: existing?.timeliness ?? 0,
    communication: existing?.communication ?? 0,
  });
  /** Umumiy bahoni foydalanuvchi o'zi tanladimi (aks holda mezonlar o'rtachasi) */
  const [ratingTouched, setRatingTouched] = useState(Boolean(existing));
  const [media, setMedia] = useState<string[]>(existing?.media ?? []);
  const [uploading, setUploading] = useState(0);
  const [recommend, setRecommend] = useState<boolean>(existing?.recommend ?? true);
  /** Sahifa mavjud sharhning v2 maydonlarini bermagan bo'lsa — foydalanuvchi o'zgartirmaguncha ular yuborilmaydi (serverdagi qiymat saqlanadi) */
  const v2Known = !existing || existing.quality !== undefined || existing.media !== undefined || existing.recommend !== undefined;
  const [v2Touched, setV2Touched] = useState(false);
  const touch = () => setV2Touched(true);
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (isOwner) return null;

  if (!canReview && needsOrder) {
    return (
      <div className="card-outline flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-surface-3 text-fg-2">
            <ClipboardCheck size={20} />
          </span>
          <div>
            <p className="text-[16px] font-semibold text-fg">{tr(til, PROFIL.rf.gateOrderTitle)}</p>
            <p className="mt-0.5 text-[13px] text-fg-3">{tr(til, PROFIL.rf.gateOrderDesc)}</p>
          </div>
        </div>
        {orderHref && (
          <ButtonLink href={orderHref} variant="accent" size="md" className="shrink-0">
            {tr(til, PROFIL.rf.orderCta)} <ArrowRight size={16} />
          </ButtonLink>
        )}
      </div>
    );
  }

  if (!canReview) {
    return (
      <div className="card-outline flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-accent-soft text-accent">
            <PencilLine size={20} />
          </span>
          <div>
            <p className="text-[16px] font-semibold text-fg">{tr(til, PROFIL.rf.gateLoginTitle)}</p>
            <p className="mt-0.5 text-[13px] text-fg-3">{tr(til, PROFIL.rf.gateLoginDesc)}</p>
          </div>
        </div>
        <ButtonLink href={loginHref} variant="outline" size="md" className="shrink-0">
          <LogIn size={16} /> {tr(til, PROFIL.rf.login)}
        </ButtonLink>
      </div>
    );
  }

  const picked = RATING_CRITERIA.map((c) => criteria[c.key]).filter((n) => n > 0);
  const autoRating = picked.length ? Math.round(picked.reduce((a, b) => a + b, 0) / picked.length) : 0;
  const effective = ratingTouched ? rating : autoRating || rating;
  const shown = hover || effective;

  const pickPhotos = async (e: ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    const room = MAX_REVIEW_MEDIA - media.length;
    if (!list.length || room <= 0) return;
    setErrors((m) => ({ ...m, media: "" }));
    for (const f of list.slice(0, room)) {
      setUploading((n) => n + 1);
      try {
        const a = await uploadAttachment(f);
        setMedia((cur) => (cur.includes(a.url) || cur.length >= MAX_REVIEW_MEDIA ? cur : [...cur, a.url]));
        touch();
      } catch (err) {
        setErrors((m) => ({ ...m, media: err instanceof Error ? err.message : tr(til, PROFIL.rf.uploadError) }));
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setErrors({});
    if (effective < 1) {
      setErrors({ rating: tr(til, PROFIL.rf.pickRatingError) });
      return;
    }
    // Server qoidasi (reviewSchema: kamida 10 belgi) — xato serverga bormay darhol ko'rsatiladi
    if (text.trim().length < 10) {
      setErrors({ text: RF_X.tooShort[til](10) });
      return;
    }
    // Rasm hali yuklanayotgan bo'lsa — jim qolmaymiz, sababini aytamiz
    if (uploading > 0) {
      setError(tr(til, RF_X.waitUpload));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specialistId,
          rating: effective,
          text,
          ...(v2Known || v2Touched
            ? { quality: criteria.quality || null, timeliness: criteria.timeliness || null, communication: criteria.communication || null, media, recommend }
            : {}),
        }),
      });
      const json = (await res.json()) as ApiResponse;
      if (!json.ok) {
        setError(json.error);
        if (json.fields) setErrors(json.fields);
        return;
      }
      setDone(json.data.updated ? "updated" : "created");
      router.refresh();
    } catch {
      setError(tr(til, PROFIL.rf.networkError));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/reviews?specialistId=${encodeURIComponent(specialistId)}`, { method: "DELETE" });
      const json = (await res.json()) as DeleteResponse;
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setConfirmDelete(false);
      setRating(0);
      setRatingTouched(false);
      setCriteria({ quality: 0, timeliness: 0, communication: 0 });
      setMedia([]);
      setText("");
      setDone("deleted");
      router.refresh();
    } catch {
      setError(tr(til, PROFIL.rf.networkError));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="card animate-fade-up flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between" style={{ animationDuration: "0.4s" }}>
        <div className="flex items-start gap-3">
          <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-md)]", done === "deleted" ? "bg-surface-3 text-fg-2" : "bg-success-soft text-success-text")}>
            {done === "deleted" ? <Trash2 size={20} /> : <CheckCircle2 size={22} />}
          </span>
          <div>
            <p className="text-[16px] font-semibold text-fg">
              {done === "deleted" ? tr(til, PROFIL.rf.doneDeleted) : done === "updated" ? tr(til, PROFIL.rf.doneUpdated) : tr(til, PROFIL.rf.doneCreated)}
            </p>
            <p className="mt-0.5 text-[13px] text-fg-3">{done === "deleted" ? tr(til, PROFIL.rf.doneDeletedDesc) : tr(til, PROFIL.rf.doneDesc)}</p>
          </div>
        </div>
        {done !== "deleted" && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setDone(null)}>
            <PencilLine size={14} /> {tr(til, PROFIL.rf.edit)}
          </Button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-5 sm:p-6" noValidate>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-accent-soft text-accent">
          <Star size={20} />
        </span>
        <div>
          <h3 className="text-[17px] font-semibold text-fg">{existing ? tr(til, PROFIL.rf.titleEdit) : tr(til, PROFIL.rf.titleNew)}</h3>
          <p className="mt-0.5 text-[13px] text-fg-3">{existing ? tr(til, PROFIL.rf.subEdit) : tr(til, PROFIL.rf.subNew)}</p>
        </div>
      </div>

      {/* Yulduz tanlagich */}
      <div className="mt-5">
        <span className="field-label">{tr(til, PROFIL.rf.rating)}</span>
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="radiogroup"
            aria-label={tr(til, PROFIL.rf.ratingAria)}
            className="card-outline pill inline-flex items-center gap-0.5 px-2 py-1.5"
            onMouseLeave={() => setHover(0)}
          >
            {[1, 2, 3, 4, 5].map((n) => {
              const active = n <= shown;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={effective === n}
                  aria-label={PROFIL.rf.starAria[til](n, RATING_LABEL[n])}
                  onMouseEnter={() => setHover(n)}
                  onFocus={() => setHover(n)}
                  onBlur={() => setHover(0)}
                  onClick={() => {
                    setRating(n);
                    setRatingTouched(true);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-fg/6 active:scale-90"
                >
                  <Star
                    size={22}
                    className={cn("transition-[color,fill,scale] duration-150", active ? "fill-accent-3 text-accent-3 scale-110" : "text-fg-4")}
                  />
                </button>
              );
            })}
          </div>
          <span className={cn("text-[13px] font-semibold transition", shown ? "text-fg" : "text-fg-4")} aria-live="polite">
            {shown ? RATING_LABEL[shown] : tr(til, PROFIL.rf.pickStar)}
          </span>
        </div>
        {errors.rating ? (
          <p className="field-error">{errors.rating}</p>
        ) : (
          !ratingTouched && autoRating > 0 && <p className="mt-1.5 text-[12px] text-fg-4">{tr(til, PROFIL.rf.autoRatingNote)}</p>
        )}
      </div>

      {/* Mezonlar (F44) */}
      <div className="mt-4 rounded-[var(--r-md)] border border-line bg-surface-2 px-3.5 py-2.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">{tr(til, PROFIL.rf.criteriaTitle)}</p>
        <div className="mt-1 divide-y divide-line">
          {RATING_CRITERIA.map((c) => (
            <div key={c.key} className="py-1">
              <CriterionStars
                label={MEZON[c.key] ? tr(til, MEZON[c.key]) : c.label}
                names={RATING_LABEL}
                value={criteria[c.key]}
                onChange={(v) => (setCriteria((m) => ({ ...m, [c.key]: v })), touch())}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Matn */}
      <div className="mt-4">
        <label htmlFor="review-text" className="field-label">
          {tr(til, PROFIL.rf.textLabel)}
        </label>
        <textarea
          id="review-text"
          className="field min-h-[112px] resize-y"
          placeholder={tr(til, PROFIL.rf.textPlaceholder)}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1500}
          aria-invalid={Boolean(errors.text)}
          aria-describedby={errors.text ? "review-text-error" : undefined}
        />
        <div className="mt-1 flex items-start justify-between gap-3">
          {errors.text ? (
            <p id="review-text-error" className="field-error !mt-0">
              {errors.text}
            </p>
          ) : (
            <span className="text-[12px] text-fg-4">{tr(til, PROFIL.rf.minChars)}</span>
          )}
          <span className="shrink-0 text-[12px] tabular-nums text-fg-4">{text.length}/1500</span>
        </div>
      </div>

      {/* Rasmlar (F45) */}
      <div className="mt-4">
        <span className="field-label">
          {tr(til, PROFIL.rf.mediaLabel)} <span className="font-normal text-fg-4">{PROFIL.rf.mediaOptional[til](MAX_REVIEW_MEDIA)}</span>
        </span>
        <input ref={fileRef} type="file" accept={UPLOAD_ACCEPT} multiple className="hidden" onChange={pickPhotos} tabIndex={-1} />
        <div className="flex flex-wrap items-center gap-2">
          {media.map((url) => (
            <span key={url} className="relative h-16 w-16 overflow-hidden rounded-[12px] border border-line bg-surface-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => (setMedia((cur) => cur.filter((x) => x !== url)), touch())}
                className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-bl-[10px] bg-ink/70 text-ink-fg"
                aria-label={tr(til, PROFIL.rf.mediaRemove)}
              >
                <X size={13} />
              </button>
            </span>
          ))}
          {uploading > 0 && (
            <span className="flex h-16 w-16 items-center justify-center rounded-[12px] bg-fg/6">
              <Spinner className="h-4 w-4" />
            </span>
          )}
          {media.length + uploading < MAX_REVIEW_MEDIA && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-[12px] border border-dashed border-line-2 text-[11px] font-semibold text-fg-3 transition hover:border-fg hover:text-fg"
              aria-label={tr(til, PROFIL.rf.mediaAddAria)}
            >
              <ImagePlus size={18} /> {tr(til, PROFIL.rf.mediaAdd)}
            </button>
          )}
        </div>
        {errors.media && <p className="field-error">{errors.media}</p>}
      </div>

      {/* Tavsiya (F46) */}
      <div className="mt-4 flex items-center justify-between gap-4 rounded-[var(--r-md)] border border-line bg-surface-2 px-3.5 py-3">
        <span id="review-recommend" className="flex items-center gap-2 text-[14px] font-medium text-fg">
          <ThumbsUp size={16} className="text-success-text" /> {tr(til, PROFIL.rf.recommendLabel)}
        </span>
        <button type="button" role="switch" aria-checked={recommend} aria-labelledby="review-recommend" onClick={() => (setRecommend((v) => !v), touch())} className="switch" />
      </div>

      {error && (
        <div role="alert" className="mt-4 inline-flex items-center gap-2 rounded-full bg-danger-soft px-3.5 py-2 text-[13px] font-medium text-danger-text">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        {/* O'z sharhini o'chirish — inline ikki bosqichli tasdiq (window.confirm emas) */}
        {existing &&
          (confirmDelete ? (
            <div className="mr-auto flex items-center gap-2 animate-fade-up" style={{ animationDuration: "0.2s" }} role="group" aria-label={tr(til, PROFIL.rf.confirmDeleteAria)}>
              <span className="text-[12px] font-medium text-fg-2">{tr(til, PROFIL.rf.confirmDeleteQ)}</span>
              <Button type="button" size="sm" variant="danger" className="!h-10" onClick={remove} disabled={busy}>
                {tr(til, PROFIL.rf.yesDelete)}
              </Button>
              <Button type="button" size="sm" variant="outline" className="!h-10" onClick={() => setConfirmDelete(false)} autoFocus>
                {tr(til, PROFIL.rf.no)}
              </Button>
            </div>
          ) : (
            <Button type="button" variant="ghost" size="sm" className="mr-auto text-fg-3" onClick={() => setConfirmDelete(true)} disabled={busy}>
              <Trash2 size={14} /> {tr(til, PROFIL.rf.delete)}
            </Button>
          ))}
        <Button type="submit" disabled={busy || uploading > 0} className="min-w-[160px]">
          {busy ? <Spinner /> : existing ? tr(til, PROFIL.rf.update) : tr(til, PROFIL.rf.submit)}
        </Button>
      </div>
    </form>
  );
}

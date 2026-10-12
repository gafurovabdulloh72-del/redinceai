"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardCheck, LogIn, PencilLine, Star, Trash2 } from "lucide-react";
import { Button, ButtonLink, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

const RATING_LABEL: Record<number, string> = {
  1: "Yomon",
  2: "Qoniqarsiz",
  3: "O'rtacha",
  4: "Yaxshi",
  5: "A'lo",
};

type ApiResponse = { ok: true; data: { saved: boolean; updated: boolean } } | { ok: false; error: string; fields?: Record<string, string> };
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
  existing?: { rating: number; text: string } | null;
  loginHref: string;
  isOwner?: boolean;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState(existing?.text ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | "created" | "updated" | "deleted">(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isOwner) return null;

  if (!canReview && needsOrder) {
    return (
      <div className="card-outline flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-surface-3 text-fg-2">
            <ClipboardCheck size={20} />
          </span>
          <div>
            <p className="text-[16px] font-semibold text-fg">Sharh faqat buyurtma qabul qilingan mijozlar uchun</p>
            <p className="mt-0.5 text-[13px] text-fg-3">Shu mutaxassisga buyurtma bering — u qabul qilgach fikringizni yozishingiz mumkin. Shunday qilib har bir sharh haqiqiy bo'ladi.</p>
          </div>
        </div>
        {orderHref && (
          <ButtonLink href={orderHref} variant="accent" size="md" className="shrink-0">
            Buyurtma berish <ArrowRight size={16} />
          </ButtonLink>
        )}
      </div>
    );
  }

  if (!canReview) {
    return (
      <div className="card-outline flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-accent-soft text-accent">
            <PencilLine size={20} />
          </span>
          <div>
            <p className="text-[16px] font-semibold text-fg">Sharh qoldirmoqchimisiz?</p>
            <p className="mt-0.5 text-[13px] text-fg-3">Fikringizni yozish uchun avval tizimga kiring. Bir daqiqa vaqt oladi.</p>
          </div>
        </div>
        <ButtonLink href={loginHref} variant="outline" size="md" className="shrink-0">
          <LogIn size={16} /> Kirish
        </ButtonLink>
      </div>
    );
  }

  const shown = hover || rating;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setErrors({});
    if (rating < 1) {
      setErrors({ rating: "Bahoni tanlang (1–5 yulduz)" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specialistId, rating, text }),
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
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
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
      setText("");
      setDone("deleted");
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="card animate-fade-up flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between" style={{ animationDuration: "0.4s" }}>
        <div className="flex items-start gap-3">
          <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]", done === "deleted" ? "bg-surface-3 text-fg-2" : "bg-ios-green/16 text-ios-green")}>
            {done === "deleted" ? <Trash2 size={20} /> : <CheckCircle2 size={22} />}
          </span>
          <div>
            <p className="text-[16px] font-semibold text-fg">{done === "deleted" ? "Sharhingiz o'chirildi" : done === "updated" ? "Sharhingiz yangilandi" : "Rahmat! Sharhingiz saqlandi"}</p>
            <p className="mt-0.5 text-[13px] text-fg-3">
              {done === "deleted" ? "Xohlasangiz keyinroq yangi sharh qoldirishingiz mumkin." : "Fikringiz boshqa mijozlarga to'g'ri tanlov qilishga yordam beradi."}
            </p>
          </div>
        </div>
        {done !== "deleted" && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setDone(null)}>
            <PencilLine size={14} /> Tahrirlash
          </Button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-5 sm:p-6" noValidate>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-accent-soft text-accent">
          <Star size={20} />
        </span>
        <div>
          <h3 className="text-[17px] font-semibold text-fg">{existing ? "Sharhingizni yangilang" : "Sharh qoldiring"}</h3>
          <p className="mt-0.5 text-[13px] text-fg-3">{existing ? "Avval qoldirgan bahoyingizni o'zgartirishingiz mumkin." : "Hamkorlik qanday o'tdi? Qisqa va aniq yozing."}</p>
        </div>
      </div>

      {/* Yulduz tanlagich */}
      <div className="mt-5">
        <span className="field-label">Baho</span>
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="radiogroup"
            aria-label="Baho (1 dan 5 gacha)"
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
                  aria-checked={rating === n}
                  aria-label={`${n} yulduz — ${RATING_LABEL[n]}`}
                  onMouseEnter={() => setHover(n)}
                  onFocus={() => setHover(n)}
                  onBlur={() => setHover(0)}
                  onClick={() => setRating(n)}
                  className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-fg/6 active:scale-90"
                >
                  <Star
                    size={22}
                    className={cn("transition-all duration-150", active ? "fill-accent-3 text-accent-3 scale-110" : "text-fg-4")}
                  />
                </button>
              );
            })}
          </div>
          <span className={cn("text-[13px] font-semibold transition", shown ? "text-fg" : "text-fg-4")} aria-live="polite">
            {shown ? RATING_LABEL[shown] : "Yulduzni tanlang"}
          </span>
        </div>
        {errors.rating && <p className="field-error">{errors.rating}</p>}
      </div>

      {/* Matn */}
      <div className="mt-4">
        <label htmlFor="review-text" className="field-label">
          Sharh matni
        </label>
        <textarea
          id="review-text"
          className="field min-h-[112px] resize-y"
          placeholder="Masalan: Muddatida topshirdi, muloqot oson va aniq bo'ldi…"
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
            <span className="text-[12px] text-fg-4">Kamida 10 ta belgi</span>
          )}
          <span className="shrink-0 text-[12px] tabular-nums text-fg-4">{text.length}/1500</span>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-4 inline-flex items-center gap-2 rounded-full bg-ios-red/12 px-3.5 py-2 text-[13px] font-medium text-ios-red">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        {/* O'z sharhini o'chirish — inline ikki bosqichli tasdiq (window.confirm emas) */}
        {existing &&
          (confirmDelete ? (
            <div className="mr-auto flex items-center gap-2 animate-fade-up" style={{ animationDuration: "0.2s" }} role="group" aria-label="O'chirishni tasdiqlash">
              <span className="text-[12px] font-medium text-fg-2">Sharh o'chirilsinmi?</span>
              <Button type="button" size="sm" variant="danger" className="!h-10" onClick={remove} disabled={busy}>
                Ha, o'chirish
              </Button>
              <Button type="button" size="sm" variant="outline" className="!h-10" onClick={() => setConfirmDelete(false)} autoFocus>
                Yo'q
              </Button>
            </div>
          ) : (
            <Button type="button" variant="ghost" size="sm" className="mr-auto text-fg-3" onClick={() => setConfirmDelete(true)} disabled={busy}>
              <Trash2 size={14} /> O'chirish
            </Button>
          ))}
        <Button type="submit" disabled={busy} className="min-w-[160px]">
          {busy ? <Spinner /> : existing ? "Yangilash" : "Sharhni yuborish"}
        </Button>
      </div>
    </form>
  );
}

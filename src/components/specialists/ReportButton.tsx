"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Flag, X } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { usePresence } from "@/components/motion/usePresence";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { REPORT_REASONS, type ReportReason } from "@/lib/constants";
import { tr } from "@/lib/i18n";
import { SHIKOYAT } from "@/lib/i18n/dict/profile";
import { cn } from "@/lib/utils";

type ReportResponse = { ok: true; data: { id: string } } | { ok: false; error: string; fields?: Record<string, string> };
export type ReportTarget = "specialist" | "review" | "user" | "post" | "comment" | "message";

const LABEL_KEY: Record<ReportTarget, keyof typeof SHIKOYAT> = { specialist: "aboutProfile", review: "aboutReview", user: "aboutUser", post: "aboutPost", comment: "aboutComment", message: "aboutMessage" };

/**
 * "Shikoyat qilish" (F85): profil, sharh, foydalanuvchi, post, izoh yoki xabar haqida — sabab + ixtiyoriy izoh.
 * Standart: kichik tugma → joyida ochiladigan forma. `compact` — faqat bayroq ikonkasi (karta sarlavhasi, xabar yonida);
 * `modal` — forma portal orqali oynada (joy tor bo'lgan kartalarda). Mehmon — kirish sahifasiga havola (loginHref bo'lsa).
 * Server bitta nishonga bir marta shikoyatni qabul qiladi (409 — "yuborilgan" deb ko'rsatiladi).
 */
export function ReportButton({
  targetType,
  targetId,
  loggedIn,
  loginHref,
  className,
  align = "end",
  compact = false,
  modal = false,
  triggerClassName,
}: {
  targetType: ReportTarget;
  targetId: string;
  loggedIn: boolean;
  loginHref?: string;
  className?: string;
  /** Tugma qatorda qayerda turadi (forma kengligi to'liq bo'ladi) */
  align?: "start" | "center" | "end";
  compact?: boolean;
  modal?: boolean;
  triggerClassName?: string;
}) {
  const til = useLocale();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [ready, setReady] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);
  const uid = useId();
  const presence = usePresence(open && modal, 200);
  const label = tr(til, SHIKOYAT[LABEL_KEY[targetType]]);

  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (open) window.setTimeout(() => selectRef.current?.focus(), 50);
  }, [open]);
  useEffect(() => {
    if (!open || !modal) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, modal]);

  const justify = align === "start" ? "justify-start" : align === "center" ? "justify-center" : "justify-end";
  const triggerCls = compact
    ? cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-4 transition hover:bg-fg/8 hover:text-fg", triggerClassName)
    : cn("inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold text-fg-3 transition hover:bg-fg/6 hover:text-fg", triggerClassName);
  const triggerInner = compact ? (
    <Flag size={13} />
  ) : (
    <>
      <Flag size={12} /> {tr(til, SHIKOYAT.button)}
    </>
  );

  if (sent && !modal) {
    return (
      <p role="status" className={cn("flex items-center gap-1.5 text-[12px] font-medium text-fg-3", justify, className)}>
        <CheckCircle2 size={13} className="text-success" /> {tr(til, SHIKOYAT.sent)}
      </p>
    );
  }

  if (!loggedIn) {
    if (!loginHref) return null;
    return (
      <div className={cn("flex", justify, className)}>
        <Link href={loginHref} className={triggerCls} aria-label={`${label}${tr(til, SHIKOYAT.loginFirst)}`} title={label}>
          {triggerInner}
        </Link>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!reason) {
      setError(tr(til, SHIKOYAT.pickReason));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason, text }),
      });
      const json = (await res.json()) as ReportResponse;
      if (!json.ok && res.status !== 409) {
        setError(json.fields ? Object.values(json.fields)[0] : json.error);
        return;
      }
      // Takroriy shikoyat (409) ham foydalanuvchi uchun "yuborilgan" holat
      setSent(true);
      if (modal) {
        toast(tr(til, SHIKOYAT.sent));
        setOpen(false);
      }
    } catch {
      setError(tr(til, SHIKOYAT.networkError));
    } finally {
      setBusy(false);
    }
  };

  const form = (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
      className={cn("w-full space-y-3 text-left", modal ? "" : cn("card-outline animate-fade-up p-3.5", className))}
      style={modal ? undefined : { animationDuration: "0.25s" }}
      aria-label={label}
      noValidate
    >
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
        <Flag size={13} className="text-fg-3" /> {label}
      </p>
      <div>
        <label htmlFor={`${uid}-reason`} className="field-label">
          {tr(til, SHIKOYAT.reason)}
        </label>
        <select ref={selectRef} id={`${uid}-reason`} className="field" value={reason} onChange={(e) => setReason(e.target.value as ReportReason | "")} aria-invalid={Boolean(error && !reason)}>
          <option value="">{tr(til, SHIKOYAT.choose)}</option>
          {REPORT_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${uid}-text`} className="field-label">
          {tr(til, SHIKOYAT.comment)} <span className="font-normal text-fg-4">{tr(til, SHIKOYAT.optional)}</span>
        </label>
        <textarea id={`${uid}-text`} className="field min-h-[72px] resize-y" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={tr(til, SHIKOYAT.placeholder)} />
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-[12px] font-medium text-danger">
          <AlertCircle size={13} /> {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
          {tr(til, SHIKOYAT.cancel)}
        </Button>
        <Button type="submit" size="sm" disabled={busy} className="min-w-[110px]">
          {busy ? <Spinner /> : tr(til, SHIKOYAT.send)}
        </Button>
      </div>
    </form>
  );

  const trigger = (
    <button type="button" className={triggerCls} onClick={() => setOpen(true)} aria-expanded={open} aria-haspopup={modal ? "dialog" : undefined} aria-label={label} title={label} disabled={sent}>
      {sent ? <CheckCircle2 size={13} className="text-success" /> : triggerInner}
    </button>
  );

  if (modal) {
    return (
      <>
        {compact ? trigger : <div className={cn("flex", justify, className)}>{trigger}</div>}
        {ready &&
          presence.mounted &&
          createPortal(
            <div className={cn("fixed inset-0 z-[130] flex items-end justify-center bg-ink/55 backdrop-blur-sm sm:items-center sm:p-6", presence.closing ? "animate-fade-out" : "animate-fade-in")} role="presentation" onClick={() => setOpen(false)}>
              <div role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()} className={cn("card-elevated w-full max-w-md !rounded-b-none p-5 sm:!rounded-[24px]", presence.closing ? "animate-sheet-down sm:animate-modal-out" : "animate-sheet-up sm:animate-modal-in")} style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
                <div className="sheet-handle mb-3 sm:hidden" aria-hidden />
                <button type="button" onClick={() => setOpen(false)} aria-label={tr(til, SHIKOYAT.cancel)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg">
                  <X size={16} />
                </button>
                {form}
              </div>
            </div>,
            document.body,
          )}
      </>
    );
  }

  if (!open) return <div className={cn("flex", justify, className)}>{trigger}</div>;
  return form;
}

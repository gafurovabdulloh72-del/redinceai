"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Flag } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { REPORT_REASONS, type ReportReason } from "@/lib/constants";
import { tr } from "@/lib/i18n";
import { SHIKOYAT } from "@/lib/i18n/dict/profile";
import { cn } from "@/lib/utils";

type ReportResponse = { ok: true; data: { id: string } } | { ok: false; error: string; fields?: Record<string, string> };

/**
 * "Shikoyat qilish" (F85): kichik tugma → joyida ochiladigan forma (sabab + ixtiyoriy izoh).
 * Mehmon uchun — kirish sahifasiga havola. Server bitta nishonga bir marta shikoyatni qabul qiladi (409).
 */
export function ReportButton({
  targetType,
  targetId,
  loggedIn,
  loginHref,
  className,
  align = "end",
}: {
  targetType: "specialist" | "review";
  targetId: string;
  loggedIn: boolean;
  loginHref?: string;
  className?: string;
  /** Tugma qatorda qayerda turadi (forma kengligi to'liq bo'ladi) */
  align?: "start" | "center" | "end";
}) {
  const til = useLocale();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);
  const uid = useId();
  const label = targetType === "specialist" ? tr(til, SHIKOYAT.aboutProfile) : tr(til, SHIKOYAT.aboutReview);

  useEffect(() => {
    if (open) selectRef.current?.focus();
  }, [open]);

  const justify = align === "start" ? "justify-start" : align === "center" ? "justify-center" : "justify-end";
  const triggerCls =
    "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold text-fg-3 transition hover:bg-fg/6 hover:text-fg";

  if (sent) {
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
        <Link href={loginHref} className={triggerCls} aria-label={`${label}${tr(til, SHIKOYAT.loginFirst)}`}>
          <Flag size={12} /> {tr(til, SHIKOYAT.button)}
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
      if (!json.ok) {
        // Takroriy shikoyat — foydalanuvchi uchun bu ham "yuborilgan" holat
        if (res.status === 409) {
          setSent(true);
          return;
        }
        setError(json.fields ? Object.values(json.fields)[0] : json.error);
        return;
      }
      setSent(true);
    } catch {
      setError(tr(til, SHIKOYAT.networkError));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className={cn("flex", justify, className)}>
        <button type="button" className={triggerCls} onClick={() => setOpen(true)} aria-expanded={false} aria-label={label}>
          <Flag size={12} /> {tr(til, SHIKOYAT.button)}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
      className={cn("card-outline animate-fade-up w-full space-y-3 p-3.5 text-left", className)}
      style={{ animationDuration: "0.25s" }}
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
        <select
          ref={selectRef}
          id={`${uid}-reason`}
          className="field"
          value={reason}
          onChange={(e) => setReason(e.target.value as ReportReason | "")}
          aria-invalid={Boolean(error && !reason)}
        >
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
        <textarea
          id={`${uid}-text`}
          className="field min-h-[72px] resize-y"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder={tr(til, SHIKOYAT.placeholder)}
        />
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
}

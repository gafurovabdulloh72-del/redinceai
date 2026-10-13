"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, Lock, PencilLine, RotateCcw } from "lucide-react";
import { Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";
import { patchJobState } from "./proposal-actions";

/**
 * E'lon egasining amallari: tahrirlash, yopish (tasdiq bilan), qayta ochish (muddat yana 30 kunga).
 * Mutaxassis tanlangan (hired) e'londa amallar yo'q.
 */
export function JobOwnerActions({
  jobId,
  status,
  expired,
  compact = false,
  className,
}: {
  jobId: string;
  status: "open" | "hired" | "closed";
  /** Ochiq, lekin muddati o'tgan (cron hali yopmagan) */
  expired?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (status === "hired") return null;
  const h = compact ? "h-10 px-3.5 text-[13px]" : "h-11 px-4 text-[14px]";
  const btn = cn("inline-flex items-center justify-center gap-1.5 rounded-full border border-line-2 font-semibold text-fg transition hover:border-fg disabled:opacity-60", h);
  const live = status === "open" && !expired;

  const run = async (action: "close" | "reopen") => {
    setBusy(true);
    setError(null);
    const r = await patchJobState(jobId, action);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setAsk(false);
    router.refresh();
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/ishlar/${jobId}/tahrirlash`} className={btn}>
          <PencilLine size={14} aria-hidden="true" /> Tahrirlash
        </Link>
        {live ? (
          ask ? (
            <span className="inline-flex flex-wrap items-center gap-2" role="group" aria-label="E'lonni yopishni tasdiqlang">
              <button type="button" onClick={() => run("close")} disabled={busy} className={cn("inline-flex items-center gap-1.5 rounded-full bg-danger-strong font-semibold text-white transition hover:brightness-110 disabled:opacity-60", h)}>
                {busy ? <Spinner /> : <Lock size={14} aria-hidden="true" />} Ha, yopish
              </button>
              <button type="button" onClick={() => setAsk(false)} disabled={busy} className={btn}>
                Yo'q
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setAsk(true)} className={btn}>
              <Lock size={14} aria-hidden="true" /> Yopish
            </button>
          )
        ) : (
          <button type="button" onClick={() => run("reopen")} disabled={busy} className={cn(btn, "border-transparent bg-accent-soft text-accent-text hover:border-transparent hover:brightness-105")}>
            {busy ? <Spinner /> : <RotateCcw size={14} aria-hidden="true" />} Qayta ochish
          </button>
        )}
      </div>
      {ask && <p className="text-[12px] text-fg-3">Yopilgan e'longa yangi taklif kelmaydi. Keyin qayta ochishingiz mumkin.</p>}
      {error && (
        <p role="alert" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-danger-text">
          <AlertCircle size={13} aria-hidden="true" /> {error}
        </p>
      )}
    </div>
  );
}

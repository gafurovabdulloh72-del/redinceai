"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { AlertCircle, CalendarPlus, Check, RotateCcw, X } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

async function patch<T>(specialistId: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/admin/subscriptions/${encodeURIComponent(specialistId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!json || !json.ok) {
    const field = json && !json.ok && json.fields ? Object.values(json.fields)[0] : null;
    throw new Error(field ?? (json && !json.ok ? json.error : "Server javob bermadi"));
  }
  return json.data;
}

const QUICK_DAYS = [7, 30, 90] as const;

/**
 * Admin: obunani qo'lda uzaytirish (kunlar + izoh) — inline oyna. PATCH {action:'extend', days, note}.
 * Pul harakati emas (bonus, kompensatsiya, naqd to'lov) — audit jurnaliga yoziladi, mutaxassisga bildirishnoma ketadi.
 */
export function AdminExtendButton({ specialistId, name }: { specialistId: string; name: string }) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState("30");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setDone(null), 4000);
    return () => window.clearTimeout(t);
  }, [done]);

  const n = Number(days);
  const valid = Number.isInteger(n) && n >= 1 && n <= 730;

  const submit = async () => {
    if (busy || !valid) return;
    setBusy(true);
    setError(null);
    try {
      const r = await patch<{ until: number }>(specialistId, { action: "extend", days: n, note: note.trim() || undefined });
      setOpen(false);
      setNote("");
      setDone(`${formatDate(r.until)} gacha`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kutilmagan xatolik");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-1 md:items-end">
        <Button size="sm" variant="outline" className="h-11 md:h-9" onClick={() => setOpen(true)} aria-label={`${name} obunasini uzaytirish`}>
          <CalendarPlus size={14} /> Uzaytirish
        </Button>
        {done && (
          <span role="status" className="text-[11px] font-medium text-success-text">
            Uzaytirildi: {done}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="card-outline flex w-full min-w-[240px] flex-col gap-2.5 !rounded-[var(--r-sm)] p-3 text-left md:w-[260px]" role="group" aria-label={`${name} obunasini uzaytirish`}>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_DAYS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(String(d))}
            className={cn("min-h-9 rounded-full border px-3 text-[12px] font-semibold transition", String(d) === days ? "border-fg bg-ink text-ink-fg" : "border-line bg-surface text-fg-2 hover:border-line-2")}
          >
            +{d} kun
          </button>
        ))}
      </div>
      <div>
        <label htmlFor={`${id}-days`} className="text-[11px] font-semibold text-fg-3">
          Kunlar soni (1–730)
        </label>
        <input id={`${id}-days`} className="field !min-h-10 !py-1.5 text-[13px]" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, "").slice(0, 3))} aria-invalid={!valid} />
      </div>
      <div>
        <label htmlFor={`${id}-note`} className="text-[11px] font-semibold text-fg-3">
          Izoh (audit jurnalida)
        </label>
        <input id={`${id}-note`} className="field !min-h-10 !py-1.5 text-[13px]" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: naqd to'lov, kompensatsiya" />
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-[12px] font-medium text-danger-text">
          <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
      <div className="flex gap-1.5">
        <Button size="sm" variant="primary" className="h-11 md:h-9" onClick={submit} disabled={busy || !valid}>
          {busy ? <Spinner className="h-3.5 w-3.5" /> : <Check size={14} />} Uzaytirish
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-11 md:h-9"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={busy}
        >
          Bekor
        </Button>
      </div>
    </div>
  );
}

type InvoiceAction = "confirm" | "refund" | "cancel";
const ACTION_LABEL: Record<InvoiceAction, string> = { confirm: "Tasdiqlash", refund: "Qaytarish", cancel: "Rad etish" };
const ACTION_CONFIRM: Record<InvoiceAction, string> = {
  confirm: "O'tkazma hisobga tushganini tekshirdingizmi? Obuna darhol uzayadi.",
  refund: "Obuna muddati shu davrga qisqaradi. Pulni provayder kabinetidan yoki qo'lda qaytaring.",
  cancel: "O'tkazma topilmadimi? Mutaxassisga bildirishnoma ketadi.",
};
const NOTE_REQUIRED: Record<InvoiceAction, boolean> = { confirm: false, refund: true, cancel: true };

/** Admin: obuna hisobi amallari (tasdiqlash / qaytarish / rad etish) — inline tasdiq va izoh bilan */
export function AdminInvoiceActions({ specialistId, invoiceId, state, provider, inFlight }: { specialistId: string; invoiceId: string; state: string; provider: string; inFlight: boolean }) {
  const router = useRouter();
  const id = useId();
  const [ask, setAsk] = useState<InvoiceAction | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actions: InvoiceAction[] =
    state === "paid" ? ["refund"] : provider === "manual" && (state === "pending" || state === "created") ? ["confirm", "cancel"] : (state === "pending" || state === "created") && !inFlight ? ["cancel"] : [];
  if (!actions.length) return <span className="text-[12px] text-fg-4">—</span>;

  const run = async (a: InvoiceAction) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await patch(specialistId, { action: a, invoiceId, note: note.trim() || undefined });
      setAsk(null);
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kutilmagan xatolik");
    } finally {
      setBusy(false);
    }
  };

  if (ask) {
    const tooShort = NOTE_REQUIRED[ask] && note.trim().length < 3;
    return (
      <div className="card-outline flex w-full min-w-[220px] flex-col gap-2 !rounded-[var(--r-sm)] p-2.5 text-left md:w-[250px]">
        <p className="flex items-start gap-1.5 text-[12px] text-fg">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-warning-text" /> {ACTION_CONFIRM[ask]}
        </p>
        <label htmlFor={`${id}-note`} className="sr-only">
          Izoh
        </label>
        <input
          id={`${id}-note`}
          className="field !min-h-10 !py-1.5 text-[13px]"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder={NOTE_REQUIRED[ask] ? "Sabab (majburiy)" : "Izoh (ixtiyoriy): chek raqami"}
          aria-required={NOTE_REQUIRED[ask]}
          autoFocus
        />
        {error && (
          <p role="alert" className="text-[12px] font-medium text-danger-text">
            {error}
          </p>
        )}
        <div className="flex gap-1.5">
          <Button size="sm" variant={ask === "confirm" ? "primary" : "danger"} className="h-11 md:h-9" onClick={() => run(ask)} disabled={busy || tooShort}>
            {busy ? <Spinner className="h-3.5 w-3.5" /> : <Check size={14} />} Ha
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-11 md:h-9"
            onClick={() => {
              setAsk(null);
              setNote("");
              setError(null);
            }}
            disabled={busy}
          >
            Yo&apos;q
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5 md:justify-end">
      {actions.map((a) => (
        <Button
          key={a}
          size="sm"
          variant={a === "confirm" ? "primary" : "outline"}
          className={cn("h-11 md:h-9", a !== "confirm" && "text-danger-text hover:border-danger hover:bg-danger-soft")}
          onClick={() => {
            setAsk(a);
            setNote("");
          }}
        >
          {a === "confirm" ? <Check size={14} /> : a === "refund" ? <RotateCcw size={14} /> : <X size={14} />}
          {ACTION_LABEL[a]}
        </Button>
      ))}
    </div>
  );
}

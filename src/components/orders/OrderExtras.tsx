"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, Check, HandCoins, Link2, Paperclip, Pencil, Plus, Trash2, Undo2, Video, X } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { AttachmentList } from "@/components/chat/OrderChat";
import { MAX_ATTACHMENTS, MAX_ORDER_ATTACHMENTS, UPLOAD_ACCEPT_DOCS, uploadAttachment, type Attachment } from "@/components/chat/attachments";
import { cn, formatNumber, formatPrice } from "@/lib/utils";

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!json) throw new Error("Server javob bermadi");
  if (!json.ok) throw new Error(json.fields ? Object.values(json.fields)[0] || json.error : json.error);
  return json.data;
}
const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : "Kutilmagan xatolik");

const MEETING_HOSTS_HINT = "Google Meet, Zoom yoki Telegram havolasi (https://…)";

/** Ruxsat etilgan video havola xostlari — server (/api/orders/[id]/meeting) bilan bir xil */
function isMeetingUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return h === "meet.google.com" || h === "zoom.us" || h.endsWith(".zoom.us") || h === "t.me" || h === "telegram.me";
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Video qo'ng'iroq havolasi (F40)                                     */
/* ------------------------------------------------------------------ */
export function MeetingLink({ orderId, url, editable, onChange }: { orderId: string; url: string | null; editable: boolean; onChange: (url: string | null) => void }) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(url ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputId = `meeting-${orderId}`;

  const save = async (value: string) => {
    if (value && !isMeetingUrl(value)) {
      setErr(`Faqat ${MEETING_HOSTS_HINT}`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const data = await call<{ meetingUrl: string | null }>(`/api/orders/${orderId}/meeting`, { method: "PATCH", body: JSON.stringify({ meetingUrl: value }) });
      onChange(data.meetingUrl);
      setEdit(false);
    } catch (e) {
      setErr(msg(e));
    } finally {
      setBusy(false);
    }
  };

  if (edit) {
    return (
      <div className="card-outline w-full !rounded-[16px] p-3">
        <label htmlFor={inputId} className="field-label">
          Video qo'ng'iroq havolasi
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={inputId}
            className="field flex-1 text-[14px]"
            type="url"
            inputMode="url"
            placeholder="https://meet.google.com/abc-defg-hij"
            value={draft}
            maxLength={300}
            onChange={(e) => {
              setDraft(e.target.value);
              setErr(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void save(draft.trim()))}
            aria-invalid={Boolean(err)}
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="md" onClick={() => void save(draft.trim())} disabled={busy || !draft.trim()} className="flex-1 sm:flex-none">
              {busy ? <Spinner /> : <Check size={15} />} Saqlash
            </Button>
            {url && (
              <Button size="md" variant="ghost" onClick={() => void save("")} disabled={busy} aria-label="Havolani olib tashlash">
                <Trash2 size={15} />
              </Button>
            )}
            <Button size="md" variant="ghost" onClick={() => setEdit(false)} disabled={busy} aria-label="Bekor qilish">
              <X size={15} />
            </Button>
          </div>
        </div>
        {err ? <p className="field-error">{err}</p> : <p className="mt-1.5 text-[12px] text-fg-4">{MEETING_HOSTS_HINT}. Qarshi tomonga chat orqali xabar boradi.</p>}
      </div>
    );
  }

  if (!url && !editable) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-info-soft px-4 text-[13px] font-semibold text-info-text transition hover:brightness-105">
          <Video size={15} /> Video qo'ng'iroq
        </a>
      ) : null}
      {editable && (
        <button
          type="button"
          onClick={() => {
            setDraft(url ?? "");
            setEdit(true);
          }}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-fg-3 transition hover:bg-fg/6 hover:text-fg"
        >
          {url ? <Pencil size={13} /> : <Link2 size={13} />}
          {url ? "Havolani o'zgartirish" : "Video qo'ng'iroq havolasi"}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buyurtma fayllari (F35)                                             */
/* ------------------------------------------------------------------ */
export function OrderAttachments({ orderId, items, editable, onChange }: { orderId: string; items: Attachment[]; editable: boolean; onChange: (items: Attachment[]) => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const room = Math.min(MAX_ATTACHMENTS, MAX_ORDER_ATTACHMENTS - items.length);

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []).slice(0, Math.max(0, room));
    e.target.value = "";
    if (!list.length) return;
    setBusy(true);
    setErr(null);
    try {
      const uploaded: Attachment[] = [];
      for (const f of list) uploaded.push(await uploadAttachment(f, { docs: true }));
      const data = await call<{ attachments: Attachment[] }>(`/api/orders/${orderId}/attachments`, { method: "PATCH", body: JSON.stringify({ add: uploaded }) });
      onChange(data.attachments);
    } catch (e2) {
      setErr(msg(e2));
    } finally {
      setBusy(false);
    }
  };

  if (!items.length && !editable) return null;
  const input = <input ref={fileRef} type="file" accept={UPLOAD_ACCEPT_DOCS} multiple className="hidden" onChange={pick} tabIndex={-1} />;
  // Fayl yo'q — kartani to'ldirmaslik uchun faqat ixcham tugma (video havola tugmasi yonida)
  if (!items.length) {
    return (
      <span className="inline-flex flex-col">
        {input}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          title="Brief yoki referens — rasm (JPG, PNG, WEBP, GIF) yoki hujjat (PDF, DOC, DOCX)"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-fg-3 transition hover:bg-fg/6 hover:text-fg disabled:opacity-50"
        >
          {busy ? <Spinner className="h-3.5 w-3.5" /> : <Paperclip size={13} />} Fayl biriktirish
        </button>
        {err && (
          <span role="alert" className="flex items-center gap-1.5 px-3 text-[12px] font-medium text-danger-text">
            <AlertCircle size={13} /> {err}
          </span>
        )}
      </span>
    );
  }
  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">
          <Paperclip size={12} /> Fayllar{items.length ? ` · ${items.length}` : ""}
        </p>
        {editable && room > 0 && (
          <>
            {input}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-accent-text transition hover:bg-accent-soft disabled:opacity-50"
            >
              {busy ? <Spinner className="h-3.5 w-3.5" /> : <Plus size={13} />} Fayl qo'shish
            </button>
          </>
        )}
      </div>
      <AttachmentList items={items} />
      {err && (
        <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-danger-text">
          <AlertCircle size={13} /> {err}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Narxni muhokama qilish / qarshi taklif (F16)                         */
/* ------------------------------------------------------------------ */
export interface CounterResult {
  amount: number | null;
  urgentFee: number | null;
  counterAmount: number | null;
  counterBy: "client" | "specialist" | null;
  commissionPct: number | null;
}

export function CounterOffer({
  orderId,
  isSpecialist,
  baseAmount,
  counterAmount,
  counterBy,
  urgentPct,
  urgent,
  minOrderAmount,
  onChange,
}: {
  orderId: string;
  isSpecialist: boolean;
  /** Joriy asosiy narx (ustamasiz) */
  baseAmount: number;
  counterAmount: number | null;
  counterBy: "client" | "specialist" | null;
  urgentPct: number;
  urgent: boolean;
  minOrderAmount: number;
  onChange: (r: CounterResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const value = Number(draft.replace(/\D/g, "")) || 0;
  const pending = counterBy === "client" && counterAmount != null;
  const inputId = `counter-${orderId}`;

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      const data = await call<CounterResult>(`/api/orders/${orderId}/counter`, { method: "PATCH", body: JSON.stringify(body) });
      onChange(data);
      setOpen(false);
      setDraft("");
    } catch (e) {
      setErr(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const withFee = (n: number) => (urgent ? n + Math.round((n * urgentPct) / 100) : n);

  if (pending) {
    return (
      <div className="mt-2 rounded-[14px] border border-line bg-surface px-3.5 py-3">
        <p className="flex items-start gap-2 text-[13px] leading-snug text-fg-2">
          <HandCoins size={15} className="mt-0.5 shrink-0 text-accent" />
          <span>
            {isSpecialist ? "Mijoz narx taklif qildi: " : "Siz taklif qildingiz: "}
            <span className="font-semibold text-fg">{formatPrice(counterAmount)}</span>
            {urgent && <span className="text-fg-3"> (+ ustama = {formatPrice(withFee(counterAmount))})</span>}
            <span className="text-fg-3"> · joriy narx {formatPrice(baseAmount)}</span>
            {!isSpecialist && <span className="mt-0.5 block text-[12px] text-fg-3">Mutaxassis javobini kuting — qabul qilsa, yangi narx bilan to'laysiz.</span>}
          </span>
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {isSpecialist ? (
            <>
              <Button size="sm" variant="accent" className="!h-10" onClick={() => void act({ action: "accept" })} disabled={busy}>
                {busy ? <Spinner /> : <Check size={14} />} Qabul qilish
              </Button>
              <Button size="sm" variant="outline" className="!h-10" onClick={() => void act({ action: "decline" })} disabled={busy}>
                <X size={14} /> Rad etish
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" className="!h-10" onClick={() => void act({ action: "withdraw" })} disabled={busy}>
              <Undo2 size={14} /> Taklifni qaytarib olish
            </Button>
          )}
        </div>
        {isSpecialist && <p className="mt-2 text-[12px] text-fg-4">Boshqa summa taklif qilmoqchi bo'lsangiz — «Narxni o'zgartirish» orqali yangi narx belgilang.</p>}
        {err && <p className="field-error">{err}</p>}
      </div>
    );
  }

  if (isSpecialist) return null;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-full px-1 text-[13px] font-semibold text-fg-2 transition hover:text-fg">
        <HandCoins size={15} className="text-accent" /> Narxni muhokama qilish
      </button>
    );
  }

  return (
    <div className="card-outline mt-2 !rounded-[16px] p-3.5">
      <label htmlFor={inputId} className="field-label">
        Sizning taklifingiz (so'm)
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <input
            id={inputId}
            className="field !pr-14 tabular-nums"
            inputMode="numeric"
            autoComplete="off"
            placeholder={formatNumber(Math.max(minOrderAmount, Math.round((baseAmount * 0.85) / 10_000) * 10_000))}
            value={draft}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
              setDraft(digits ? formatNumber(Number(digits)) : "");
              setErr(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && value > 0 && (e.preventDefault(), void act({ action: "propose", amount: value }))}
            aria-invalid={Boolean(err)}
            autoFocus
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-fg-3">so'm</span>
        </div>
        <div className="flex gap-2">
          <Button size="md" onClick={() => void act({ action: "propose", amount: value })} disabled={busy || value < minOrderAmount} className="flex-1 sm:flex-none">
            {busy ? <Spinner /> : <HandCoins size={15} />} Taklif yuborish
          </Button>
          <Button size="md" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Bekor
          </Button>
        </div>
      </div>
      {err ? (
        <p className="field-error">{err}</p>
      ) : (
        <p className={cn("mt-1.5 text-[12px] text-fg-4")}>
          Joriy narx {formatPrice(baseAmount)}.{urgent && value > 0 ? ` Shoshilinch ustama bilan: ${formatPrice(withFee(value))}.` : ""} Mutaxassis qabul qilsa yoki rad etsa, sizga xabar keladi.
        </p>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, Banknote, Check, CheckCircle2, Copy, ExternalLink, Eye, EyeOff, ShieldAlert, X } from "lucide-react";
import { Avatar, Badge, Button, EmptyState, Spinner } from "@/components/ui";
import { PAYOUT_METHOD_LABEL, PAYOUT_TONE, type PayoutState } from "@/components/payments/tones";
import { PAYOUT_STATE_LABEL } from "@/lib/constants";
import { cn, formatDateTime, formatPrice, timeAgo } from "@/lib/utils";

export interface AdminPayoutRow {
  id: string;
  amount: number;
  state: PayoutState;
  method: "card" | "bank" | "cash";
  details: string;
  note: string | null;
  createdAt: number;
  processedAt: number | null;
  /** Mutaxassisning released balansi (ochiq so'rovlar ayrilmagan) */
  releasedBalance: number;
  specialist: { id: string; slug: string; title: string; name: string; email: string; phone: string | null };
}

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

/** 409 — holat biz ko'rsatganimizdan o'zgargan (boshqa admin/oynadan): ro'yxatni yangilash kerak */
class ConflictError extends Error {}

async function decide(id: string, state: PayoutState, note?: string, reference?: string) {
  // API yangi shaklda action+reference qabul qiladi; eski `state` kaliti ham yuboriladi (moslik uchun)
  const res = await fetch(`/api/admin/payouts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, action: state, note, reference: reference || undefined }) });
  const json = (await res.json().catch(() => null)) as ApiResponse<{ state: PayoutState; note: string | null; processedAt: number | null }> | null;
  if (res.status === 409) throw new ConflictError((json && !json.ok && json.error) || "Holat o'zgargan — yangilang");
  if (!json) throw new Error("Server javob bermadi");
  if (!json.ok) throw new Error(json.fields?.note ?? json.fields?.reference ?? json.error);
  return json.data;
}
const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : "Kutilmagan xatolik");

/** To'liq rekvizit (shifrlangan) — admin ochganda audit jurnaliga yoziladi (E55) */
async function revealDetails(id: string): Promise<string | null> {
  const res = await fetch(`/api/admin/payouts/${id}/details`, { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as ApiResponse<{ details: string | null; masked: string }> | null;
  if (!json) throw new Error("Server javob bermadi");
  if (!json.ok) throw new Error(json.error);
  return json.data.details;
}

/** Payout navbati: so'ralgan → tasdiqlangan → to'langan, yoki rad (sabab bilan, inline) */
export function AdminPayoutsQueue({ rows: initialRows }: { rows: AdminPayoutRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [seen, setSeen] = useState(initialRows);
  if (seen !== initialRows) {
    setSeen(initialRows);
    setRows(initialRows);
  }
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  /** "To'landi" inline tasdiq paneli ochiq so'rov + ixtiyoriy o'tkazma raqami (referens) */
  const [paying, setPaying] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  /** Ochilgan to'liq rekvizitlar: id → matn (null = shifrlanmagan eski so'rov) */
  const [revealed, setRevealed] = useState<Record<string, string | null>>({});
  const [revealing, setRevealing] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const reveal = async (row: AdminPayoutRow) => {
    if (revealing) return;
    if (row.id in revealed) {
      setRevealed((m) => {
        const next = { ...m };
        delete next[row.id];
        return next;
      });
      return;
    }
    setError(null);
    setRevealing(row.id);
    try {
      const full = await revealDetails(row.id);
      setRevealed((m) => ({ ...m, [row.id]: full }));
    } catch (e) {
      setError(msg(e));
    } finally {
      setRevealing(null);
    }
  };

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      /* clipboard mavjud emas */
    }
  };

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(t);
  }, [notice]);

  const open = rows.filter((r) => r.state === "requested" || r.state === "approved");
  const closed = rows.filter((r) => r.state === "paid" || r.state === "rejected");

  const act = async (row: AdminPayoutRow, state: PayoutState, why?: string, ref?: string) => {
    if (busy) return;
    setError(null);
    setBusy(row.id);
    try {
      const data = await decide(row.id, state, why, ref);
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, state: data.state, note: data.note, processedAt: data.processedAt } : r)));
      setRejecting(null);
      setPaying(null);
      setNote("");
      setReference("");
      setNotice(state === "paid" ? `${row.specialist.name} — ${formatPrice(row.amount)} to'landi deb belgilandi` : state === "approved" ? `${row.specialist.name} so'rovi tasdiqlandi` : `${row.specialist.name} so'rovi rad etildi`);
      router.refresh();
    } catch (e) {
      setError(msg(e));
      // Holat eskirgan (409) — serverdagi yangi holatni darhol tortib kelamiz
      if (e instanceof ConflictError) {
        setPaying(null);
        setRejecting(null);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  };

  const Row = ({ r }: { r: AdminPayoutRow }) => {
    const isOpen = r.state === "requested" || r.state === "approved";
    const covered = r.releasedBalance >= r.amount;
    const b = busy === r.id;
    return (
      <li className={cn("px-4 py-4 sm:px-5", b && "opacity-60")}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          {/* Kim */}
          <div className="flex min-w-0 items-start gap-3 lg:w-[34%]">
            <Avatar name={r.specialist.name} size={40} decorative />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[14px] font-semibold text-fg">
                <span className="truncate">{r.specialist.name}</span>
                <Link href={`/mutaxassislar/${r.specialist.slug}`} target="_blank" rel="noreferrer" aria-label="Ommaviy profil" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-fg-4 transition hover:bg-fg/6 hover:text-fg">
                  <ExternalLink size={13} />
                </Link>
              </p>
              <p className="truncate text-[12px] text-fg-3">{r.specialist.title}</p>
              <p className="truncate text-[12px] text-fg-4">
                {r.specialist.email}
                {r.specialist.phone ? ` · ${r.specialist.phone}` : ""}
              </p>
            </div>
          </div>

          {/* Summa + rekvizit */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] lg:w-[36%]">
            <div>
              <dt className="text-fg-4">Summa</dt>
              <dd className="font-display text-[18px] font-semibold text-fg tabular-nums">{formatPrice(r.amount)}</dd>
            </div>
            <div>
              <dt className="text-fg-4">Balans (released)</dt>
              <dd className={cn("inline-flex items-center gap-1 font-semibold tabular-nums", covered ? "text-success" : "text-danger")}>
                {covered ? <Check size={13} /> : <ShieldAlert size={13} />} {formatPrice(r.releasedBalance)}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-fg-4">{PAYOUT_METHOD_LABEL[r.method]}</dt>
              <dd className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-mono text-[13px] text-fg">{r.id in revealed ? (revealed[r.id] ?? r.details) : r.details}</span>
                <button
                  type="button"
                  onClick={() => reveal(r)}
                  disabled={revealing === r.id}
                  className="inline-flex min-h-7 items-center gap-1 rounded-full px-1.5 text-[11px] font-semibold text-fg-3 transition hover:bg-fg/6 hover:text-fg disabled:opacity-50"
                  aria-pressed={r.id in revealed}
                  title="Ochish audit jurnaliga yoziladi"
                >
                  {revealing === r.id ? <Spinner className="h-3 w-3" /> : r.id in revealed ? <EyeOff size={12} /> : <Eye size={12} />}
                  {r.id in revealed ? "Yashirish" : "Rekvizitni ko'rsatish"}
                </button>
                {r.id in revealed && revealed[r.id] && (
                  <button type="button" onClick={() => copy(r.id, revealed[r.id] ?? "")} className="inline-flex min-h-7 items-center gap-1 rounded-full px-1.5 text-[11px] font-semibold text-fg-3 transition hover:bg-fg/6 hover:text-fg">
                    <Copy size={12} /> {copied === r.id ? "Nusxalandi" : "Nusxalash"}
                  </button>
                )}
                {r.id in revealed && revealed[r.id] == null && <span className="text-[11px] text-fg-4">To'liq rekvizit saqlanmagan (eski so'rov) — mutaxassisdan so'rang</span>}
              </dd>
            </div>
            {r.note && (
              <div className="col-span-2">
                <dt className="text-fg-4">Izoh</dt>
                <dd className="text-fg-2">{r.note}</dd>
              </div>
            )}
          </dl>

          {/* Holat + amallar */}
          <div className="flex flex-col items-start gap-2 lg:w-[30%] lg:items-end">
            <div className="flex items-center gap-2">
              <Badge tone={PAYOUT_TONE[r.state]}>{PAYOUT_STATE_LABEL[r.state]}</Badge>
              <time dateTime={new Date(r.processedAt ?? r.createdAt).toISOString()} className="text-[11px] text-fg-4" title={formatDateTime(r.processedAt ?? r.createdAt)} suppressHydrationWarning>
                {timeAgo(r.processedAt ?? r.createdAt)}
              </time>
            </div>
            {isOpen && rejecting !== r.id && paying !== r.id && (
              <div className="flex flex-wrap gap-1.5 lg:justify-end">
                {r.state === "requested" && (
                  <Button size="sm" variant="outline" className="h-11 md:h-9" onClick={() => act(r, "approved")} disabled={!!busy}>
                    {b ? <Spinner className="h-3.5 w-3.5" /> : <Check size={14} />} Tasdiqlash
                  </Button>
                )}
                {/* Yangi tartib: avval tasdiqlash, keyin to'lash — "requested" holatida tugma faol emas */}
                <Button
                  size="sm"
                  className="h-11 md:h-9"
                  onClick={() => {
                    setPaying(r.id);
                    setReference("");
                    setRejecting(null);
                  }}
                  disabled={!!busy || !covered || r.state !== "approved"}
                  title={r.state !== "approved" ? "Avval so'rovni tasdiqlang" : covered ? "O'tkazma qilingach bosing" : "Balans yetarli emas"}
                >
                  {b ? <Spinner className="h-3.5 w-3.5" /> : <Banknote size={14} />} To'landi
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-11 text-danger-text hover:!bg-danger-soft hover:!text-danger-text md:h-9"
                  onClick={() => {
                    setRejecting(r.id);
                    setPaying(null);
                    setNote("");
                  }}
                  disabled={!!busy}
                >
                  <X size={14} /> Rad etish
                </Button>
              </div>
            )}
          </div>
        </div>

        {paying === r.id && (
          <div className="card-outline mt-3 flex flex-col gap-2 !rounded-[16px] p-3 animate-fade-up sm:flex-row sm:items-end" style={{ animationDuration: "0.2s" }}>
            <div className="flex-1">
              <label htmlFor={`ref-${r.id}`} className="field-label">
                O'tkazma raqami (referens) — ixtiyoriy
              </label>
              <input id={`ref-${r.id}`} className="field" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={64} placeholder="Masalan: bank o'tkazmasi ID (3–64 belgi)" autoFocus />
              <p className="mt-1 text-[11px] text-fg-4">
                {formatPrice(r.amount)} — {r.details} rekvizitiga o'tkazma bajarilganini tasdiqlaysiz.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="md" onClick={() => act(r, "paid", undefined, reference.trim() || undefined)} disabled={!!busy || (reference.trim().length > 0 && reference.trim().length < 3)}>
                {b ? <Spinner /> : <Banknote size={15} />} Ha, to'landi
              </Button>
              <Button size="md" variant="ghost" onClick={() => setPaying(null)} disabled={!!busy}>
                Bekor
              </Button>
            </div>
          </div>
        )}

        {rejecting === r.id && (
          <div className="card-outline mt-3 flex flex-col gap-2 !rounded-[16px] p-3 animate-fade-up sm:flex-row sm:items-end" style={{ animationDuration: "0.2s" }}>
            <div className="flex-1">
              <label htmlFor={`note-${r.id}`} className="field-label">
                Rad etish sababi (mutaxassisga ko'rinadi)
              </label>
              <input id={`note-${r.id}`} className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Masalan: karta raqami noto'g'ri" autoFocus />
            </div>
            <div className="flex gap-2">
              <Button size="md" variant="danger" onClick={() => act(r, "rejected", note)} disabled={!!busy || note.trim().length < 3}>
                {b ? <Spinner /> : <X size={15} />} Rad etish
              </Button>
              <Button size="md" variant="ghost" onClick={() => setRejecting(null)} disabled={!!busy}>
                Bekor
              </Button>
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-3">
      <div aria-live="polite" className="space-y-2 empty:hidden">
        {error && (
          <p className="flex items-center gap-2 rounded-[14px] bg-danger-soft px-4 py-2.5 text-[13px] font-medium text-danger-text">
            <AlertCircle size={15} /> {error}
          </p>
        )}
        {notice && (
          <p className="flex items-center gap-2 rounded-[14px] bg-success-soft px-4 py-2.5 text-[13px] font-medium text-success-text animate-fade-up" style={{ animationDuration: "0.25s" }}>
            <CheckCircle2 size={15} /> {notice}
          </p>
        )}
      </div>

      {open.length === 0 ? (
        <EmptyState icon={Banknote} title="Ochiq so'rovlar yo'q" description="Mutaxassis pul chiqarishni so'raganda shu yerda ko'rinadi." />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {open.map((r) => (
            <Row key={r.id} r={r} />
          ))}
        </ul>
      )}

      {closed.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowClosed((v) => !v)} className="inline-flex min-h-10 items-center gap-1.5 px-1 text-[13px] font-semibold text-fg-2 transition hover:text-fg" aria-expanded={showClosed}>
            {showClosed ? "Yopilganlarni yashirish" : `Yopilgan so'rovlar (${closed.length})`}
          </button>
          {showClosed && (
            <ul className="card mt-2 divide-y divide-line overflow-hidden">
              {closed.map((r) => (
                <Row key={r.id} r={r} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

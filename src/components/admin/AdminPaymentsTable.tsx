"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRightLeft, Check, CheckCircle2, Receipt, RotateCcw, X } from "lucide-react";
import { Badge, Button, EmptyState, Spinner } from "@/components/ui";
import { PAYMENT_TONE, PROVIDER_LABEL, type PaymentState } from "@/components/payments/tones";
import { PAYMENT_STATE_LABEL, type PaymentProvider } from "@/lib/constants";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";

export interface AdminPaymentRow {
  id: string;
  orderId: string;
  orderTitle: string;
  provider: PaymentProvider;
  state: PaymentState;
  amount: number;
  commissionPct: number;
  commissionAmount: number;
  netAmount: number;
  providerTxnId: string | null;
  createdAt: number;
  paidAt: number | null;
  releasedAt: number | null;
  client: { name: string; email: string };
  specialist: { id: string; slug: string; name: string };
}

type Action = "confirm" | "release" | "refund" | "cancel";
type FilterKey = "all" | "open" | "paid" | "released" | "closed";
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

const FILTERS: Array<{ key: FilterKey; label: string; match: (s: PaymentState) => boolean }> = [
  { key: "all", label: "Barchasi", match: () => true },
  { key: "open", label: "Kutilmoqda", match: (s) => s === "created" || s === "pending" },
  { key: "paid", label: "Eskrouda", match: (s) => s === "paid" },
  { key: "released", label: "O'tkazilgan", match: (s) => s === "released" },
  { key: "closed", label: "Bekor / qaytarilgan", match: (s) => s === "cancelled" || s === "refunded" },
];

const ACTION_LABEL: Record<Action, string> = { confirm: "Tasdiqlash", release: "Mutaxassisga o'tkazish", refund: "Mijozga qaytarish", cancel: "Bekor qilish" };
const ACTION_CONFIRM: Record<Action, string> = {
  confirm: "O'tkazma hisobga tushganini tekshirdingizmi? Buyurtma «To'langan (eskrou)» bo'ladi.",
  release: "Eskroudagi sof summa mutaxassis balansiga o'tadi va buyurtma yakunlanadi. Qaytarib bo'lmaydi.",
  refund: "Pul mijozga qaytarilgan deb belgilanadi (Payme/Click'da qaytarishni provayder kabinetida ham bajaring).",
  cancel: "Hali to'lanmagan urinish bekor qilinadi.",
};

function actionsFor(r: AdminPaymentRow): Action[] {
  if (r.state === "paid") return ["release", "refund"];
  if (r.state === "pending" && r.provider === "manual") return ["confirm", "cancel"];
  if (r.state === "pending" || r.state === "created") return ["cancel"];
  return [];
}

/** Admin: barcha to'lovlar — filtr, jami va amallar (inline tasdiq bilan) */
export function AdminPaymentsTable({ rows: initialRows }: { rows: AdminPaymentRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [seen, setSeen] = useState(initialRows);
  if (seen !== initialRows) {
    setSeen(initialRows);
    setRows(initialRows);
  }
  const [filter, setFilter] = useState<FilterKey>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ id: string; action: Action } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(t);
  }, [notice]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter((r) => f.match(r.state)).length])) as Record<FilterKey, number>, [rows]);
  const visible = rows.filter((r) => FILTERS.find((f) => f.key === filter)!.match(r.state));
  const totals = useMemo(
    () => ({
      amount: visible.reduce((s, r) => s + (r.state === "paid" || r.state === "released" ? r.amount : 0), 0),
      commission: visible.reduce((s, r) => s + (r.state === "paid" || r.state === "released" ? r.commissionAmount : 0), 0),
    }),
    [visible],
  );

  const run = async (r: AdminPaymentRow, action: Action) => {
    if (busy) return;
    setError(null);
    setBusy(r.id);
    setAsk(null);
    try {
      const res = await fetch(`/api/admin/payments/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ state: PaymentState }> | null;
      if (!json || !json.ok) throw new Error(json?.error ?? "Server javob bermadi");
      setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, state: json.data.state } : x)));
      setNotice(`${r.orderTitle}: ${ACTION_LABEL[action].toLowerCase()} — bajarildi`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Kutilmagan xatolik");
    } finally {
      setBusy(null);
    }
  };

  const Actions = ({ r }: { r: AdminPaymentRow }) => {
    const acts = actionsFor(r);
    if (!acts.length) return <span className="text-[12px] text-fg-4">—</span>;
    const b = busy === r.id;
    if (ask?.id === r.id) {
      return (
        <div className="card-outline flex flex-col gap-2 !rounded-[14px] p-2.5 text-left animate-fade-up" style={{ animationDuration: "0.2s" }}>
          <p className="flex items-start gap-1.5 text-[12px] text-fg">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-warning" /> {ACTION_CONFIRM[ask.action]}
          </p>
          <div className="flex gap-1.5">
            <Button size="sm" variant={ask.action === "refund" || ask.action === "cancel" ? "danger" : "primary"} className="h-11 md:h-9" onClick={() => run(r, ask.action)} disabled={!!busy}>
              {b ? <Spinner className="h-3.5 w-3.5" /> : <Check size={14} />} Ha
            </Button>
            <Button size="sm" variant="ghost" className="h-11 md:h-9" onClick={() => setAsk(null)} disabled={!!busy}>
              Yo'q
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap gap-1.5 md:justify-end">
        {acts.map((a) => (
          <Button
            key={a}
            size="sm"
            variant={a === "release" || a === "confirm" ? "primary" : "outline"}
            className={cn("h-11 md:h-9", (a === "refund" || a === "cancel") && "text-danger hover:border-danger hover:bg-danger-soft")}
            onClick={() => setAsk({ id: r.id, action: a })}
            disabled={!!busy}
          >
            {b ? <Spinner className="h-3.5 w-3.5" /> : a === "confirm" ? <Check size={14} /> : a === "release" ? <ArrowRightLeft size={14} /> : a === "refund" ? <RotateCcw size={14} /> : <X size={14} />}
            {ACTION_LABEL[a]}
          </Button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="segment" role="group" aria-label="To'lov holati bo'yicha filtr">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" className="segment-item inline-flex min-h-10 items-center gap-1.5" data-active={filter === f.key} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}>
                {f.label} <span className="text-[11px] opacity-70">{counts[f.key]}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="text-[12px] text-fg-3">
          Ko'rinayotgan: <span className="font-semibold text-fg tabular-nums">{formatPrice(totals.amount, { compact: true })}</span> aylanma · komissiya{" "}
          <span className="font-semibold text-fg tabular-nums">{formatPrice(totals.commission, { compact: true })}</span>
        </p>
      </div>

      <div aria-live="polite" className="space-y-2 empty:hidden">
        {error && (
          <p className="flex items-center gap-2 rounded-[14px] bg-danger-soft px-4 py-2.5 text-[13px] font-medium text-danger">
            <AlertCircle size={15} /> {error}
          </p>
        )}
        {notice && (
          <p className="flex items-center gap-2 rounded-[14px] bg-success-soft px-4 py-2.5 text-[13px] font-medium text-success animate-fade-up" style={{ animationDuration: "0.25s" }}>
            <CheckCircle2 size={15} /> {notice}
          </p>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Receipt} title="To'lovlar yo'q" description="Mijoz buyurtma uchun to'lov boshlaganda shu yerda ko'rinadi." />
      ) : (
        <div className="card overflow-hidden">
          {/* Desktop */}
          <table className="hidden w-full text-left text-[13px] md:table">
            <thead>
              <tr className="border-b border-line text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">
                <th className="px-5 py-3 font-bold">Buyurtma</th>
                <th className="px-3 py-3 font-bold">Mijoz → Mutaxassis</th>
                <th className="px-3 py-3 font-bold">Usul</th>
                <th className="px-3 py-3 text-right font-bold">Summa</th>
                <th className="px-3 py-3 text-right font-bold">Komissiya</th>
                <th className="px-3 py-3 font-bold">Holat</th>
                <th className="px-5 py-3 text-right font-bold">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((r) => (
                <tr key={r.id} className={cn("align-top transition hover:bg-fg/3", busy === r.id && "opacity-60")}>
                  <td className="max-w-[220px] px-5 py-3">
                    <Link href={`/kabinet/buyurtmalar?id=${r.orderId}`} className="block truncate font-semibold text-fg hover:text-accent">
                      {r.orderTitle}
                    </Link>
                    <span className="block text-[11px] text-fg-4">{formatDateTime(r.paidAt ?? r.createdAt)}</span>
                  </td>
                  <td className="px-3 py-3 text-fg-2">
                    <span className="block truncate">{r.client.name}</span>
                    <Link href={`/mutaxassislar/${r.specialist.slug}`} className="block truncate text-[12px] text-fg-3 hover:text-accent">
                      → {r.specialist.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-fg-2">
                    {PROVIDER_LABEL[r.provider]}
                    {r.providerTxnId && <span className="block max-w-[120px] truncate font-mono text-[11px] text-fg-4">{r.providerTxnId}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-fg tabular-nums">{formatPrice(r.amount)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                    <span className="block text-fg">{formatPrice(r.commissionAmount)}</span>
                    <span className="block text-[11px] text-fg-4">{r.commissionPct}%</span>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={PAYMENT_TONE[r.state]}>{PAYMENT_STATE_LABEL[r.state]}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Actions r={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobil */}
          <ul className="divide-y divide-line md:hidden">
            {visible.map((r) => (
              <li key={r.id} className={cn("px-4 py-4", busy === r.id && "opacity-60")}>
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/kabinet/buyurtmalar?id=${r.orderId}`} className="min-w-0 flex-1 truncate text-[14px] font-semibold text-fg">
                    {r.orderTitle}
                  </Link>
                  <Badge tone={PAYMENT_TONE[r.state]} className="shrink-0">
                    {PAYMENT_STATE_LABEL[r.state]}
                  </Badge>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                  <div>
                    <dt className="text-fg-4">Mijoz</dt>
                    <dd className="truncate text-fg-2">{r.client.name}</dd>
                  </div>
                  <div>
                    <dt className="text-fg-4">Mutaxassis</dt>
                    <dd className="truncate text-fg-2">{r.specialist.name}</dd>
                  </div>
                  <div>
                    <dt className="text-fg-4">Summa · {PROVIDER_LABEL[r.provider]}</dt>
                    <dd className="font-semibold text-fg tabular-nums">{formatPrice(r.amount)}</dd>
                  </div>
                  <div>
                    <dt className="text-fg-4">Komissiya {r.commissionPct}%</dt>
                    <dd className="text-fg tabular-nums">{formatPrice(r.commissionAmount)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-fg-4">Sana</dt>
                    <dd className="text-fg-2">{formatDateTime(r.paidAt ?? r.createdAt)}</dd>
                  </div>
                </dl>
                {actionsFor(r).length > 0 && (
                  <div className="mt-3 border-t border-line pt-3">
                    <Actions r={r} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

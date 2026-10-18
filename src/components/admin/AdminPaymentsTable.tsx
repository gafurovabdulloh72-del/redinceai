"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRightLeft, Check, CheckCircle2, FileText, Receipt, RotateCcw, X } from "lucide-react";
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

/** service.ts PROVIDER_PENDING_TTL_MS bilan bir xil (server-only moduldan import qilib bo'lmaydi) */
const PROVIDER_PENDING_TTL_MS = 12 * 60 * 60 * 1000;
/** Ro'yxatda dastlab ko'rsatiladigan qatorlar (uzun sahifa o'rniga «Yana ko'rsatish») */
const PAGE_CAP = 15;
/** Admin buyurtma sahifasi (to'lovlar, tomonlar, jurnal — bir joyda) */
const orderHref = (orderId: string) => `/admin/buyurtmalar/${orderId}`;

const ACTION_LABEL: Record<Action, string> = { confirm: "Tasdiqlash", release: "Mutaxassisga o'tkazish", refund: "Mijozga qaytarish", cancel: "Bekor qilish" };
/** Jadval ustunida — ixcham (to'liq matn title'da) */
const ACTION_LABEL_SHORT: Record<Action, string> = { confirm: "Tasdiqlash", release: "O'tkazish", refund: "Qaytarish", cancel: "Bekor" };
const ACTION_CONFIRM: Record<Action, string> = {
  confirm: "O'tkazma hisobga tushganini tekshirdingizmi? Buyurtma «To'langan (eskrou)» bo'ladi.",
  release: "Eskroudagi sof summa mutaxassis balansiga o'tadi va buyurtma yakunlanadi. Qaytarib bo'lmaydi.",
  refund: "Pul mijozga qaytarilgan deb belgilanadi (Payme/Click'da qaytarishni provayder kabinetida ham bajaring).",
  cancel: "Hali to'lanmagan urinish bekor qilinadi. Qo'lda o'tkazmada mijozga «O'tkazma tasdiqlanmadi» xabari va izohingiz boradi.",
};
/** Izoh: qaytarish/bekor qilishda majburiy (audit jurnalida ko'rinadi), tasdiqlash/o'tkazishda ixtiyoriy */
const NOTE_REQUIRED: Record<Action, boolean> = { confirm: false, release: false, refund: true, cancel: true };
const NOTE_PLACEHOLDER: Record<Action, string> = {
  confirm: "Izoh (ixtiyoriy): chek raqami, bank ko'chirmasi…",
  release: "Izoh (ixtiyoriy): nega admin o'tkazdi",
  refund: "Sabab: masalan, mijoz buyurtmani bekor qildi, ish bajarilmadi",
  cancel: "Sabab: masalan, mijoz boshqa usul bilan to'ladi",
};
const ACTION_ICON: Record<Action, typeof Check> = { confirm: Check, release: ArrowRightLeft, refund: RotateCcw, cancel: X };

function actionsFor(r: AdminPaymentRow): Action[] {
  if (r.state === "paid") return ["release", "refund"];
  if (r.state === "pending" && r.provider === "manual") return ["confirm", "cancel"];
  // Payme/Click tomonida jarayondagi (12 soatdan yangi) tranzaksiyani faqat provayder yopadi — server ham 409 qaytaradi
  if (r.state === "pending" && Date.now() - r.createdAt <= PROVIDER_PENDING_TTL_MS) return [];
  if (r.state === "pending" || r.state === "created") return ["cancel"];
  return [];
}

/**
 * Admin: barcha to'lovlar — filtr, jami va amallar (inline tasdiq bilan).
 * Jadval konteyner so'rovlari bilan moslashadi (@container): tor konteynerda «Usul» va «Komissiya» ustunlari
 * yig'iladi (ma'lumot «Summa» ostida), shuning uchun «Holat» va «Amallar» hech qachon qisilmaydi.
 */
export function AdminPaymentsTable({ rows: initialRows }: { rows: AdminPaymentRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [seen, setSeen] = useState(initialRows);
  if (seen !== initialRows) {
    setSeen(initialRows);
    setRows(initialRows);
  }
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ id: string; action: Action } | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(t);
  }, [notice]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter((r) => f.match(r.state)).length])) as Record<FilterKey, number>, [rows]);
  const visible = rows.filter((r) => FILTERS.find((f) => f.key === filter)!.match(r.state));
  const shown = showAll ? visible : visible.slice(0, PAGE_CAP);
  const totals = useMemo(
    () => ({
      amount: visible.reduce((s, r) => s + (r.state === "paid" || r.state === "released" ? r.amount : 0), 0),
      commission: visible.reduce((s, r) => s + (r.state === "paid" || r.state === "released" ? r.commissionAmount : 0), 0),
    }),
    [visible],
  );

  const run = async (r: AdminPaymentRow, action: Action, why: string) => {
    if (busy) return;
    setError(null);
    setBusy(r.id);
    setAsk(null);
    const clean = why.trim();
    try {
      const res = await fetch(`/api/admin/payments/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note: clean || undefined }) });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ state: PaymentState }> | null;
      if (!json || !json.ok) throw new Error(json?.error ?? "Server javob bermadi");
      setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, state: json.data.state } : x)));
      setNote("");
      setNotice(`${r.orderTitle}: ${ACTION_LABEL[action].toLowerCase()} — bajarildi${clean ? ` · Izoh: ${clean}` : ""}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kutilmagan xatolik");
    } finally {
      setBusy(null);
    }
  };

  const Actions = ({ r }: { r: AdminPaymentRow }) => {
    const acts = actionsFor(r);
    if (!acts.length) return <span className="text-[12px] text-fg-4">—</span>;
    const b = busy === r.id;
    if (ask?.id === r.id) {
      const required = NOTE_REQUIRED[ask.action];
      const tooShort = required && note.trim().length < 3;
      return (
        <div className="card-outline expand-in flex min-w-[220px] flex-col gap-2 whitespace-normal !rounded-[14px] p-2.5 text-left" role="group" aria-label={ACTION_LABEL[ask.action]}>
          <p className="flex items-start gap-1.5 text-[12px] text-fg">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-warning" /> {ACTION_CONFIRM[ask.action]}
          </p>
          <div>
            <label htmlFor={`pnote-${r.id}`} className="sr-only">
              Izoh
            </label>
            <input
              id={`pnote-${r.id}`}
              className="field !min-h-10 !py-1.5 text-[13px]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder={NOTE_PLACEHOLDER[ask.action]}
              aria-required={required}
              autoFocus
            />
            <p className="mt-1 text-[11px] text-fg-4">{required ? "Sabab majburiy — audit jurnalida ko'rinadi" : "Audit jurnalida ko'rinadi"}</p>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant={ask.action === "refund" || ask.action === "cancel" ? "danger" : "primary"} className="h-11 md:h-9" onClick={() => run(r, ask.action, note)} disabled={!!busy || tooShort}>
              {b ? <Spinner className="h-3.5 w-3.5" /> : <Check size={14} />} Ha
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-11 md:h-9"
              onClick={() => {
                setAsk(null);
                setNote("");
              }}
              disabled={!!busy}
            >
              Yo&apos;q
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-1.5 md:flex-col md:items-end md:flex-nowrap @[74rem]:md:flex-row @[74rem]:md:justify-end">
        {acts.map((a) => {
          const Icon = ACTION_ICON[a];
          return (
            <Button
              key={a}
              size="sm"
              variant={a === "release" || a === "confirm" ? "primary" : "outline"}
              className={cn("h-11 md:h-9", (a === "refund" || a === "cancel") && "text-danger-text hover:border-danger hover:bg-danger-soft")}
              onClick={() => {
                setAsk({ id: r.id, action: a });
                setNote("");
              }}
              disabled={!!busy}
              title={ACTION_LABEL[a]}
              aria-label={`${r.orderTitle}: ${ACTION_LABEL[a]}`}
            >
              {b ? <Spinner className="h-3.5 w-3.5" /> : <Icon size={14} />}
              <span className="md:hidden">{ACTION_LABEL[a]}</span>
              <span className="hidden md:inline">{ACTION_LABEL_SHORT[a]}</span>
            </Button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Filtr + jami: tor joyda jami pastga o'raladi (segment kesilmaydi) */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="no-scrollbar -mx-4 max-w-full overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="segment" role="group" aria-label="To'lov holati bo'yicha filtr">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className="segment-item inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap"
                data-active={filter === f.key}
                onClick={() => {
                  setFilter(f.key);
                  setShowAll(false);
                }}
                aria-pressed={filter === f.key}
              >
                {f.label} <span className="text-[11px] opacity-70 tabular-nums">{counts[f.key]}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="text-[12px] text-fg-3">
          Aylanma <span className="font-semibold text-fg tabular-nums">{formatPrice(totals.amount, { compact: true })}</span> · komissiya{" "}
          <span className="font-semibold text-fg tabular-nums">{formatPrice(totals.commission, { compact: true })}</span>
        </p>
      </div>

      <div aria-live="polite" className="space-y-2 empty:hidden">
        {error && (
          <p className="flex items-center gap-2 rounded-[14px] bg-danger-soft px-4 py-2.5 text-[13px] font-medium text-danger-text">
            <AlertCircle size={15} /> {error}
          </p>
        )}
        {notice && (
          <p className="expand-in flex items-center gap-2 rounded-[14px] bg-success-soft px-4 py-2.5 text-[13px] font-medium text-success-text">
            <CheckCircle2 size={15} /> {notice}
          </p>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Receipt} title="To'lovlar yo'q" description="Mijoz buyurtma uchun to'lov boshlaganda shu yerda ko'rinadi." />
      ) : (
        <div className="@container card overflow-hidden">
          {/* Desktop: konteyner kengligiga qarab ustunlar yig'iladi */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">
                  <th className="px-4 py-3 font-bold">Buyurtma</th>
                  <th className="px-3 py-3 font-bold">Mijoz → Mutaxassis</th>
                  <th className="hidden px-3 py-3 font-bold @[74rem]:table-cell">Usul</th>
                  <th className="px-3 py-3 text-right font-bold">Summa</th>
                  <th className="hidden px-3 py-3 text-right font-bold @[66rem]:table-cell">Komissiya</th>
                  <th className="px-3 py-3 font-bold">Holat</th>
                  <th className="px-4 py-3 text-right font-bold">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((r) => (
                  <tr key={r.id} className={cn("align-top transition-colors hover:bg-fg/3", busy === r.id && "opacity-60")}>
                    <td className="max-w-[220px] px-4 py-3">
                      <Link href={orderHref(r.orderId)} className="block truncate font-semibold text-fg hover:text-accent">
                        {r.orderTitle}
                      </Link>
                      <span className="block text-[11px] text-fg-4">
                        <time dateTime={new Date(r.paidAt ?? r.createdAt).toISOString()}>{formatDateTime(r.paidAt ?? r.createdAt)}</time>
                        {(r.state === "paid" || r.state === "released") && (
                          <>
                            {" · "}
                            <Link href={`/chek/${r.id}`} className="inline-flex items-center gap-0.5 font-semibold text-fg-3 hover:text-accent">
                              <FileText size={11} /> Chek
                            </Link>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="max-w-[180px] px-3 py-3 text-fg-2">
                      <span className="block truncate">{r.client.name}</span>
                      <Link href={`/mutaxassislar/${r.specialist.slug}`} className="block truncate text-[12px] text-fg-3 hover:text-accent">
                        → {r.specialist.name}
                      </Link>
                    </td>
                    <td className="hidden px-3 py-3 text-fg-2 @[74rem]:table-cell">
                      {PROVIDER_LABEL[r.provider]}
                      {r.providerTxnId && <span className="block max-w-[120px] truncate font-mono text-[11px] text-fg-4">{r.providerTxnId}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                      <span className="block font-semibold text-fg">{formatPrice(r.amount)}</span>
                      {/* Tor konteynerda usul va komissiya shu yerda */}
                      <span className="block text-[11px] text-fg-4 @[74rem]:hidden">{PROVIDER_LABEL[r.provider]}</span>
                      <span className="block text-[11px] text-fg-4 @[66rem]:hidden">komissiya {r.commissionPct}%</span>
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-3 text-right tabular-nums @[66rem]:table-cell">
                      <span className="block text-fg">{formatPrice(r.commissionAmount)}</span>
                      <span className="block text-[11px] text-fg-4">{r.commissionPct}%</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <Badge tone={PAYMENT_TONE[r.state]} className="whitespace-nowrap">
                        {PAYMENT_STATE_LABEL[r.state]}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Actions r={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobil */}
          <ul className="divide-y divide-line md:hidden">
            {shown.map((r) => (
              <li key={r.id} className={cn("px-4 py-4", busy === r.id && "opacity-60")}>
                <div className="flex items-start justify-between gap-3">
                  <Link href={orderHref(r.orderId)} className="min-w-0 flex-1 truncate text-[14px] font-semibold text-fg">
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
                    <dd className="text-fg-2">
                      {formatDateTime(r.paidAt ?? r.createdAt)}
                      {(r.state === "paid" || r.state === "released") && (
                        <Link href={`/chek/${r.id}`} className="ml-2 inline-flex items-center gap-0.5 font-semibold text-accent-text">
                          <FileText size={11} /> Chek
                        </Link>
                      )}
                    </dd>
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
          {visible.length > PAGE_CAP && !showAll && (
            <div className="border-t border-line p-3">
              <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll(true)}>
                Yana {visible.length - PAGE_CAP} ta ko&apos;rsatish
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

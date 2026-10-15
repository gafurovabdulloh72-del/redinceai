"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowRightLeft, CheckCircle2, RotateCcw, Scale } from "lucide-react";
import { Button, EmptyState, Spinner } from "@/components/ui";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/constants";
import { cn, formatDateTime, formatPrice, timeAgo } from "@/lib/utils";

export interface AdminDisputeRow {
  orderId: string;
  title: string;
  status: OrderStatus;
  amount: number | null;
  commissionPct: number | null;
  reason: string;
  /** Kim ochgan */
  by: "client" | "specialist";
  /** DIQQAT: bu buyurtmaning updatedAt'i (so'nggi faollik), nizo ochilgan vaqt emas — UI shunday deb ko'rsatadi */
  openedAt: number;
  client: { name: string; email: string };
  specialist: { name: string; email: string; slug: string };
}

type Resolution = "release" | "refund";
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

const RES_LABEL: Record<Resolution, string> = { release: "Mutaxassisga o'tkazish", refund: "Mijozga qaytarish" };
const RES_HINT: Record<Resolution, string> = {
  release: "Eskroudagi sof summa mutaxassis balansiga o'tadi, buyurtma yakunlanadi. Qaytarib bo'lmaydi.",
  refund: "Pul mijozga qaytarilgan deb belgilanadi va buyurtma bekor qilinadi (Payme/Click'da qaytarishni provayder kabinetida ham bajaring).",
};

/** Admin: ochiq nizolar navbati — ikki tomon, sabab, summa va qaror (izoh bilan) */
export function AdminDisputes({ rows: initialRows }: { rows: AdminDisputeRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [seen, setSeen] = useState(initialRows);
  if (seen !== initialRows) {
    setSeen(initialRows);
    setRows(initialRows);
  }
  const [busy, setBusy] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ id: string; resolution: Resolution } | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const resolve = async (r: AdminDisputeRow, resolution: Resolution) => {
    if (busy) return;
    // Izoh majburiy (API ham ≥5 belgi talab qiladi) — tugma disabled, bu faqat qo'shimcha himoya
    if (note.trim().length < 5) {
      setError("Qaror izohini yozing (kamida 5 belgi) — tomonlarga ko'rinadi");
      return;
    }
    setError(null);
    setBusy(r.orderId);
    setAsk(null);
    try {
      const res = await fetch(`/api/admin/orders/${r.orderId}/dispute`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolution, note: note.trim() }) });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ resolution: Resolution }> | null;
      if (!json || !json.ok) throw new Error(json?.error ?? "Server javob bermadi");
      setRows((rs) => rs.filter((x) => x.orderId !== r.orderId));
      setNotice(`«${r.title}»: ${RES_LABEL[resolution].toLowerCase()} — bajarildi${note.trim() ? ` · ${note.trim()}` : ""}`);
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Kutilmagan xatolik");
    } finally {
      setBusy(null);
    }
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

      {rows.length === 0 ? (
        <EmptyState icon={Scale} title="Ochiq nizolar yo'q" description="Mijoz yoki mutaxassis eskroudagi buyurtma bo'yicha nizo ochsa shu yerda ko'rinadi." />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {rows.map((r) => {
            const b = busy === r.orderId;
            const net = r.amount != null ? r.amount - Math.round((r.amount * (r.commissionPct ?? 0)) / 100) : null;
            return (
              <li key={r.orderId} className={cn("px-4 py-4 sm:px-5", b && "opacity-60")}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/buyurtmalar/${r.orderId}`} className="text-[15px] font-semibold text-fg hover:text-accent">
                        {r.title}
                      </Link>
                      <span className="rounded-full bg-fg/6 px-2 py-0.5 text-[11px] font-semibold text-fg-2">{ORDER_STATUS_LABEL[r.status]}</span>
                      <span className="text-[11px] text-fg-4">
                        So'nggi faollik:{" "}
                        <time dateTime={new Date(r.openedAt).toISOString()} title={formatDateTime(r.openedAt)} suppressHydrationWarning>
                          {timeAgo(r.openedAt)}
                        </time>
                      </span>
                    </p>
                    <p className="mt-1 text-[12px] text-fg-3">
                      {r.client.name} <span className="text-fg-4">→</span>{" "}
                      <Link href={`/mutaxassislar/${r.specialist.slug}`} className="hover:text-accent">
                        {r.specialist.name}
                      </Link>
                      {r.amount != null && (
                        <>
                          {" · "}
                          <span className="font-semibold text-fg tabular-nums">{formatPrice(r.amount)}</span> eskrouda{net != null ? ` (mutaxassisga ${formatPrice(net)})` : ""}
                        </>
                      )}
                    </p>
                    <p className="mt-2 flex items-start gap-2 rounded-[14px] bg-warning-soft px-3.5 py-2.5 text-[13px] leading-snug text-warning-text">
                      <Scale size={15} className="mt-0.5 shrink-0" />
                      <span>
                        <span className="font-semibold">{r.by === "client" ? "Mijoz" : "Mutaxassis"} nizo ochdi:</span> <span className="text-fg-2">{r.reason}</span>
                      </span>
                    </p>
                  </div>

                  <div className="shrink-0 lg:w-[300px]">
                    {ask?.id === r.orderId ? (
                      <div className="card-outline flex flex-col gap-2 !rounded-[14px] p-3 animate-fade-up" style={{ animationDuration: "0.2s" }}>
                        <p className="flex items-start gap-1.5 text-[12px] text-fg">
                          <AlertCircle size={14} className="mt-0.5 shrink-0 text-warning" /> {RES_HINT[ask.resolution]}
                        </p>
                        <label htmlFor={`dnote-${r.orderId}`} className="sr-only">
                          Qaror izohi
                        </label>
                        <input id={`dnote-${r.orderId}`} className="field !min-h-10 !py-1.5 text-[13px]" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Izoh — majburiy, kamida 5 belgi (tomonlarga ko'rinadi)" autoFocus />
                        <div className="flex gap-1.5">
                          {/* Qaror izohi majburiy (≥5 belgi) — sababsiz hal qilib bo'lmaydi */}
                          <Button size="sm" variant={ask.resolution === "refund" ? "danger" : "primary"} className="h-11 md:h-9" onClick={() => resolve(r, ask.resolution)} disabled={!!busy || note.trim().length < 5}>
                            {b ? <Spinner className="h-3.5 w-3.5" /> : ask.resolution === "refund" ? <RotateCcw size={14} /> : <ArrowRightLeft size={14} />} Ha, {RES_LABEL[ask.resolution].toLowerCase()}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-11 md:h-9" onClick={() => setAsk(null)} disabled={!!busy}>
                            Yo'q
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 lg:justify-end">
                        <Button
                          size="sm"
                          className="h-11 md:h-9"
                          onClick={() => {
                            setAsk({ id: r.orderId, resolution: "release" });
                            setNote("");
                          }}
                          disabled={!!busy}
                        >
                          <ArrowRightLeft size={14} /> {RES_LABEL.release}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-11 text-danger-text hover:border-danger hover:bg-danger-soft md:h-9"
                          onClick={() => {
                            setAsk({ id: r.orderId, resolution: "refund" });
                            setNote("");
                          }}
                          disabled={!!busy}
                        >
                          <RotateCcw size={14} /> {RES_LABEL.refund}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

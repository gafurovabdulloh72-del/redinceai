"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Ban,
  BadgePercent,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Hourglass,
  Inbox,
  Pencil,
  Phone,
  Play,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Avatar, Badge, Button, ButtonLink, EmptyState, Spinner, type BadgeTone } from "@/components/ui";
import { PayButton } from "@/components/payments/PayButton";
import { ORDER_PAYMENT_TONE, type OrderPaymentState } from "@/components/payments/tones";
import { ORDER_PAYMENT_STATE_LABEL, ORDER_STATUSES, ORDER_STATUS_LABEL, type OrderStatus, type PaymentProvider } from "@/lib/constants";
import { cn, formatDate, formatDateTime, formatNumber, formatPrice, timeAgo } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Turlar                                                              */
/* ------------------------------------------------------------------ */
export interface OrderItem {
  id: string;
  title: string;
  description: string;
  budget: number | null;
  deadline: string | null;
  contactPhone: string;
  status: OrderStatus;
  /** Kelishilgan narx (so'm) — mutaxassis belgilaydi */
  amount: number | null;
  paymentState: OrderPaymentState;
  commissionPct: number | null;
  /** Mijoz ishni qabul qilgan vaqt (ms) */
  completedAt: number | null;
  /** ms timestamp */
  createdAt: number;
  updatedAt: number;
  /** Mutaxassis ID (mijoz ko'rinishida «Yana buyurtma berish» uchun) */
  specialistId?: string | null;
  /** Buyurtmaning ochiq to'lovi: created — davom ettirish mumkin, pending — tasdiq kutilmoqda */
  openPayment?: { id: string; provider: PaymentProvider; state: "created" | "pending" } | null;
  /** Qarshi tomon: mutaxassis uchun — mijoz, mijoz uchun — mutaxassis */
  counterpart: {
    name: string;
    avatarUrl: string | null;
    subtitle: string | null;
    /** Mutaxassisning ommaviy profili (faqat mijoz ko'rinishida) */
    href: string | null;
  };
}

export type Tab = "incoming" | "outgoing";
type Filter = OrderStatus | "all";
type Patch = Partial<Pick<OrderItem, "status" | "amount" | "paymentState" | "completedAt" | "commissionPct">>;

const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  new: "accent",
  accepted: "purple",
  in_progress: "warning",
  done: "success",
  cancelled: "neutral",
};
const STATUS_DOT: Record<OrderStatus, string> = {
  new: "bg-accent",
  accepted: "bg-accent-2",
  in_progress: "bg-warning",
  done: "bg-success",
  cancelled: "bg-fg-4",
};

interface Action {
  to: OrderStatus;
  label: string;
  icon: LucideIcon;
  variant: "primary" | "outline";
  /** Qaytarib bo'lmaydigan amal: tasdiq paneli (bekor qilishda sabab maydoni bilan) */
  confirm?: string;
  danger?: boolean;
}

/** /api/orders/[id] dagi ruxsat etilgan o'tishlar bilan bir xil */
function actionsFor(tab: Tab, o: OrderItem): Action[] {
  if (tab === "incoming") {
    switch (o.status) {
      case "new":
        return [
          { to: "accepted", label: "Qabul qilish", icon: Check, variant: "primary" },
          { to: "cancelled", label: "Rad etish", icon: Ban, variant: "outline", danger: true, confirm: "Buyurtmani rad etasizmi? Mijozga «Bekor qilindi» holati va sababingiz ko'rinadi." },
        ];
      case "accepted":
        return [
          { to: "in_progress", label: "Boshlash", icon: Play, variant: "primary" },
          { to: "cancelled", label: "Bekor qilish", icon: Ban, variant: "outline", danger: true, confirm: "Buyurtmani bekor qilasizmi? Bu amalni qaytarib bo'lmaydi." },
        ];
      case "in_progress":
        return [
          {
            to: "done",
            label: "Yakunlash",
            icon: CheckCircle2,
            variant: "primary",
            confirm: o.paymentState === "paid" ? "Ishni yakunlaysizmi? Mijoz natijani qabul qilgach pul balansingizga tushadi." : "Ishni yakunlaysizmi? Mijoz hali to'lamagan — avval narx va to'lovni kelishib oling.",
          },
          { to: "cancelled", label: "Bekor qilish", icon: Ban, variant: "outline", danger: true, confirm: "Jarayondagi buyurtmani bekor qilasizmi?" },
        ];
      default:
        return [];
    }
  }
  if (o.status === "new" || o.status === "accepted") {
    return [
      {
        to: "cancelled",
        label: "Bekor qilish",
        icon: Ban,
        variant: "outline",
        danger: true,
        confirm: o.paymentState === "paid" ? "To'langan buyurtmani bekor qilasizmi? Pul admin tomonidan qaytariladi." : "Buyurtmani bekor qilasizmi? Mutaxassisga xabar boradi.",
      },
    ];
  }
  return [];
}

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!json) throw new Error("Server javob bermadi");
  if (!json.ok) throw new Error(json.fields ? Object.values(json.fields)[0] || json.error : json.error);
  return json.data;
}
const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : "Kutilmagan xatolik");

/* ------------------------------------------------------------------ */
/* Ro'yxat                                                             */
/* ------------------------------------------------------------------ */
export function OrdersList({
  incoming,
  outgoing,
  hasSpecialist,
  initialTab,
  highlightId,
  providers,
  commissionPct,
  minOrderAmount,
}: {
  incoming: OrderItem[];
  outgoing: OrderItem[];
  hasSpecialist: boolean;
  initialTab?: Tab;
  /** ?id= bilan kelgan buyurtma — kartaga aylantiriladi va ajratib ko'rsatiladi */
  highlightId?: string | null;
  /** Sozlangan to'lov usullari (mijoz "To'lash" uchun) */
  providers: PaymentProvider[];
  commissionPct: number;
  minOrderAmount: number;
}) {
  const router = useRouter();
  const inIncoming = Boolean(highlightId && incoming.some((o) => o.id === highlightId));
  const inOutgoing = Boolean(highlightId && outgoing.some((o) => o.id === highlightId));
  const [tab, setTab] = useState<Tab>(inIncoming ? "incoming" : inOutgoing ? "outgoing" : (initialTab ?? (hasSpecialist ? "incoming" : "outgoing")));
  const [filter, setFilter] = useState<Filter>("all");
  /** Optimistik holatlar: kalit = id:updatedAt, server yangilangach avtomatik eskiradi */
  const [overrides, setOverrides] = useState<Record<string, Patch>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; to: OrderStatus } | null>(null);
  const [reason, setReason] = useState("");
  const [acceptAsk, setAcceptAsk] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(highlightId ?? null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  const keyOf = (o: OrderItem) => `${o.id}:${o.updatedAt}`;
  const patch = (o: OrderItem, p: Patch) => setOverrides((m) => ({ ...m, [keyOf(o)]: { ...(m[keyOf(o)] ?? {}), ...p } }));

  // Deep link: kartaga aylantirish + 4 soniya ajratib ko'rsatish
  useEffect(() => {
    if (!highlightId) return;
    const el = cardRefs.current[highlightId];
    if (el) {
      const t = window.setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
      const t2 = window.setTimeout(() => setFlash(null), 4500);
      return () => {
        window.clearTimeout(t);
        window.clearTimeout(t2);
      };
    }
  }, [highlightId]);

  const list = useMemo(() => {
    const src = tab === "incoming" ? incoming : outgoing;
    return src.map((o) => {
      const p = overrides[`${o.id}:${o.updatedAt}`];
      return p ? { ...o, ...p } : o;
    });
  }, [tab, incoming, outgoing, overrides]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: list.length, new: 0, accepted: 0, in_progress: 0, done: 0, cancelled: 0 };
    for (const o of list) c[o.status] += 1;
    return c;
  }, [list]);

  const visible = filter === "all" ? list : list.filter((o) => o.status === filter);

  const switchTab = (t: Tab) => {
    setTab(t);
    setFilter("all");
    setConfirm(null);
    setAcceptAsk(null);
    setError(null);
  };

  const changeStatus = async (o: OrderItem, to: OrderStatus, why?: string) => {
    if (busyId) return;
    const prev = o.status;
    setConfirm(null);
    setReason("");
    setError(null);
    setBusyId(o.id);
    patch(o, { status: to });
    try {
      const data = await call<{ id: string; status: OrderStatus; paymentState: OrderPaymentState }>(`/api/orders/${o.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: to, reason: why?.trim() || undefined }),
      });
      patch(o, { status: data.status, paymentState: data.paymentState });
      router.refresh();
    } catch (e) {
      patch(o, { status: prev });
      setError(msg(e));
    } finally {
      setBusyId(null);
    }
  };

  const setAmount = async (o: OrderItem, amount: number): Promise<string | null> => {
    if (busyId) return null;
    setError(null);
    setBusyId(o.id);
    try {
      const data = await call<{ amount: number; paymentState: OrderPaymentState; commissionPct: number }>(`/api/orders/${o.id}/amount`, {
        method: "PATCH",
        body: JSON.stringify({ amount }),
      });
      patch(o, { amount: data.amount, paymentState: data.paymentState, commissionPct: data.commissionPct });
      router.refresh();
      return null;
    } catch (e) {
      return msg(e);
    } finally {
      setBusyId(null);
    }
  };

  const acceptWork = async (o: OrderItem) => {
    if (busyId) return;
    setAcceptAsk(null);
    setError(null);
    setBusyId(o.id);
    try {
      const data = await call<{ paymentState: OrderPaymentState; completedAt: number }>(`/api/orders/${o.id}/confirm`, { method: "POST" });
      patch(o, { paymentState: data.paymentState, completedAt: data.completedAt });
      router.refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusyId(null);
    }
  };

  const tabs: Array<{ id: Tab; label: string; count: number; icon: LucideIcon }> = [];
  if (hasSpecialist) tabs.push({ id: "incoming", label: "Kelgan buyurtmalar", count: incoming.length, icon: Inbox });
  tabs.push({ id: "outgoing", label: "Mening buyurtmalarim", count: outgoing.length, icon: Send });

  return (
    <div className="space-y-4">
      {/* Tablar + filtrlar */}
      <div className="card p-3 sm:p-4">
        {tabs.length > 1 && (
          <div className="no-scrollbar -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <div className="segment">
              {tabs.map((t) => (
                <button key={t.id} type="button" className="segment-item inline-flex min-h-10 items-center gap-1.5" data-active={tab === t.id} onClick={() => switchTab(t.id)}>
                  <t.icon size={14} className={tab === t.id ? undefined : "text-fg-3"} />
                  {t.label}
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none", tab === t.id ? "bg-ink-fg/20 text-ink-fg" : "bg-fg/8 text-fg-3")}>{t.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={cn("no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0", tabs.length > 1 && "mt-3")} role="group" aria-label="Holat bo'yicha filtr">
          {(["all", ...ORDER_STATUSES] as Filter[]).map((f) => {
            const active = filter === f;
            const n = counts[f];
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={active}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold transition active:scale-95 sm:min-h-9",
                  active ? "bg-ink text-ink-fg" : "bg-fg/6 text-fg-2 hover:bg-fg/10",
                  !active && n === 0 && f !== "all" && "opacity-50",
                )}
              >
                {f !== "all" && <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-ink-fg" : STATUS_DOT[f])} />}
                {f === "all" ? "Barchasi" : ORDER_STATUS_LABEL[f]}
                <span className={cn("tabular-nums", active ? "text-ink-fg/70" : "text-fg-4")}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div role="alert" className="inline-flex items-center gap-2 rounded-full bg-danger-soft px-3.5 py-2 text-[13px] font-medium text-danger">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Bo'sh holatlar */}
      {list.length === 0 ? (
        tab === "incoming" ? (
          <EmptyState
            icon={Inbox}
            title="Hali buyurtmalar kelmagan"
            description="Profil va portfolioni to'liq to'ldiring — mijozlar sizni xaritadan tezroq topadi va yozadi."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink href="/kabinet/profil" size="sm">
                  Profilni to'ldirish <ArrowRight size={14} />
                </ButtonLink>
                <ButtonLink href="/kabinet/portfolio" variant="outline" size="sm">
                  Portfolio
                </ButtonLink>
              </div>
            }
          />
        ) : (
          <EmptyState
            icon={Search}
            title="Siz hali buyurtma bermagansiz"
            description="Xaritadan hududni tanlang, mutaxassis profilini ko'ring va loyihangizni yuboring."
            action={
              <ButtonLink href="/mutaxassislar" size="sm">
                Mutaxassis topish <ArrowRight size={14} />
              </ButtonLink>
            }
          />
        )
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Bu holatda buyurtmalar yo'q"
          description={`«${filter === "all" ? "Barchasi" : ORDER_STATUS_LABEL[filter as OrderStatus]}» bo'yicha hech narsa topilmadi.`}
          action={
            <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
              <X size={14} /> Filtrni tozalash
            </Button>
          }
        />
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {visible.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              tab={tab}
              busy={busyId === o.id}
              expanded={Boolean(expanded[o.id])}
              onToggle={() => setExpanded((m) => ({ ...m, [o.id]: !m[o.id] }))}
              confirm={confirm?.id === o.id ? confirm.to : null}
              reason={confirm?.id === o.id ? reason : ""}
              onReason={setReason}
              onAsk={(to) => {
                setConfirm({ id: o.id, to });
                setReason("");
                setAcceptAsk(null);
              }}
              onCancelAsk={() => setConfirm(null)}
              onChange={(to, why) => changeStatus(o, to, why)}
              onSetAmount={(amount) => setAmount(o, amount)}
              acceptAsk={acceptAsk === o.id}
              onAcceptAsk={(v) => {
                setAcceptAsk(v ? o.id : null);
                setConfirm(null);
              }}
              onAccept={() => acceptWork(o)}
              providers={providers}
              commissionPct={o.commissionPct ?? commissionPct}
              minOrderAmount={minOrderAmount}
              highlighted={flash === o.id}
              refCb={(el) => {
                cardRefs.current[o.id] = el;
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Narx belgilash (mutaxassis)                                         */
/* ------------------------------------------------------------------ */
function AmountForm({
  order: o,
  commissionPct,
  minOrderAmount,
  busy,
  onSave,
}: {
  order: OrderItem;
  commissionPct: number;
  minOrderAmount: number;
  busy: boolean;
  onSave: (amount: number) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(o.amount == null && o.status === "accepted");
  const [draft, setDraft] = useState(o.amount != null ? formatNumber(o.amount) : o.budget ? formatNumber(o.budget) : "");
  const [err, setErr] = useState<string | null>(null);
  const value = Number(draft.replace(/\D/g, "")) || 0;
  const commission = Math.round((value * commissionPct) / 100);
  const net = value - commission;
  const inputId = `amount-${o.id}`;

  const submit = async () => {
    if (value < minOrderAmount) {
      setErr(`Kamida ${formatPrice(minOrderAmount)}`);
      return;
    }
    setErr(null);
    const e = await onSave(value);
    if (e) setErr(e);
    else setOpen(false);
  };

  if (!open) {
    return (
      <Button size="md" variant={o.amount == null ? "primary" : "outline"} onClick={() => setOpen(true)} disabled={busy}>
        {o.amount == null ? <BadgePercent size={15} /> : <Pencil size={14} />}
        {o.amount == null ? "Narx belgilash" : "Narxni o'zgartirish"}
      </Button>
    );
  }

  return (
    <div className="card-outline w-full !rounded-[18px] p-3.5 sm:p-4">
      <label htmlFor={inputId} className="field-label">
        Kelishilgan narx (so'm)
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <input
            id={inputId}
            className="field !pr-14 tabular-nums"
            inputMode="numeric"
            autoComplete="off"
            placeholder={formatNumber(minOrderAmount)}
            value={draft}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
              setDraft(digits ? formatNumber(Number(digits)) : "");
              setErr(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit())}
            aria-invalid={Boolean(err)}
            aria-describedby={`${inputId}-hint`}
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-fg-3">so'm</span>
        </div>
        <div className="flex gap-2">
          <Button size="md" onClick={submit} disabled={busy || value <= 0} className="flex-1 sm:flex-none">
            {busy ? <Spinner /> : <Check size={15} />} Saqlash
          </Button>
          <Button size="md" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Bekor
          </Button>
        </div>
      </div>
      {err ? (
        <p className="field-error">{err}</p>
      ) : (
        <p id={`${inputId}-hint`} className="mt-2 text-[12px] leading-snug text-fg-3">
          {value > 0 ? (
            <>
              Platforma xizmat haqi {commissionPct}% — {formatPrice(commission)}. <span className="font-semibold text-fg">Sizga {formatPrice(net)}</span> tushadi (mijoz ishni qabul qilgach).
            </>
          ) : (
            <>Mijoz shu summani eskrouga to'laydi; {commissionPct}% platforma xizmat haqi ayriladi.</>
          )}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Jarayon chizig'i: Yangi → Qabul qilindi → Jarayonda → Bajarildi     */
/* ------------------------------------------------------------------ */
const STEPS = ORDER_STATUSES.filter((s): s is Exclude<OrderStatus, "cancelled"> => s !== "cancelled");

function OrderSteps({ status, paymentState }: { status: OrderStatus; paymentState: OrderPaymentState }) {
  const cancelled = status === "cancelled";
  const current = cancelled ? -1 : STEPS.indexOf(status);
  const last = STEPS.length - 1;
  return (
    <ol className={cn("mt-3 flex items-start", cancelled && "opacity-60")} aria-label="Buyurtma bosqichlari">
      {STEPS.map((s, i) => {
        const done = !cancelled && i < current;
        const active = !cancelled && i === current;
        const finished = active && i === last && (paymentState === "released" || paymentState === "none" || paymentState === "refunded");
        return (
          <li key={s} className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5" aria-current={active ? "step" : undefined}>
            {i > 0 && <span className={cn("absolute right-1/2 top-[5px] h-[2px] w-full", done || active ? "bg-fg" : "bg-line-2")} aria-hidden="true" />}
            <span
              className={cn(
                "relative z-[1] flex h-3 w-3 items-center justify-center rounded-full border-2",
                done || finished ? "border-fg bg-fg" : active ? "border-accent bg-accent ring-4 ring-accent-soft" : "border-line-2 bg-surface",
              )}
              aria-hidden="true"
            />
            <span className={cn("max-w-full truncate px-0.5 text-[10px] font-semibold leading-none sm:text-[11px]", active ? "text-fg" : done ? "text-fg-2" : "text-fg-4", cancelled && "line-through")}>{ORDER_STATUS_LABEL[s]}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Bitta buyurtma kartasi                                              */
/* ------------------------------------------------------------------ */
function OrderCard({
  order: o,
  tab,
  busy,
  expanded,
  onToggle,
  confirm,
  reason,
  onReason,
  onAsk,
  onCancelAsk,
  onChange,
  onSetAmount,
  acceptAsk,
  onAcceptAsk,
  onAccept,
  providers,
  commissionPct,
  minOrderAmount,
  highlighted,
  refCb,
}: {
  order: OrderItem;
  tab: Tab;
  busy: boolean;
  expanded: boolean;
  onToggle: () => void;
  confirm: OrderStatus | null;
  reason: string;
  onReason: (v: string) => void;
  onAsk: (to: OrderStatus) => void;
  onCancelAsk: () => void;
  onChange: (to: OrderStatus, reason?: string) => void;
  onSetAmount: (amount: number) => Promise<string | null>;
  acceptAsk: boolean;
  onAcceptAsk: (v: boolean) => void;
  onAccept: () => void;
  providers: PaymentProvider[];
  commissionPct: number;
  minOrderAmount: number;
  highlighted: boolean;
  refCb: (el: HTMLElement | null) => void;
}) {
  const actions = actionsFor(tab, o);
  const long = o.description.length > 150 || o.description.split("\n").length > 2;
  const phoneHref = `tel:${o.contactPhone.replace(/[^\d+]/g, "")}`;
  const confirmAction = confirm ? actions.find((a) => a.to === confirm) : null;
  const closed = o.status === "done" || o.status === "cancelled";
  const isSpecialist = tab === "incoming";
  const active = o.status === "accepted" || o.status === "in_progress";
  const showPayment = o.amount != null || o.paymentState !== "none";
  /** /api/orders/[id]/amount bilan bir xil: qabul qilingan/jarayonda, yoki yakunlangan-u mijoz hali qabul qilmagan */
  const canSetAmount = isSpecialist && (active || (o.status === "done" && !o.completedAt)) && (o.paymentState === "none" || o.paymentState === "awaiting");
  const canPay = !isSpecialist && o.paymentState === "awaiting" && o.amount != null && o.status !== "cancelled";
  /** Qabul qilish: eskroudagi pul bo'lsa (qabuldan keyin to'langan bo'lsa ham) — pulni o'tkazish; aks holda faqat hali yakunlanmagan, qaytarilmagan buyurtma */
  const canAccept = !isSpecialist && o.status === "done" && (o.paymentState === "paid" || (!o.completedAt && o.paymentState !== "released" && o.paymentState !== "refunded"));
  const openPayment = canPay ? (o.openPayment ?? null) : null;
  const pendingPayment = openPayment?.state === "pending" ? openPayment : null;
  const canReorder = !isSpecialist && closed && Boolean(o.specialistId);
  const net = o.amount != null ? o.amount - Math.round((o.amount * commissionPct) / 100) : null;

  return (
    <article
      id={`order-${o.id}`}
      ref={refCb}
      className={cn("card flex scroll-mt-32 flex-col p-4 transition sm:p-5", closed && "opacity-90", highlighted && "ring-2 ring-accent ring-offset-2 ring-offset-bg")}
      aria-busy={busy}
    >
      {/* Yuqori qator: holat + vaqt */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={STATUS_TONE[o.status]}>
            <span className={cn("h-1.5 w-1.5 rounded-full", o.status === "cancelled" ? "bg-fg-3" : "bg-current")} />
            {ORDER_STATUS_LABEL[o.status]}
          </Badge>
          {showPayment && o.paymentState !== "none" && <Badge tone={ORDER_PAYMENT_TONE[o.paymentState]}>{ORDER_PAYMENT_STATE_LABEL[o.paymentState]}</Badge>}
        </div>
        <time dateTime={new Date(o.createdAt).toISOString()} className="shrink-0 text-[12px] text-fg-4" title={formatDateTime(o.createdAt)} suppressHydrationWarning>
          {timeAgo(o.createdAt)}
        </time>
      </div>

      <h3 className="mt-2.5 text-[17px] font-semibold leading-snug text-fg">{o.title}</h3>

      <OrderSteps status={o.status} paymentState={o.paymentState} />

      {/* Qarshi tomon */}
      <div className="mt-3 flex items-center gap-2.5">
        {o.counterpart.href ? (
          <Link href={o.counterpart.href} className="flex min-w-0 items-center gap-2.5 rounded-full pr-2 transition hover:bg-fg/4">
            <Avatar name={o.counterpart.name} src={o.counterpart.avatarUrl} size={36} decorative />
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold text-fg">{o.counterpart.name}</span>
              {o.counterpart.subtitle && <span className="block truncate text-[12px] text-fg-3">{o.counterpart.subtitle}</span>}
            </span>
          </Link>
        ) : (
          <>
            <Avatar name={o.counterpart.name} src={o.counterpart.avatarUrl} size={36} decorative />
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold text-fg">{o.counterpart.name}</span>
              {o.counterpart.subtitle && <span className="block truncate text-[12px] text-fg-3">{o.counterpart.subtitle}</span>}
            </span>
          </>
        )}
      </div>

      {/* Meta chiplar */}
      <ul className="mt-3 flex flex-wrap gap-1.5">
        <li className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-fg-2">
          <Wallet size={12} className="text-fg-3" />
          {o.budget ? `Byudjet ${formatPrice(o.budget, { compact: true })}` : "Byudjet kelishiladi"}
        </li>
        {o.deadline && (
          <li className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-fg-2">
            <CalendarClock size={12} className="text-fg-3" />
            {o.deadline}
          </li>
        )}
        {isSpecialist && (
          <li>
            <a href={phoneHref} className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[12px] font-semibold text-fg transition hover:border-fg">
              <Phone size={12} className="text-accent" />
              {o.contactPhone}
            </a>
          </li>
        )}
      </ul>

      {/* Tavsif */}
      <div className="mt-3">
        <p className={cn("whitespace-pre-line text-[14px] leading-relaxed text-fg-2", !expanded && "line-clamp-2")}>{o.description}</p>
        {long && (
          <button type="button" onClick={onToggle} className="mt-1 inline-flex min-h-8 items-center gap-1 text-[13px] font-semibold text-accent transition hover:opacity-80">
            {expanded ? "Yopish" : "Batafsil"}
            <ChevronDown size={14} className={cn("transition-transform", expanded && "rotate-180")} />
          </button>
        )}
      </div>

      {/* Narx va to'lov holati */}
      {showPayment && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[16px] border border-line bg-surface-2 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Kelishilgan narx</p>
            <p className="font-display text-[18px] font-semibold leading-tight text-fg">{o.amount != null ? formatPrice(o.amount) : "—"}</p>
            {o.amount != null && (
              <p className="mt-0.5 text-[12px] text-fg-3">
                {o.status === "cancelled" ? (
                  o.paymentState === "paid" ? "Buyurtma bekor qilingan — pul admin tomonidan qaytariladi" : o.paymentState === "refunded" ? (isSpecialist ? "Pul mijozga qaytarildi" : "Pul sizga qaytarildi") : "Buyurtma bekor qilingan — to'lov talab qilinmaydi"
                ) : isSpecialist ? (
                  <>
                    Xizmat haqi {commissionPct}% · sizga <span className="font-semibold text-fg-2">{formatPrice(net ?? 0)}</span>
                  </>
                ) : pendingPayment ? (
                  pendingPayment.provider === "manual" ? "O'tkazma haqida xabar oldik — admin tasdig'i kutilmoqda" : "To'lov provayder tomonida tekshirilmoqda"
                ) : o.paymentState === "paid" ? (
                  "Pul eskrouda — ish qabul qilingach mutaxassisga o'tadi"
                ) : o.paymentState === "released" ? (
                  "Mutaxassisga o'tkazildi"
                ) : o.paymentState === "refunded" ? (
                  "Pul sizga qaytarildi"
                ) : (
                  "Eskrou orqali xavfsiz to'lov"
                )}
              </p>
            )}
          </div>
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]",
              o.paymentState === "paid" || o.paymentState === "released" ? "bg-success-soft text-success" : pendingPayment ? "bg-warning-soft text-warning" : "bg-fg/6 text-fg-3",
            )}
            aria-hidden="true"
          >
            {o.paymentState === "paid" || o.paymentState === "released" ? <ShieldCheck size={17} /> : o.status === "cancelled" ? <Ban size={16} /> : <Hourglass size={16} />}
          </span>
        </div>
      )}

      {/* Amallar */}
      {(actions.length > 0 || canSetAmount || canPay || canAccept) && (
        <div className="mt-4 border-t border-line pt-4">
          {confirmAction ? (
            <div className="card-outline flex flex-col gap-3 !rounded-[18px] p-3.5 animate-fade-up" style={{ animationDuration: "0.25s" }}>
              <p className="flex items-start gap-2 text-[13px] font-medium text-fg">
                <AlertCircle size={16} className={cn("mt-0.5 shrink-0", confirmAction.danger ? "text-danger" : "text-warning")} />
                {confirmAction.confirm}
              </p>
              {confirmAction.to === "cancelled" && (
                <div>
                  <label htmlFor={`reason-${o.id}`} className="sr-only">
                    Sabab
                  </label>
                  <textarea
                    id={`reason-${o.id}`}
                    className="field min-h-[72px] resize-y text-[14px]"
                    placeholder={isSpecialist ? "Sabab (ixtiyoriy) — mijozga ko'rsatiladi. Masalan: bu sanada bandman" : "Sabab (ixtiyoriy) — mutaxassisga ko'rsatiladi"}
                    value={reason}
                    maxLength={500}
                    onChange={(e) => onReason(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="md" variant={confirmAction.danger ? "danger" : "primary"} onClick={() => onChange(confirmAction.to, reason)} disabled={busy}>
                  {busy ? <Spinner /> : <confirmAction.icon size={15} />} Ha, {confirmAction.label.toLowerCase()}
                </Button>
                <Button size="md" variant="ghost" onClick={onCancelAsk} disabled={busy}>
                  Yo'q
                </Button>
              </div>
            </div>
          ) : acceptAsk ? (
            <div className="card-outline flex flex-col gap-3 !rounded-[18px] p-3.5 animate-fade-up" style={{ animationDuration: "0.25s" }}>
              <p className="flex items-start gap-2 text-[13px] font-medium text-fg">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-success" />
                {o.paymentState === "paid" ? (
                  <>
                    Ishni qabul qilasizmi? Eskroudagi <span className="font-semibold">{formatPrice(o.amount ?? 0)}</span> mutaxassisga o'tkaziladi — bu amalni qaytarib bo'lmaydi.
                  </>
                ) : (
                  "Ish natijasini tasdiqlaysizmi? Buyurtma yakunlangan deb belgilanadi."
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="md" variant="accent" onClick={onAccept} disabled={busy}>
                  {busy ? <Spinner /> : <CheckCircle2 size={15} />} Ha, qabul qilaman
                </Button>
                <Button size="md" variant="ghost" onClick={() => onAcceptAsk(false)} disabled={busy}>
                  Hali emas
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {canSetAmount && <AmountForm key={`${o.id}-${o.amount ?? "none"}`} order={o} commissionPct={commissionPct} minOrderAmount={minOrderAmount} busy={busy} onSave={onSetAmount} />}
              <div className="flex flex-wrap items-center gap-2">
                {pendingPayment ? (
                  <>
                    <Badge tone="warning" className="!py-2 !text-[12px]">
                      <Hourglass size={12} /> {pendingPayment.provider === "manual" ? "O'tkazma tasdiq kutilmoqda" : "To'lov tekshirilmoqda"}
                    </Badge>
                    <Link href={`/tolov/natija?payment=${pendingPayment.id}`} className="inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-accent transition hover:opacity-80">
                      Holatni ko'rish <ArrowRight size={14} />
                    </Link>
                  </>
                ) : (
                  canPay && o.amount != null && <PayButton orderId={o.id} amount={o.amount} providers={providers} />
                )}
                {openPayment?.state === "created" && (
                  <Link href={`/tolov/${openPayment.id}`} className="inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-fg-2 transition hover:text-fg">
                    Davom etish <ArrowRight size={14} />
                  </Link>
                )}
                {canAccept && (
                  <Button size="md" variant={o.paymentState === "paid" ? "accent" : "primary"} onClick={() => onAcceptAsk(true)} disabled={busy}>
                    <CheckCircle2 size={15} /> Ishni qabul qilish
                  </Button>
                )}
                {actions.map((a) => (
                  <Button
                    key={a.to}
                    size="md"
                    variant={a.variant}
                    disabled={busy}
                    onClick={() => (a.confirm ? onAsk(a.to) : onChange(a.to))}
                    className={cn(a.danger && "border-line text-danger hover:border-danger hover:bg-danger-soft")}
                  >
                    {busy && !a.confirm ? <Spinner /> : <a.icon size={15} />}
                    {a.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mijoz: narx hali belgilanmagan */}
      {!isSpecialist && active && o.paymentState === "none" && (
        <p className="mt-3 flex items-start gap-2 rounded-[14px] bg-surface-2 px-3.5 py-2.5 text-[12px] leading-snug text-fg-2">
          <Hourglass size={14} className="mt-0.5 shrink-0 text-warning" />
          Mutaxassis narx belgilashini kuting — shundan so'ng bu yerda «To'lash» tugmasi chiqadi. Pul eskrouda saqlanadi.
        </p>
      )}

      {/* Yakuniy izohlar */}
      {!isSpecialist && o.status === "done" && !canAccept && (
        <p className="mt-4 border-t border-line pt-3 text-[12px] text-fg-3">
          {o.paymentState === "released" ? "Ish qabul qilindi, pul mutaxassisga o'tkazildi." : o.paymentState === "refunded" ? "Buyurtma yakunlangan, to'lov sizga qaytarilgan." : "Buyurtma yakunlangan."}
          {o.completedAt ? ` · ${formatDate(o.completedAt)}` : ` · ${formatDate(o.updatedAt)}`}
        </p>
      )}
      {isSpecialist && o.status === "done" && (
        <p className="mt-4 border-t border-line pt-3 text-[12px] text-fg-3">
          {o.paymentState === "released"
            ? `Mijoz qabul qildi — ${formatPrice(net ?? 0)} balansingizga tushdi.`
            : o.paymentState === "paid"
              ? "Mijoz qabul qilishini kuting — shundan so'ng pul balansga tushadi."
              : "Buyurtma yakunlangan."}
          {" · "}
          {formatDate(o.completedAt ?? o.updatedAt)}
        </p>
      )}
      {o.status === "cancelled" && (
        <p className="mt-4 border-t border-line pt-3 text-[12px] text-fg-3">
          {o.paymentState === "paid" ? "Buyurtma bekor qilingan. To'lov eskrouda — admin ko'rib chiqadi va qaytaradi." : o.paymentState === "refunded" ? "Buyurtma bekor qilingan, pul qaytarilgan." : "Buyurtma bekor qilingan."}
          {" · "}
          {formatDate(o.updatedAt)}
        </p>
      )}

      {/* Mijoz: yopilgan buyurtma — o'sha mutaxassisga bir bosishda yangi buyurtma */}
      {canReorder && !canAccept && (
        <div className="mt-3">
          <ButtonLink href={`/buyurtma/${o.specialistId}`} variant="outline" size="sm">
            <RotateCcw size={14} /> Yana buyurtma berish
          </ButtonLink>
        </div>
      )}
    </article>
  );
}

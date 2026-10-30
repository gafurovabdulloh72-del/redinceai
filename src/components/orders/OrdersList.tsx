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
  Flag,
  History,
  Hourglass,
  Inbox,
  MessageSquareText,
  Package,
  Pencil,
  Phone,
  Play,
  RotateCcw,
  Scale,
  Search,
  Send,
  ShieldCheck,
  Star,
  TimerReset,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Avatar, Badge, Button, ButtonLink, EmptyState, Spinner, type BadgeTone } from "@/components/ui";
import { PayButton } from "@/components/payments/PayButton";
import { OrderChat } from "@/components/chat/OrderChat";
import type { Attachment } from "@/components/chat/attachments";
import { CounterOffer, MeetingLink, OrderAttachments, type CounterResult } from "./OrderExtras";
import { ORDER_PAYMENT_TONE, type OrderPaymentState } from "@/components/payments/tones";
import { ORDER_PAYMENT_STATE_LABEL, ORDER_STATUSES, ORDER_STATUS_LABEL, PACKAGE_TIERS, type OrderStatus, type PaymentProvider } from "@/lib/constants";
import { cn, formatDate, formatDateTime, formatNumber, formatPrice, formatUzPhone, normalizeUzPhone, timeAgo } from "@/lib/utils";

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
  /** Bekor qilish sababi (kim bekor qilgan bo'lsa yozgan) */
  cancelReason?: string | null;
  /** Nizo holati; berilmasa (undefined) — ro'yxat /api/orders dan to'ldiradi */
  disputeState?: DisputeState;
  disputeReason?: string | null;
  /** Nizoni kim ochgan */
  disputeBy?: "client" | "specialist" | null;
  /** Avtomatik qabul muddati (ms): mijoz shu vaqtgacha javob bermasa eskrou mutaxassisga o'tadi */
  autoReleaseAt?: number | null;
  /** Shoshilinch buyurtma (F30): amount = asosiy narx + urgentFee */
  urgent?: boolean;
  urgentFee?: number | null;
  /** Tanlangan paket (F31) */
  packageKey?: "basic" | "standard" | "premium" | null;
  /** Topshirish sanasi YYYY-MM-DD (F37) */
  dueDate?: string | null;
  /** Video qo'ng'iroq havolasi (F40) */
  meetingUrl?: string | null;
  /** Biriktirilgan fayllar (F35) */
  attachments?: Attachment[];
  /** Mijozning narx taklifi (F16) — asosiy narx, ustamasiz */
  counterAmount?: number | null;
  counterBy?: "client" | "specialist" | null;
  /** Chat: xabarlar soni va qarshi tomondan o'qilmaganlar (F34) */
  chatCount?: number;
  chatUnread?: number;
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
export type DisputeState = "none" | "open" | "resolved";
type Patch = Partial<
  Pick<
    OrderItem,
    "status" | "amount" | "paymentState" | "completedAt" | "commissionPct" | "cancelReason" | "disputeState" | "disputeReason" | "disputeBy" | "autoReleaseAt" | "urgentFee" | "counterAmount" | "counterBy" | "meetingUrl" | "attachments"
  >
>;
/** Sahifa bermagan qo'shimcha maydonlar (/api/orders yoki /api/orders/[id]/events dan) */
type Extras = Pick<OrderItem, "cancelReason" | "disputeState" | "disputeReason" | "disputeBy" | "autoReleaseAt">;

export interface OrderEventItem {
  id: string;
  type: "status" | "amount" | "payment" | "dispute" | "note";
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  actor: string | null;
  createdAt: number;
}

const DISPUTE_MIN = 10;

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
  // «To'ladim» bosilgan o'tkazma admin tasdig'ini kutmoqda — bekor qilish server tomonda ham yopiq (409)
  if (o.openPayment?.state === "pending") return [];
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
  urgentPct = 20,
  openChatId = null,
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
  /** Shoshilinch ustama foizi (platforma sozlamasi) */
  urgentPct?: number;
  /** ?id=…&chat=1 — shu buyurtma chati ochiq holda */
  openChatId?: string | null;
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
  const [disputeAsk, setDisputeAsk] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(highlightId ?? null);
  /** Sahifa bermagan maydonlar (bekor sababi, nizo, avto-qabul) — /api/orders dan bir marta */
  const [extras, setExtras] = useState<Record<string, Extras>>({});
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  const keyOf = (o: OrderItem) => `${o.id}:${o.updatedAt}`;
  const patch = (o: OrderItem, p: Patch) => setOverrides((m) => ({ ...m, [keyOf(o)]: { ...(m[keyOf(o)] ?? {}), ...p } }));
  const setExtra = (id: string, e: Extras) => setExtras((m) => ({ ...m, [id]: { ...(m[id] ?? {}), ...e } }));

  // Sahifa hali nizo/avto-qabul maydonlarini bermasa — /api/orders dan to'ldiramiz (bir marta)
  const needExtras = [...incoming, ...outgoing].some((o) => o.disputeState === undefined);
  useEffect(() => {
    if (!needExtras) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/orders", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as ApiResponse<{ asClient: Array<Record<string, unknown>>; asSpecialist: Array<Record<string, unknown>> }> | null;
        if (!alive || !json || !json.ok) return;
        const next: Record<string, Extras> = {};
        for (const row of [...json.data.asClient, ...json.data.asSpecialist]) {
          const id = typeof row.id === "string" ? row.id : null;
          if (!id) continue;
          const ds = row.disputeState;
          const ar = row.autoReleaseAt;
          next[id] = {
            cancelReason: typeof row.cancelReason === "string" ? row.cancelReason : null,
            disputeState: ds === "open" || ds === "resolved" ? ds : "none",
            disputeReason: typeof row.disputeReason === "string" ? row.disputeReason : null,
            disputeBy: row.disputeBy === "client" || row.disputeBy === "specialist" ? row.disputeBy : null,
            autoReleaseAt: typeof ar === "number" ? ar : typeof ar === "string" ? Date.parse(ar) || null : null,
          };
        }
        setExtras((m) => ({ ...next, ...m }));
      } catch {
        /* qo'shimcha maydonlarsiz ham ishlayveradi */
      }
    })();
    return () => {
      alive = false;
    };
  }, [needExtras]);

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
      const e = o.disputeState === undefined ? extras[o.id] : undefined;
      const p = overrides[`${o.id}:${o.updatedAt}`];
      return e || p ? { ...o, ...(e ?? {}), ...(p ?? {}) } : o;
    });
  }, [tab, incoming, outgoing, overrides, extras]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: list.length, new: 0, accepted: 0, in_progress: 0, done: 0, cancelled: 0 };
    for (const o of list) c[o.status] += 1;
    return c;
  }, [list]);

  const filteredAll = filter === "all" ? list : list.filter((o) => o.status === filter);
  // Uzun ro'yxat (telefonda 15 000px) — avval 8 ta, «Yana ko'rsatish» bilan 8 tadan qo'shiladi; tab/filtr almashganda qaytadi
  const PAGE = 8;
  const [shownCount, setShownCount] = useState(PAGE);
  useEffect(() => setShownCount(PAGE), [tab, filter]);
  const visible = filteredAll.slice(0, shownCount);
  const hiddenCount = filteredAll.length - visible.length;

  const switchTab = (t: Tab) => {
    setTab(t);
    setFilter("all");
    setConfirm(null);
    setAcceptAsk(null);
    setDisputeAsk(null);
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
      const data = await call<{ id: string; status: OrderStatus; paymentState: OrderPaymentState; cancelReason?: string | null; autoReleaseAt?: number | null }>(`/api/orders/${o.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: to, reason: why?.trim() || undefined }),
      });
      patch(o, { status: data.status, paymentState: data.paymentState, cancelReason: data.cancelReason ?? null, autoReleaseAt: data.autoReleaseAt ?? null });
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
      const data = await call<{ amount: number; urgentFee?: number | null; paymentState: OrderPaymentState; commissionPct: number }>(`/api/orders/${o.id}/amount`, {
        method: "PATCH",
        body: JSON.stringify({ amount }),
      });
      patch(o, { amount: data.amount, urgentFee: data.urgentFee ?? null, paymentState: data.paymentState, commissionPct: data.commissionPct, counterAmount: null, counterBy: null });
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
      patch(o, { paymentState: data.paymentState, completedAt: data.completedAt, autoReleaseAt: null });
      router.refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusyId(null);
    }
  };

  const openDispute = async (o: OrderItem, why: string): Promise<string | null> => {
    if (busyId) return null;
    setError(null);
    setBusyId(o.id);
    try {
      const data = await call<{ disputeState: DisputeState; disputeReason: string; disputeBy: "client" | "specialist" }>(`/api/orders/${o.id}/dispute`, {
        method: "POST",
        body: JSON.stringify({ reason: why.trim() }),
      });
      patch(o, { disputeState: data.disputeState, disputeReason: data.disputeReason, disputeBy: data.disputeBy });
      setDisputeAsk(null);
      router.refresh();
      return null;
    } catch (e) {
      return msg(e);
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
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums leading-none", tab === t.id ? "bg-ink-fg/20 text-ink-fg" : "bg-fg/8 text-fg-3")}>{t.count}</span>
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
        <div role="alert" className="inline-flex items-center gap-2 rounded-full bg-danger-soft px-3.5 py-2 text-[13px] font-medium text-danger-text">
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
                setDisputeAsk(null);
              }}
              onAccept={() => acceptWork(o)}
              disputeAsk={disputeAsk === o.id}
              onDisputeAsk={(v) => {
                setDisputeAsk(v ? o.id : null);
                setConfirm(null);
                setAcceptAsk(null);
              }}
              onDispute={(why) => openDispute(o, why)}
              onExtras={(e) => setExtra(o.id, e)}
              onPatch={(p) => {
                patch(o, p);
                if (p.amount !== undefined) router.refresh();
              }}
              providers={providers}
              commissionPct={o.commissionPct ?? commissionPct}
              minOrderAmount={minOrderAmount}
              urgentPct={urgentPct}
              chatOpen={openChatId === o.id}
              highlighted={flash === o.id}
              refCb={(el) => {
                cardRefs.current[o.id] = el;
              }}
            />
          ))}
          {hiddenCount > 0 && (
            <div className="xl:col-span-2">
              <button type="button" onClick={() => setShownCount((n) => n + PAGE)} className="press inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-line text-[14px] font-semibold text-fg transition hover:border-fg hover:bg-fg/4">
                Yana ko'rsatish <span className="text-fg-3">· {hiddenCount} ta</span>
              </button>
            </div>
          )}
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
  urgentPct,
  busy,
  onSave,
}: {
  order: OrderItem;
  commissionPct: number;
  minOrderAmount: number;
  urgentPct: number;
  busy: boolean;
  onSave: (amount: number) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(o.amount == null && o.status === "accepted");
  // Shoshilinch buyurtmada maydon — asosiy narx (ustama server tomonda qo'shiladi)
  const baseNow = o.amount != null ? o.amount - (o.urgentFee ?? 0) : null;
  const [draft, setDraft] = useState(baseNow != null ? formatNumber(baseNow) : o.budget ? formatNumber(o.budget) : "");
  const [err, setErr] = useState<string | null>(null);
  /** Mutaxassis darajasiga qarab foiz (yangi / oddiy / top) — serverdan bir marta (F21/F28) */
  const [tier, setTier] = useState<{ pct: number; tier: "new" | "standard" | "top" } | null>(null);
  const value = Number(draft.replace(/\D/g, "")) || 0;
  const pct = tier?.pct ?? commissionPct;
  const fee = o.urgent ? Math.round((value * urgentPct) / 100) : 0;
  const total = value + fee;
  const commission = Math.round((total * pct) / 100);
  const net = total - commission;
  const inputId = `amount-${o.id}`;

  useEffect(() => {
    if (!open || tier) return;
    let alive = true;
    fetch(`/api/orders/${o.id}/amount/preview`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json: ApiResponse<{ commissionPct: number; tier: "new" | "standard" | "top" }>) => {
        if (alive && json.ok) setTier({ pct: json.data.commissionPct, tier: json.data.tier });
      })
      .catch(() => {
        /* standart foiz bilan davom etadi */
      });
    return () => {
      alive = false;
    };
  }, [open, tier, o.id]);

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
        {o.urgent ? "Asosiy narx (so'm)" : "Kelishilgan narx (so'm)"}
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
              {fee > 0 && (
                <span className="mb-0.5 block">
                  Shoshilinch ustama +{urgentPct}%: {formatPrice(fee)} · mijoz to'laydi <span className="font-semibold text-fg">{formatPrice(total)}</span>
                </span>
              )}
              <span className="font-semibold text-fg">Siz olasiz: {formatPrice(net)}</span> (komissiya {pct}% — {formatPrice(commission)}), mijoz ishni qabul qilgach.
            </>
          ) : (
            <>Mijoz shu summani eskrouga to'laydi; {pct}% platforma xizmat haqi ayriladi.</>
          )}
          {tier?.tier === "new" && <> · Yangi mutaxassis darajasi — 3 ta buyurtma bajarilgach komissiya kamayadi.</>}
          {tier?.tier === "top" && <> · Top mutaxassis darajasi.</>}
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
            <span className={cn("max-w-full truncate px-0.5 text-[11px] font-semibold leading-none sm:text-[11px]", active ? "text-fg" : done ? "text-fg-2" : "text-fg-4", cancelled && "line-through")}>{ORDER_STATUS_LABEL[s]}</span>
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
  disputeAsk,
  onDisputeAsk,
  onDispute,
  onExtras,
  onPatch,
  providers,
  commissionPct,
  minOrderAmount,
  urgentPct,
  chatOpen,
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
  disputeAsk: boolean;
  onDisputeAsk: (v: boolean) => void;
  onDispute: (reason: string) => Promise<string | null>;
  /** Tarix yuklanganda serverdan kelgan qo'shimcha maydonlar */
  onExtras: (e: Extras) => void;
  /** Kartadagi kichik amallar (qarshi taklif, video havola, fayl) natijasi */
  onPatch: (p: Patch) => void;
  providers: PaymentProvider[];
  commissionPct: number;
  minOrderAmount: number;
  urgentPct: number;
  chatOpen: boolean;
  highlighted: boolean;
  refCb: (el: HTMLElement | null) => void;
}) {
  const actions = actionsFor(tab, o);
  const long = o.description.length > 150 || o.description.split("\n").length > 2;
  const phoneHref = `tel:${normalizeUzPhone(o.contactPhone) ?? o.contactPhone.replace(/[^\d+]/g, "")}`;
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
  const disputeOpen = o.disputeState === "open";
  /** Nizo: jarayonda/yakunlangan + pul eskrouda; ochiq nizo bo'lsa tasdiqlash to'xtaydi */
  const canDispute = (o.status === "in_progress" || o.status === "done") && o.paymentState === "paid" && !disputeOpen;
  const autoRelease = !disputeOpen && o.status === "done" && o.paymentState === "paid" && o.autoReleaseAt ? o.autoReleaseAt : null;
  const urgentFee = o.urgentFee ?? 0;
  const baseAmount = o.amount != null ? o.amount - urgentFee : null;
  /** Narx muhokamasi (F16): to'lov kutilmoqda, nizo yo'q, to'lov boshlanmagan */
  const canCounter = o.paymentState === "awaiting" && o.amount != null && o.status !== "cancelled" && !disputeOpen && !o.openPayment;
  const editableExtras = o.status !== "cancelled" && !(o.status === "done" && o.completedAt);
  const pkgLabel = o.packageKey ? PACKAGE_TIERS.find((t) => t.key === o.packageKey)?.label : null;
  const [disputeText, setDisputeText] = useState("");
  const [disputeErr, setDisputeErr] = useState<string | null>(null);

  return (
    <article
      id={`order-${o.id}`}
      ref={refCb}
      className={cn("card flex min-w-0 scroll-mt-32 flex-col p-4 transition sm:p-5", closed && "opacity-90", highlighted && "ring-2 ring-accent ring-offset-2 ring-offset-bg")}
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
          {o.urgent && (
            <Badge tone="warning">
              <Zap size={11} /> Shoshilinch
            </Badge>
          )}
        </div>
        <time dateTime={new Date(o.createdAt).toISOString()} className="shrink-0 text-[12px] text-fg-4" title={formatDateTime(o.createdAt)} suppressHydrationWarning>
          {timeAgo(o.createdAt)}
        </time>
      </div>

      <h3 className="mt-2.5 text-[17px] font-semibold leading-snug text-fg">{o.title}</h3>

      <OrderSteps status={o.status} paymentState={o.paymentState} />

      {/* Nizo holati */}
      {disputeOpen && (
        <div role="status" className="mt-3 flex items-start gap-2.5 rounded-[14px] bg-warning-soft px-3.5 py-2.5 text-[13px] leading-snug text-warning-text">
          <Scale size={16} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold">Nizo ochiq</span> — {o.disputeBy === "client" ? "mijoz" : o.disputeBy === "specialist" ? "mutaxassis" : "tomonlardan biri"} nizo ochdi, admin ko'rib chiqmoqda. Pul eskrouda turadi, qabul qilish va avtomatik o'tkazish to'xtatilgan.
            {o.disputeReason && <span className="mt-1 block text-fg-2">Sabab: {o.disputeReason}</span>}
          </span>
        </div>
      )}
      {o.disputeState === "resolved" && (
        <p className="mt-3 flex items-center gap-2 text-[12px] text-fg-3">
          <Scale size={13} /> Nizo admin tomonidan hal qilingan{o.paymentState === "released" ? " — pul mutaxassisga o'tkazildi" : o.paymentState === "refunded" ? " — pul mijozga qaytarildi" : ""}.
        </p>
      )}

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
        {o.dueDate ? (
          <li className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-fg-2">
            <CalendarClock size={12} className="text-fg-3" />
            Topshirish: {formatDate(o.dueDate)}
            {/* Kalendarga qo'shish (.ics) — faqat tomonlar uchun ochiladi */}
            <a href={`/api/orders/${encodeURIComponent(o.id)}/ics`} download className="press -my-1 -mr-1 inline-flex h-6 items-center rounded-full px-1.5 text-[11.5px] font-semibold text-accent-text hover:underline" title="Kalendarga qo'shish (.ics)">
              Kalendar
            </a>
          </li>
        ) : (
          o.deadline && (
            <li className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-fg-2">
              <CalendarClock size={12} className="text-fg-3" />
              {o.deadline}
            </li>
          )
        )}
        {pkgLabel && (
          <li className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-fg-2">
            <Package size={12} className="text-fg-3" />
            Paket: {pkgLabel}
          </li>
        )}
        {isSpecialist && (
          <li>
            <a href={phoneHref} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[12px] font-semibold text-fg transition hover:border-fg">
              <Phone size={12} className="text-accent" />
              {formatUzPhone(o.contactPhone)}
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

      {/* Fayllar (F35) */}
      {(o.attachments?.length ?? 0) > 0 && <OrderAttachments orderId={o.id} items={o.attachments ?? []} editable={editableExtras} onChange={(attachments) => onPatch({ attachments })} />}

      {/* Narx va to'lov holati */}
      {showPayment && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[16px] border border-line bg-surface-2 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Kelishilgan narx</p>
            <p className="font-display text-[18px] font-semibold leading-tight text-fg">{o.amount != null ? formatPrice(o.amount) : "—"}</p>
            {o.amount != null && urgentFee > 0 && baseAmount != null && (
              <p className="mt-0.5 text-[12px] text-fg-3">
                Asosiy {formatPrice(baseAmount)} + <span className="text-warning-text">shoshilinch ustama {formatPrice(urgentFee)}</span>
              </p>
            )}
            {o.amount != null && (
              <p className="mt-0.5 text-[12px] text-fg-3">
                {o.status === "cancelled" ? (
                  o.paymentState === "paid" ? "Buyurtma bekor qilingan — pul admin tomonidan qaytariladi" : o.paymentState === "refunded" ? (isSpecialist ? "Pul mijozga qaytarildi" : "Pul sizga qaytarildi") : "Buyurtma bekor qilingan — to'lov talab qilinmaydi"
                ) : isSpecialist ? (
                  <>
                    Xizmat haqi {commissionPct}% · sizga <span className="font-semibold text-fg-2">{formatPrice(net ?? 0)}</span>
                  </>
                ) : pendingPayment ? (
                  pendingPayment.provider === "manual" ? "O'tkazma yuborildi — administrator tasdiqlashini kutmoqda" : "To'lov provayder tomonida tekshirilmoqda"
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
              o.paymentState === "paid" || o.paymentState === "released" ? "bg-success-soft text-success-text" : pendingPayment ? "bg-warning-soft text-warning-text" : "bg-fg/6 text-fg-3",
            )}
            aria-hidden="true"
          >
            {o.paymentState === "paid" || o.paymentState === "released" ? (
              <ShieldCheck size={17} />
            ) : o.paymentState === "refunded" ? (
              <RotateCcw size={16} />
            ) : o.status === "cancelled" ? (
              <Ban size={16} />
            ) : (
              <Hourglass size={16} />
            )}
          </span>
        </div>
      )}
      {canCounter && baseAmount != null && (
        <CounterOffer
          key={`${o.id}-${o.counterAmount ?? "none"}-${o.amount}`}
          orderId={o.id}
          isSpecialist={isSpecialist}
          baseAmount={baseAmount}
          counterAmount={o.counterAmount ?? null}
          counterBy={o.counterBy ?? null}
          urgent={Boolean(o.urgent)}
          urgentPct={urgentPct}
          minOrderAmount={minOrderAmount}
          onChange={(r: CounterResult) =>
            onPatch({ amount: r.amount, urgentFee: r.urgentFee, counterAmount: r.counterAmount, counterBy: r.counterBy, ...(r.commissionPct != null ? { commissionPct: r.commissionPct } : {}) })
          }
        />
      )}

      {/* Video qo'ng'iroq (F40) + fayl biriktirish (fayl hali yo'q bo'lsa) */}
      {(o.meetingUrl || editableExtras) && (
        <div className="mt-3 flex flex-wrap items-start gap-1.5">
          <MeetingLink key={o.meetingUrl ?? "none"} orderId={o.id} url={o.meetingUrl ?? null} editable={editableExtras} onChange={(meetingUrl) => onPatch({ meetingUrl })} />
          {editableExtras && !(o.attachments?.length ?? 0) && <OrderAttachments orderId={o.id} items={[]} editable onChange={(attachments) => onPatch({ attachments })} />}
        </div>
      )}

      {/* Amallar */}
      {(actions.length > 0 || canSetAmount || canPay || canAccept || canDispute) && (
        <div className="mt-4 border-t border-line pt-4">
          {disputeAsk ? (
            <div className="card-outline flex flex-col gap-3 !rounded-[18px] p-3.5 animate-fade-up" style={{ animationDuration: "0.25s" }}>
              <p className="flex items-start gap-2 text-[13px] font-medium text-fg">
                <Scale size={16} className="mt-0.5 shrink-0 text-warning" />
                Nizo ochilsa pul eskrouda qoladi, qabul qilish va avtomatik o'tkazish to'xtaydi. Admin ikkala tomonni ko'rib chiqib, pulni {isSpecialist ? "sizga o'tkazadi yoki mijozga qaytaradi" : "mutaxassisga o'tkazadi yoki sizga qaytaradi"}.
              </p>
              <div>
                <label htmlFor={`dispute-${o.id}`} className="sr-only">
                  Nizo sababi
                </label>
                <textarea
                  id={`dispute-${o.id}`}
                  className="field min-h-[84px] resize-y text-[14px]"
                  placeholder={isSpecialist ? "Nima bo'ldi? Masalan: mijoz ishni qabul qilmayapti, lekin natija topshirilgan" : "Nima bo'ldi? Masalan: natija texnik topshiriqqa mos emas"}
                  value={disputeText}
                  maxLength={1000}
                  onChange={(e) => {
                    setDisputeText(e.target.value);
                    setDisputeErr(null);
                  }}
                  aria-invalid={Boolean(disputeErr)}
                  autoFocus
                />
                {disputeErr ? <p className="field-error">{disputeErr}</p> : <p className="mt-1.5 text-[12px] text-fg-4">Kamida {DISPUTE_MIN} belgi · {disputeText.trim().length}/1000</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="md"
                  variant="primary"
                  disabled={busy || disputeText.trim().length < DISPUTE_MIN}
                  onClick={async () => {
                    const e = await onDispute(disputeText);
                    if (e) setDisputeErr(e);
                    else setDisputeText("");
                  }}
                >
                  {busy ? <Spinner /> : <Scale size={15} />} Nizo ochish
                </Button>
                <Button size="md" variant="ghost" onClick={() => onDisputeAsk(false)} disabled={busy}>
                  Bekor
                </Button>
              </div>
            </div>
          ) : confirmAction ? (
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
              {canSetAmount && <AmountForm key={`${o.id}-${o.amount ?? "none"}`} order={o} commissionPct={commissionPct} minOrderAmount={minOrderAmount} urgentPct={urgentPct} busy={busy} onSave={onSetAmount} />}
              <div className="flex flex-wrap items-center gap-2">
                {pendingPayment ? (
                  <>
                    <Badge tone="warning" className="!py-2 !text-[12px]">
                      <Hourglass size={12} /> {pendingPayment.provider === "manual" ? "O'tkazma tasdiq kutilmoqda" : "To'lov tekshirilmoqda"}
                    </Badge>
                    <Link href={`/tolov/${pendingPayment.id}`} className="inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-accent transition hover:opacity-80">
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
                {canAccept && !disputeOpen && (
                  <Button size="md" variant={o.paymentState === "paid" ? "accent" : "primary"} onClick={() => onAcceptAsk(true)} disabled={busy}>
                    <CheckCircle2 size={15} /> Ishni qabul qilish
                  </Button>
                )}
                {!disputeOpen &&
                  actions.map((a) => (
                    <Button
                      key={a.to}
                      size="md"
                      variant={a.variant}
                      disabled={busy}
                      onClick={() => (a.confirm ? onAsk(a.to) : onChange(a.to))}
                      className={cn(a.danger && "border-line text-danger-text hover:border-danger hover:bg-danger-soft")}
                    >
                      {busy && !a.confirm ? <Spinner /> : <a.icon size={15} />}
                      {a.label}
                    </Button>
                  ))}
                {canDispute && (
                  <Button size="md" variant="ghost" onClick={() => onDisputeAsk(true)} disabled={busy} className="text-fg-2">
                    <Scale size={15} /> Nizo ochish
                  </Button>
                )}
              </div>
              {autoRelease && (
                <p className="flex items-start gap-2 rounded-[14px] bg-surface-2 px-3.5 py-2.5 text-[12px] leading-snug text-fg-2">
                  <TimerReset size={14} className="mt-0.5 shrink-0 text-warning" />
                  <span>
                    <span className="font-semibold text-fg">Avtomatik qabul: {formatDate(autoRelease)}.</span>{" "}
                    {isSpecialist
                      ? "Mijoz shu kungacha javob bermasa eskroudagi pul avtomatik balansingizga tushadi."
                      : "Shu kungacha ishni qabul qilmasangiz yoki nizo ochmasangiz, eskroudagi pul mutaxassisga avtomatik o'tadi."}
                  </span>
                </p>
              )}
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
        <div className="mt-4 border-t border-line pt-3 text-[12px] text-fg-3">
          <p>
            {o.paymentState === "paid" ? "Buyurtma bekor qilingan. To'lov eskrouda — admin ko'rib chiqadi va qaytaradi." : o.paymentState === "refunded" ? "Buyurtma bekor qilingan, pul qaytarilgan." : "Buyurtma bekor qilingan."}
            {" · "}
            {formatDate(o.updatedAt)}
          </p>
          {o.cancelReason && (
            <p className="mt-2 flex items-start gap-2 rounded-[14px] bg-surface-2 px-3.5 py-2.5 text-[13px] leading-snug text-fg-2">
              <Ban size={14} className="mt-0.5 shrink-0 text-fg-3" />
              <span>
                <span className="font-semibold text-fg">Bekor qilish sababi:</span> {o.cancelReason}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Mijoz: yakunlangan buyurtma — sharh yozish; yopilgan buyurtma — bir bosishda yangi buyurtma */}
      {!isSpecialist && ((o.status === "done" && o.counterpart.href) || (canReorder && !canAccept)) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {o.status === "done" && o.counterpart.href && (
            <ButtonLink href={`${o.counterpart.href}#sharhlar`} variant="outline" size="sm">
              <Star size={14} /> Sharh yozish
            </ButtonLink>
          )}
          {canReorder && !canAccept && (
            <ButtonLink href={`/buyurtma/${o.specialistId}?title=${encodeURIComponent(o.title)}`} variant="outline" size="sm">
              <RotateCcw size={14} /> Qayta buyurtma
            </ButtonLink>
          )}
        </div>
      )}

      <OrderChat
        orderId={o.id}
        role={isSpecialist ? "specialist" : "client"}
        counterpartName={o.counterpart.name}
        initialCount={o.chatCount ?? 0}
        initialUnread={o.chatUnread ?? 0}
        defaultOpen={chatOpen}
      />
      <OrderTimeline orderId={o.id} onExtras={onExtras} />
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Buyurtma tarixi (F36): holat, narx, to'lov, nizo — ixcham ro'yxat  */
/* ------------------------------------------------------------------ */
const EVENT_ICON: Record<OrderEventItem["type"], LucideIcon> = { status: Flag, amount: BadgePercent, payment: Wallet, dispute: Scale, note: MessageSquareText };

function eventText(e: OrderEventItem): string {
  if (e.type === "status") {
    const to = e.toStatus && (ORDER_STATUSES as readonly string[]).includes(e.toStatus) ? ORDER_STATUS_LABEL[e.toStatus as OrderStatus] : e.toStatus;
    const from = e.fromStatus && (ORDER_STATUSES as readonly string[]).includes(e.fromStatus) ? ORDER_STATUS_LABEL[e.fromStatus as OrderStatus] : null;
    const head = from ? `${from} → ${to}` : `Buyurtma yaratildi`;
    return e.note ? `${head}. ${e.note}` : head;
  }
  return e.note ?? (e.type === "amount" ? "Narx o'zgardi" : e.type === "payment" ? "To'lov" : e.type === "dispute" ? "Nizo" : "Izoh");
}

function OrderTimeline({ orderId, onExtras }: { orderId: string; onExtras: (e: Extras) => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<OrderEventItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await call<{ events: OrderEventItem[]; order: Extras }>(`/api/orders/${orderId}/events`, { method: "GET" });
      setItems(data.events);
      onExtras(data.order);
    } catch (e) {
      setErr(msg(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open && items == null && !loading) void load();
        }}
        aria-expanded={open}
        className="inline-flex min-h-9 items-center gap-1.5 text-[12px] font-semibold text-fg-3 transition hover:text-fg"
      >
        <History size={13} /> Tarix
        <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-1.5 rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5">
          {loading && items == null ? (
            <p className="flex items-center gap-2 text-[12px] text-fg-3">
              <Spinner className="h-3.5 w-3.5" /> Yuklanmoqda…
            </p>
          ) : err ? (
            <p className="flex items-center gap-2 text-[12px] text-danger">
              <AlertCircle size={13} /> {err}
            </p>
          ) : !items || items.length === 0 ? (
            <p className="text-[12px] text-fg-3">Hali yozuvlar yo'q.</p>
          ) : (
            <ol className="space-y-2">
              {items.map((e) => {
                const Icon = EVENT_ICON[e.type];
                return (
                  <li key={e.id} className="flex items-start gap-2.5 text-[12px] leading-snug">
                    <span className={cn("mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full", e.type === "dispute" ? "bg-warning-soft text-warning-text" : e.type === "payment" ? "bg-success-soft text-success-text" : "bg-fg/8 text-fg-3")} aria-hidden="true">
                      <Icon size={11} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-fg-2">{eventText(e)}</span>
                      <span className="block text-[11px] text-fg-4">
                        {e.actor ?? "Tizim"} ·{" "}
                        <time dateTime={new Date(e.createdAt).toISOString()} title={formatDateTime(e.createdAt)} suppressHydrationWarning>
                          {timeAgo(e.createdAt)}
                        </time>
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

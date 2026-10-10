"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Ban,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Inbox,
  Phone,
  Play,
  Search,
  Send,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Avatar, Badge, Button, ButtonLink, EmptyState, Spinner } from "@/components/ui";
import { ORDER_STATUSES, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/constants";
import { cn, formatPrice, timeAgo } from "@/lib/utils";

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
  /** ms timestamp */
  createdAt: number;
  updatedAt: number;
  /** Qarshi tomon: mutaxassis uchun — mijoz, mijoz uchun — mutaxassis */
  counterpart: {
    name: string;
    avatarUrl: string | null;
    subtitle: string | null;
    /** Mutaxassisning ommaviy profili (faqat mijoz ko'rinishida) */
    href: string | null;
  };
}

type Tab = "incoming" | "outgoing";
type Filter = OrderStatus | "all";

const STATUS_TONE: Record<OrderStatus, "blue" | "purple" | "orange" | "green" | "neutral"> = {
  new: "blue",
  accepted: "purple",
  in_progress: "orange",
  done: "green",
  cancelled: "neutral",
};

const STATUS_DOT: Record<OrderStatus, string> = {
  new: "bg-ios-blue",
  accepted: "bg-ios-purple",
  in_progress: "bg-ios-orange",
  done: "bg-ios-green",
  cancelled: "bg-fg-4",
};

interface Action {
  to: OrderStatus;
  label: string;
  icon: LucideIcon;
  variant: "primary" | "glass" | "ghost" | "danger" | "tint-soft";
  /** Tasdiq so'raladigan (qaytarib bo'lmaydigan) amal */
  confirm?: string;
}

/** /api/orders/[id] dagi ruxsat etilgan o'tishlar bilan bir xil */
function actionsFor(tab: Tab, status: OrderStatus): Action[] {
  if (tab === "incoming") {
    switch (status) {
      case "new":
        return [
          { to: "accepted", label: "Qabul qilish", icon: Check, variant: "primary" },
          { to: "cancelled", label: "Rad etish", icon: Ban, variant: "ghost", confirm: "Buyurtmani rad etasizmi? Mijozga «Bekor qilindi» holati ko'rinadi." },
        ];
      case "accepted":
        return [
          { to: "in_progress", label: "Boshlash", icon: Play, variant: "primary" },
          { to: "cancelled", label: "Bekor qilish", icon: Ban, variant: "ghost", confirm: "Buyurtmani bekor qilasizmi? Bu amalni qaytarib bo'lmaydi." },
        ];
      case "in_progress":
        return [
          { to: "done", label: "Yakunlash", icon: CheckCircle2, variant: "primary" },
          { to: "cancelled", label: "Bekor qilish", icon: Ban, variant: "ghost", confirm: "Jarayondagi buyurtmani bekor qilasizmi?" },
        ];
      default:
        return [];
    }
  }
  if (status === "new" || status === "accepted") {
    return [{ to: "cancelled", label: "Bekor qilish", icon: Ban, variant: "ghost", confirm: "Buyurtmani bekor qilasizmi? Mutaxassisga xabar boradi." }];
  }
  return [];
}

type PatchResponse = { ok: true; data: { id: string; status: OrderStatus } } | { ok: false; error: string };

/* ------------------------------------------------------------------ */
/* Ro'yxat                                                             */
/* ------------------------------------------------------------------ */
export function OrdersList({
  incoming,
  outgoing,
  hasSpecialist,
  initialTab,
}: {
  incoming: OrderItem[];
  outgoing: OrderItem[];
  hasSpecialist: boolean;
  initialTab?: Tab;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab ?? (hasSpecialist ? "incoming" : "outgoing"));
  const [filter, setFilter] = useState<Filter>("all");
  /** Optimistik holatlar: kalit = id:updatedAt, server yangilangach avtomatik eskiradi */
  const [overrides, setOverrides] = useState<Record<string, OrderStatus>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; to: OrderStatus } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const keyOf = (o: OrderItem) => `${o.id}:${o.updatedAt}`;

  const list = useMemo(() => {
    const src = tab === "incoming" ? incoming : outgoing;
    return src.map((o) => {
      const s = overrides[`${o.id}:${o.updatedAt}`];
      return s ? { ...o, status: s } : o;
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
    setError(null);
  };

  const changeStatus = async (o: OrderItem, to: OrderStatus) => {
    if (busyId) return;
    const key = keyOf(o);
    const prev = o.status;
    setConfirm(null);
    setError(null);
    setBusyId(o.id);
    setOverrides((m) => ({ ...m, [key]: to }));
    try {
      const res = await fetch(`/api/orders/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      });
      const json = (await res.json()) as PatchResponse;
      if (!json.ok) {
        setOverrides((m) => ({ ...m, [key]: prev }));
        setError(json.error);
        return;
      }
      router.refresh();
    } catch {
      setOverrides((m) => ({ ...m, [key]: prev }));
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
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
      <div className="glass p-3 sm:p-4">
        {tabs.length > 1 && (
          <div className="no-scrollbar -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <div className="segment">
              {tabs.map((t) => (
                <button key={t.id} type="button" className="segment-item inline-flex items-center gap-1.5" data-active={tab === t.id} onClick={() => switchTab(t.id)}>
                  <t.icon size={14} className={tab === t.id ? "text-tint" : "text-fg-3"} />
                  {t.label}
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none", tab === t.id ? "bg-tint-soft text-tint" : "bg-fg/8 text-fg-3")}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={cn("no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0", tabs.length > 1 && "mt-3")}>
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
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition active:scale-95",
                  active ? "glass-tint" : "bg-fg/6 text-fg-2 hover:bg-fg/10",
                  !active && n === 0 && f !== "all" && "opacity-50",
                )}
              >
                {f !== "all" && <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-white" : STATUS_DOT[f])} />}
                {f === "all" ? "Barchasi" : ORDER_STATUS_LABEL[f]}
                <span className={cn("tabular-nums", active ? "text-white/80" : "text-fg-4")}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div role="alert" className="inline-flex items-center gap-2 rounded-full bg-ios-red/12 px-3.5 py-2 text-[13px] font-medium text-ios-red">
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
                <ButtonLink href="/kabinet/portfolio" variant="glass" size="sm">
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
            <Button variant="glass" size="sm" onClick={() => setFilter("all")}>
              <X size={14} /> Filtrni tozalash
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visible.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              tab={tab}
              busy={busyId === o.id}
              expanded={Boolean(expanded[o.id])}
              onToggle={() => setExpanded((m) => ({ ...m, [o.id]: !m[o.id] }))}
              confirm={confirm?.id === o.id ? confirm.to : null}
              onAsk={(to) => setConfirm({ id: o.id, to })}
              onCancelAsk={() => setConfirm(null)}
              onChange={(to) => changeStatus(o, to)}
            />
          ))}
        </div>
      )}
    </div>
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
  onAsk,
  onCancelAsk,
  onChange,
}: {
  order: OrderItem;
  tab: Tab;
  busy: boolean;
  expanded: boolean;
  onToggle: () => void;
  confirm: OrderStatus | null;
  onAsk: (to: OrderStatus) => void;
  onCancelAsk: () => void;
  onChange: (to: OrderStatus) => void;
}) {
  const actions = actionsFor(tab, o.status);
  const long = o.description.length > 150 || o.description.split("\n").length > 2;
  const phoneHref = `tel:${o.contactPhone.replace(/[^\d+]/g, "")}`;
  const confirmAction = confirm ? actions.find((a) => a.to === confirm) : null;
  const closed = o.status === "done" || o.status === "cancelled";

  return (
    <article className={cn("glass flex flex-col p-4 transition sm:p-5", closed && "opacity-90")} aria-busy={busy}>
      {/* Yuqori qator: holat + vaqt */}
      <div className="flex items-center justify-between gap-3">
        <Badge tone={STATUS_TONE[o.status]}>
          <span className={cn("h-1.5 w-1.5 rounded-full", o.status === "cancelled" ? "bg-fg-3" : "bg-current")} />
          {ORDER_STATUS_LABEL[o.status]}
        </Badge>
        <span className="text-[12px] text-fg-4" title={new Date(o.createdAt).toLocaleString("uz-UZ")}>
          {timeAgo(o.createdAt)}
        </span>
      </div>

      <h3 className="mt-2.5 text-[17px] font-semibold leading-snug text-fg">{o.title}</h3>

      {/* Qarshi tomon */}
      <div className="mt-3 flex items-center gap-2.5">
        {o.counterpart.href ? (
          <Link href={o.counterpart.href} className="flex min-w-0 items-center gap-2.5 rounded-full pr-2 transition hover:bg-fg/4">
            <Avatar name={o.counterpart.name} src={o.counterpart.avatarUrl} size={36} />
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold text-fg">{o.counterpart.name}</span>
              {o.counterpart.subtitle && <span className="block truncate text-[12px] text-fg-3">{o.counterpart.subtitle}</span>}
            </span>
          </Link>
        ) : (
          <>
            <Avatar name={o.counterpart.name} src={o.counterpart.avatarUrl} size={36} />
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold text-fg">{o.counterpart.name}</span>
              {o.counterpart.subtitle && <span className="block truncate text-[12px] text-fg-3">{o.counterpart.subtitle}</span>}
            </span>
          </>
        )}
      </div>

      {/* Meta chiplar */}
      <ul className="mt-3 flex flex-wrap gap-1.5">
        <li className="glass-weak glass-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium text-fg-2">
          <Wallet size={12} className="text-tint" />
          {o.budget ? formatPrice(o.budget) : "Byudjet kelishiladi"}
        </li>
        {o.deadline && (
          <li className="glass-weak glass-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium text-fg-2">
            <CalendarClock size={12} className="text-tint" />
            {o.deadline}
          </li>
        )}
        {tab === "incoming" && (
          <li>
            <a href={phoneHref} className="glass-weak glass-pill glass-hover inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-semibold text-tint">
              <Phone size={12} />
              {o.contactPhone}
            </a>
          </li>
        )}
      </ul>

      {/* Tavsif */}
      <div className="mt-3">
        <p className={cn("whitespace-pre-line text-[14px] leading-relaxed text-fg-2", !expanded && "line-clamp-2")}>{o.description}</p>
        {long && (
          <button type="button" onClick={onToggle} className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-tint transition hover:opacity-80">
            {expanded ? "Yopish" : "Batafsil"}
            <ChevronDown size={14} className={cn("transition-transform", expanded && "rotate-180")} />
          </button>
        )}
      </div>

      {/* Amallar */}
      {actions.length > 0 && (
        <div className="mt-4 border-t border-hairline pt-4">
          {confirmAction ? (
            <div className="glass-weak flex flex-col gap-3 !rounded-[18px] p-3 animate-fade-up sm:flex-row sm:items-center sm:justify-between" style={{ animationDuration: "0.25s" }}>
              <p className="flex items-start gap-2 text-[13px] font-medium text-fg">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-ios-orange" />
                {confirmAction.confirm}
              </p>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="danger" onClick={() => onChange(confirmAction.to)} disabled={busy}>
                  {busy ? <Spinner /> : <>Ha, {confirmAction.label.toLowerCase()}</>}
                </Button>
                <Button size="sm" variant="glass" onClick={onCancelAsk} disabled={busy}>
                  Yo'q
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <Button
                  key={a.to}
                  size="sm"
                  variant={a.variant}
                  disabled={busy}
                  onClick={() => (a.confirm ? onAsk(a.to) : onChange(a.to))}
                  className={cn(a.variant === "ghost" && "text-ios-red hover:bg-ios-red/10 hover:text-ios-red")}
                >
                  {busy && !a.confirm ? <Spinner /> : <a.icon size={14} />}
                  {a.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {closed && actions.length === 0 && (
        <p className="mt-4 border-t border-hairline pt-3 text-[12px] text-fg-4">
          {o.status === "done" ? "Buyurtma muvaffaqiyatli yakunlangan." : "Buyurtma bekor qilingan."}
          {" · "}
          {new Date(o.updatedAt).toLocaleDateString("uz-UZ")}
        </p>
      )}
    </article>
  );
}

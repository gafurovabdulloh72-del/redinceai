"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, Check, Contact, ExternalLink, Loader2, Receipt, Search, X } from "lucide-react";
import { Avatar } from "@/components/ui";
import { showToast } from "@/components/ui/toast";
import { EXPERIENCE_LEVELS } from "@/lib/constants";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";

export interface PendingContactInvoice { id: string; state: string; amount: number; title: string; createdAt: number; receiptUrl: string | null; buyer: { id: string; name: string; email: string } | null }
export interface RecentUnlock { id: string; at: number; amount: number; buyer: { id: string; name: string }; specialist: { id: string; slug: string; name: string } }
type Prices = { contactPriceJunior: number; contactPriceMiddle: number; contactPriceSenior: number; contactPriceExpert: number };
type UserHit = { id: string; name: string; email: string; avatarUrl: string | null; role: string; specialist?: { slug: string } | null };
type SpInfo = { specialistId: string; slug: string; name: string; experience: string; contactMode: "paid" | "hidden"; contactPrice: number | null; effectivePrice: number; sold: number };

const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
const digits = (s: string) => s.replace(/\D/g, "");
const LEVEL_LABEL = Object.fromEntries(EXPERIENCE_LEVELS.map((l) => [l.value, l.label])) as Record<string, string>;
const PRICE_KEYS: Array<{ key: keyof Prices; level: string }> = [
  { key: "contactPriceJunior", level: "junior" },
  { key: "contactPriceMiddle", level: "middle" },
  { key: "contactPriceSenior", level: "senior" },
  { key: "contactPriceExpert", level: "expert" },
];

async function api<T>(url: string, init: RequestInit): Promise<T> {
  const r = await fetch(url, { headers: { "content-type": "application/json" }, ...init });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: T; error?: string } | null;
  if (!r.ok || !j?.ok) throw new Error(j?.error || "Xatolik");
  return j.data as T;
}

/** Admin: kontakt sotuvi — umumiy narxlar (daraja bo'yicha), maxsus narx/rejim (mutaxassis qidirib), kutilayotgan o'tkazmalar, so'nggi ochilishlar */
export function AdminContactPanel({ prices, settings, pending, recent }: { prices: Prices; settings: Record<string, number>; pending: PendingContactInvoice[]; recent: RecentUnlock[] }) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<keyof Prices, string>>({ contactPriceJunior: fmt(prices.contactPriceJunior), contactPriceMiddle: fmt(prices.contactPriceMiddle), contactPriceSenior: fmt(prices.contactPriceSenior), contactPriceExpert: fmt(prices.contactPriceExpert) });
  const [savingPrices, setSavingPrices] = useState(false);
  const dirty = PRICE_KEYS.some(({ key }) => (Number(digits(vals[key])) || 0) !== prices[key]);

  async function savePrices() {
    setSavingPrices(true);
    try {
      const body: Record<string, number> = { ...settings };
      for (const { key } of PRICE_KEYS) body[key] = Number(digits(vals[key])) || 0;
      await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(body) });
      showToast("Kontakt narxlari saqlandi", "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setSavingPrices(false);
    }
  }

  // Mutaxassis qidiruvi → maxsus narx / rejim
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<UserHit[] | null>(null);
  const [sp, setSp] = useState<SpInfo | null>(null);
  const [spPrice, setSpPrice] = useState("");
  const [spMode, setSpMode] = useState<"paid" | "hidden">("paid");
  const [spBusy, setSpBusy] = useState(false);
  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) {
      setHits(null);
      return;
    }
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`/api/admin/users?q=${encodeURIComponent(needle)}&holat=active`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((j: { data?: { items: UserHit[] } }) => setHits((j.data?.items ?? []).filter((u) => u.specialist?.slug).slice(0, 8)))
        .catch(() => undefined);
    }, 250);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [q]);
  async function pick(u: UserHit) {
    try {
      const info = await api<SpInfo>(`/api/admin/kontaktlar?userId=${encodeURIComponent(u.id)}`, { method: "GET" });
      setSp(info);
      setSpPrice(info.contactPrice == null ? "" : fmt(info.contactPrice));
      setSpMode(info.contactMode);
      setHits(null);
      setQ("");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    }
  }
  async function saveSp() {
    if (!sp) return;
    setSpBusy(true);
    try {
      const price = spPrice.trim() === "" ? null : Number(digits(spPrice)) || 0;
      await api("/api/admin/kontaktlar", { method: "PATCH", body: JSON.stringify({ specialistId: sp.specialistId, contactMode: spMode, contactPrice: price }) });
      showToast(`${sp.name}: saqlandi`, "success");
      const info = await api<SpInfo>(`/api/admin/kontaktlar?userId=${encodeURIComponent(sp.specialistId)}`, { method: "GET" }).catch(() => null);
      if (info) setSp(info);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setSpBusy(false);
    }
  }

  // Kutilayotgan o'tkazmalar
  const [invBusy, setInvBusy] = useState<string | null>(null);
  async function act(id: string, action: "approve" | "reject") {
    setInvBusy(id);
    try {
      await api("/api/admin/kontaktlar", { method: "POST", body: JSON.stringify({ invoiceId: id, action }) });
      showToast(action === "approve" ? "Tasdiqlandi — kontakt ochildi" : "Rad etildi", "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setInvBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-bold text-fg">
          <Banknote size={16} /> Umumiy narxlar (tajriba darajasi bo&apos;yicha)
        </h2>
        <p className="mt-0.5 text-[12.5px] text-fg-3">Mijoz mutaxassis kontaktini ochish uchun platformaga shuncha to&apos;laydi. 0 — bepul ochiladi. Maxsus narxi bor mutaxassisga tegmaydi.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {PRICE_KEYS.map(({ key, level }) => (
            <label key={key} className="block">
              <span className="field-label">{LEVEL_LABEL[level] ?? level}</span>
              <span className="relative block">
                <input className="field !pr-14 tabular-nums" inputMode="numeric" value={vals[key]} onChange={(e) => setVals((v) => ({ ...v, [key]: digits(e.target.value) ? fmt(Number(digits(e.target.value).slice(0, 9))) : "" }))} aria-label={`${LEVEL_LABEL[level] ?? level} — kontakt narxi`} />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-fg-3">so&apos;m</span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" disabled={!dirty || savingPrices} onClick={() => void savePrices()} className="btn-accent inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-semibold disabled:opacity-50">
            {savingPrices && <Loader2 size={14} className="animate-spin" />} Saqlash
          </button>
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-bold text-fg">
          <Contact size={16} /> Maxsus narx va rejim
        </h2>
        <p className="mt-0.5 text-[12.5px] text-fg-3">Mutaxassisni toping — unga alohida narx qo&apos;ying yoki kontaktini «faqat portfolio» (sotilmaydi) rejimiga o&apos;tkazing.</p>
        <label className="relative mt-3 block">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, email yoki @taxallus" aria-label="Mutaxassis qidirish" className="field h-11 w-full pl-10 text-[14px]" />
        </label>
        {hits && (
          <ul className="mt-2 divide-y divide-line rounded-[14px] border border-line">
            {hits.length === 0 && <li className="px-4 py-4 text-center text-[13px] text-fg-3">Mutaxassis topilmadi</li>}
            {hits.map((u) => (
              <li key={u.id}>
                <button type="button" onClick={() => void pick(u)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-fg/4">
                  <Avatar name={u.name} src={u.avatarUrl} size={34} decorative />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-fg">{u.name}</span>
                    <span className="block truncate text-[12px] text-fg-3">{u.email}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {sp && (
          <div className="mt-4 rounded-[14px] border border-line p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-[15px] font-semibold text-fg">{sp.name}</p>
              <span className="text-[12.5px] text-fg-3">{LEVEL_LABEL[sp.experience] ?? sp.experience} · hozirgi narx {formatPrice(sp.effectivePrice)} · {sp.sold} marta sotilgan</span>
              <Link href={`/mutaxassislar/${sp.slug}`} target="_blank" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-fg-2 hover:text-fg">
                Profil <ExternalLink size={12} />
              </Link>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">Maxsus narx (bo&apos;sh — umumiy)</span>
                <span className="relative block">
                  <input className="field !pr-14 tabular-nums" inputMode="numeric" value={spPrice} onChange={(e) => setSpPrice(digits(e.target.value) ? fmt(Number(digits(e.target.value).slice(0, 9))) : "")} placeholder={fmt(sp.effectivePrice)} />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-fg-3">so&apos;m</span>
                </span>
              </label>
              <div>
                <span className="field-label">Rejim</span>
                <div className="flex gap-2">
                  {(["paid", "hidden"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setSpMode(m)} className={cn("h-11 flex-1 rounded-[12px] border text-[13px] font-semibold", spMode === m ? "border-fg bg-fg/[0.03] text-fg" : "border-line text-fg-2")}>
                      {m === "paid" ? "Sotiladi" : "Faqat portfolio"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button type="button" disabled={spBusy} onClick={() => void saveSp()} className="btn-accent inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-semibold disabled:opacity-50">
                {spBusy && <Loader2 size={14} className="animate-spin" />} Saqlash
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="flex items-center gap-2 font-display text-[16px] font-bold text-fg">
            <Receipt size={16} /> Kutilayotgan o&apos;tkazmalar <span className="text-fg-3">({pending.length})</span>
          </h2>
        </header>
        {pending.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-fg-3">Navbat bo&apos;sh — qo&apos;lda o&apos;tkazma bilan boshlangan kontakt to&apos;lovlari shu yerda tasdiqlanadi.</p>
        ) : (
          <ul className="divide-y divide-line">
            {pending.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-fg">{inv.title}</span>
                  <span className="block truncate text-[12px] text-fg-3">
                    {inv.buyer ? `${inv.buyer.name} · ${inv.buyer.email}` : "—"} · {formatDateTime(inv.createdAt)} · {inv.state === "pending" ? "«To'ladim» deyilgan" : "hali yuborilmagan"}
                  </span>
                </span>
                <span className="text-[14px] font-bold tabular-nums text-fg">{formatPrice(inv.amount)}</span>
                {inv.receiptUrl && (
                  <a href={inv.receiptUrl} target="_blank" rel="noreferrer noopener" className="inline-flex h-9 items-center gap-1 rounded-full border border-line-2 px-3 text-[12.5px] font-semibold text-fg-2 hover:text-fg">
                    Chek <ExternalLink size={12} />
                  </a>
                )}
                <button type="button" disabled={invBusy === inv.id} onClick={() => void act(inv.id, "approve")} className="btn-accent inline-flex h-9 items-center gap-1 rounded-full px-3.5 text-[12.5px] font-semibold disabled:opacity-50">
                  {invBusy === inv.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Tasdiqlash
                </button>
                <button type="button" disabled={invBusy === inv.id} onClick={() => void act(inv.id, "reject")} className="inline-flex h-9 items-center gap-1 rounded-full border border-line-2 px-3.5 text-[12.5px] font-semibold text-danger-text disabled:opacity-50">
                  <X size={13} /> Rad etish
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card overflow-hidden">
        <header className="border-b border-line px-4 py-3">
          <h2 className="font-display text-[16px] font-bold text-fg">So&apos;nggi ochilishlar</h2>
        </header>
        {recent.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-fg-3">Hali hech kim kontakt ochmagan.</p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]">
                <span className="font-semibold text-fg">{r.buyer.name}</span>
                <span className="text-fg-3">→</span>
                <Link href={`/mutaxassislar/${r.specialist.slug}`} className="font-semibold text-fg hover:underline">
                  {r.specialist.name}
                </Link>
                <span className="ml-auto text-[12px] text-fg-3">
                  {formatDateTime(r.at)} · {r.amount ? formatPrice(r.amount) : "bepul"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

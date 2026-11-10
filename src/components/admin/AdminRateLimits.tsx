"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Gauge, RefreshCw, Search } from "lucide-react";
import { adminApi, errText, leftText } from "@/components/admin/admin-api";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Admin «Tizim» tabi: TEZLIK CHEKLOVLARI — hozir faol hisoblagichlar (kim/nima, nechta urinish, oyna qachon tugaydi).
 * Asosiy holat: haqiqiy foydalanuvchi «juda ko'p urinish» xatosiga tushib qolgan — ism/email/IP bo'yicha topib,
 * «Tozalash» bilan darhol ochiladi (har tozalash audit jurnalida). GET/DELETE/POST /api/admin/limitlar.
 * Sessiya va 2FA belgilari (ular ham shu jadvalda) bu yerda ko'rinmaydi va tozalanmaydi — server oq ro'yxati.
 */
interface Row {
  key: string;
  name: string;
  label: string;
  id: string;
  user: { id: string; name: string; email: string } | null;
  count: number;
  limit: number;
  limited: boolean;
  resetAt: number;
}
interface Data {
  items: Row[];
  total: number;
  limitedTotal: number;
  ts: number;
}

export function AdminRateLimits() {
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const [only, setOnly] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setBusy(true);
    try {
      const p = new URLSearchParams();
      if (q.trim().length >= 2) p.set("q", q.trim());
      if (only) p.set("holat", "limited");
      const d = await adminApi<Data>(`/api/admin/limitlar?${p}`);
      if (my !== seq.current) return;
      setData(d);
      setError(null);
    } catch (e) {
      if (my === seq.current) setError(errText(e, "Ro'yxatni yuklab bo'lmadi"));
    } finally {
      if (my === seq.current) setBusy(false);
    }
  }, [q, only]);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void load(), q ? 300 : 0);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [load, q]);

  async function clearOne(r: Row) {
    if (!(await confirm({ title: "Limitni tozalaysizmi?", text: `«${r.label}» — ${r.user ? r.user.name : r.id}. Hisoblagich nolga tushadi va darhol qayta urinish mumkin bo'ladi.`, confirmLabel: "Tozalash" }))) return;
    try {
      await adminApi(`/api/admin/limitlar?key=${encodeURIComponent(r.key)}`, { method: "DELETE" });
      setData((d) => (d ? { ...d, items: d.items.filter((x) => x.key !== r.key), total: Math.max(0, d.total - 1), limitedTotal: Math.max(0, d.limitedTotal - (r.limited ? 1 : 0)) } : d));
      showToast("Limit tozalandi");
    } catch (e) {
      showToast(errText(e), "error");
      void load();
    }
  }

  async function clearAll() {
    if (!data?.items.length) return;
    const keys = data.items.slice(0, 50).map((x) => x.key);
    if (!(await confirm({ title: `${keys.length} ta limitni tozalaysizmi?`, text: `«${q.trim()}» bo'yicha topilgan barcha hisoblagichlar nolga tushadi.`, confirmLabel: "Hammasini tozalash" }))) return;
    try {
      const d = await adminApi<{ cleared: number }>("/api/admin/limitlar", { method: "POST", json: { keys } });
      showToast(`${d.cleared} ta limit tozalandi`);
      void load();
    } catch (e) {
      showToast(errText(e), "error");
    }
  }

  const searching = q.trim().length >= 2;

  return (
    <div className="card @container overflow-hidden">
      <div className="flex flex-col gap-2.5 border-b border-line p-3 @xl:flex-row @xl:items-center sm:p-4">
        <label className="relative block min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-4" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, email, @taxallus yoki IP" className="field !h-10 !min-h-0 w-full !rounded-full !py-0 pl-9 text-[13.5px]" aria-label="Limitlarni qidirish" type="search" autoComplete="off" maxLength={80} />
        </label>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" aria-pressed={only} onClick={() => setOnly((v) => !v)} className="chip !min-h-10 !rounded-full">
            Faqat cheklanganlar
            {data && data.limitedTotal > 0 && <span className={cn("rounded-full px-1.5 text-[11px] font-bold tabular-nums", only ? "bg-bg/20" : "bg-danger-soft text-danger-text")}>{data.limitedTotal}</span>}
          </button>
          {searching && data && data.items.length > 1 && (
            <button type="button" onClick={() => void clearAll()} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[12.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
              <Eraser size={14} /> Topilganlarni tozalash
            </button>
          )}
          <button type="button" onClick={() => void load()} disabled={busy} aria-label="Ro'yxatni yangilash" title="Yangilash" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line-2 text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-50">
            <RefreshCw size={15} className={cn(busy && "animate-spin")} />
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="border-b border-line bg-danger-soft px-4 py-2 text-[12.5px] font-medium text-danger-text">
          {error}
        </p>
      )}

      {!data ? (
        <ul aria-busy="true" aria-label="Yuklanmoqda">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 border-b border-line p-4 last:border-0">
              <span className="flex-1 space-y-2">
                <span className="block h-3.5 w-1/3 skeleton" />
                <span className="block h-3 w-1/2 skeleton" />
              </span>
              <span className="h-8 w-20 rounded-full skeleton" />
            </li>
          ))}
        </ul>
      ) : data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-fg/6 text-fg-3">
            <Gauge size={18} aria-hidden="true" />
          </span>
          <p className="text-[14px] font-semibold text-fg">{searching ? "Bu qidiruv bo'yicha faol limit yo'q" : only ? "Hozir hech kim cheklanmagan" : "Faol hisoblagich yo'q"}</p>
          <p className="max-w-sm text-[12.5px] leading-relaxed text-fg-3">{searching ? "Foydalanuvchi cheklovga tushmagan yoki oynasi allaqachon tugagan." : "Cheklovga tushgan foydalanuvchi shu yerda ko'rinadi — qidiruvga ism, email yoki IP yozing."}</p>
        </div>
      ) : (
        <>
          <p className="border-b border-line px-4 py-2 text-[12px] text-fg-4" aria-live="polite">
            {data.total} ta faol hisoblagich · {data.limitedTotal} tasi limitga yetgan{data.total > data.items.length ? ` · birinchi ${data.items.length} tasi ko'rsatilgan` : ""}
          </p>
          <ul className="skeleton-swap divide-y divide-line">
            {data.items.map((r) => {
              const pct = Math.min(100, Math.round((r.count / r.limit) * 100));
              return (
                <li key={r.key} className="flex flex-col gap-2 px-3 py-3 @lg:flex-row @lg:items-center @lg:gap-4 sm:px-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13.5px] font-semibold text-fg">
                      <span className="min-w-0 break-words">{r.label}</span>
                      {r.limited && <span className="rounded-full bg-danger-soft px-1.5 py-0.5 text-[10.5px] font-bold text-danger-text">cheklangan</span>}
                    </p>
                    <p className="mt-0.5 truncate text-[12.5px] text-fg-3" title={r.key} data-no-auto>
                      {r.user ? (
                        <>
                          <span className="font-medium text-fg-2">{r.user.name}</span> · {r.user.email}
                        </>
                      ) : (
                        <code className="font-mono text-[12px] text-fg-2">{r.id}</code>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 @lg:w-[46%] @lg:shrink-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 text-[12px]">
                        <span className={cn("font-semibold tabular-nums", r.limited ? "text-danger-text" : "text-fg-2")}>
                          {r.count} / {r.limit}
                        </span>
                        <span className="truncate text-fg-4" title={`Kalit: ${r.key}`}>
                          {leftText(r.resetAt - data.ts)} qoldi
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.label}: ${r.count} / ${r.limit}`}>
                        <div className={cn("h-full rounded-full", r.limited ? "bg-danger" : pct >= 70 ? "bg-warning" : "bg-fg-4")} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <button type="button" onClick={() => void clearOne(r)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line-2 px-3 text-[12.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
                      <Eraser size={13} /> Tozalash
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

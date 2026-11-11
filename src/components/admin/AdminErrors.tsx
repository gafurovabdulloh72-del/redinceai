"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Ago } from "@/components/ui/Ago";
import { Bug, Check, ChevronDown, Copy, Eraser, Monitor, RefreshCw, RotateCcw, Search, Server, Trash2 } from "lucide-react";
import { AdminRowMenu } from "@/components/admin/AdminRowMenu";
import { adminApi, errText, setAdminTabCount } from "@/components/admin/admin-api";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { showToast } from "@/components/ui/toast";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

/**
 * Admin «Tizim» tabi: XATOLAR JURNALI («Sentry-lite») — server va brauzer xatolari guruhlangan holda
 * (bir xil xato — bitta qator, necha marta va oxirgi marta qachon uchragani bilan). Qator ochilsa — stek va kontekst.
 * Amallar: «Hal qilindi» (xato qaytsa o'zi yana ochiladi), o'chirish, jurnalni tozalash. GET/PATCH/DELETE /api/admin/xatolar.
 * Matnlar serverda tozalangan (email/telefon/token yo'q) — bu yerda faqat matn sifatida chiziladi.
 */
interface Row {
  id: string;
  kind: "server" | "client";
  message: string;
  stack: string;
  path: string;
  method: string;
  status: number | null;
  count: number;
  firstAt: number;
  lastAt: number;
  resolvedAt: number | null;
  device: string;
  user: { id: string; name: string | null; email: string | null } | null;
  extra: Record<string, string | number | boolean>;
  fingerprint: string;
}
interface Counts {
  open: number;
  resolved: number;
  openServer: number;
  openClient: number;
  open24h: number;
}
interface ListData {
  items: Row[];
  nextCursor: string | null;
  counts: Counts;
}

type Status = "open" | "resolved" | "all";
type Kind = "all" | "server" | "client";

const EXTRA_LABEL: Record<string, string> = { digest: "Kod (digest)", manba: "Manba", routeType: "Route turi", routePath: "Route", renderSource: "Render", type: "Hodisa", source: "Fayl", line: "Qator", col: "Ustun" };
const EVENT_LABEL: Record<string, string> = { error: "skript xatosi", rejection: "ushlanmagan promise", boundary: "xatolik ekrani", global: "ildiz xatolik ekrani" };

export function AdminErrors({ initialOpen = 0 }: { initialOpen?: number }) {
  const confirm = useConfirm();
  const [status, setStatus] = useState<Status>("open");
  const [kind, setKind] = useState<Kind>("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  /** Eskirgan javob yangi filtr natijasini bosib qo'ymasin */
  const seq = useRef(0);

  const applyCounts = useCallback((c: Counts) => {
    setCounts(c);
    setAdminTabCount("tizim", c.openServer);
  }, []);

  const load = useCallback(
    async (more?: string | null) => {
      const my = ++seq.current;
      setBusy(true);
      setError(null);
      try {
        const p = new URLSearchParams({ holat: status, tur: kind });
        if (q.trim().length >= 2) p.set("q", q.trim());
        if (more) p.set("before", more);
        const data = await adminApi<ListData>(`/api/admin/xatolar?${p}`);
        if (my !== seq.current) return;
        setRows((prev) => (more && prev ? [...prev, ...data.items] : data.items));
        setCursor(data.nextCursor);
        applyCounts(data.counts);
      } catch (e) {
        if (my === seq.current) setError(errText(e, "Jurnalni yuklab bo'lmadi"));
      } finally {
        if (my === seq.current) setBusy(false);
      }
    },
    [status, kind, q, applyCounts],
  );

  // Filtr o'zgarsa darhol, qidiruv yozilayotganda 300 ms kutib
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void load(), q ? 300 : 0);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [load, q]);

  async function resolve(r: Row, resolved: boolean) {
    try {
      const d = await adminApi<{ counts: Counts }>("/api/admin/xatolar", { method: "PATCH", json: { ids: [r.id], resolved } });
      applyCounts(d.counts);
      // Joriy filtrga mos kelmay qolgan qator ro'yxatdan chiqadi
      setRows((l) => (status === "all" ? (l?.map((x) => (x.id === r.id ? { ...x, resolvedAt: resolved ? Date.now() : null } : x)) ?? l) : (l?.filter((x) => x.id !== r.id) ?? l)));
      if (status !== "all") setOpenId(null);
      showToast(resolved ? "Hal qilindi deb belgilandi" : "Qayta ochildi");
    } catch (e) {
      showToast(errText(e), "error");
    }
  }

  async function remove(r: Row) {
    if (!(await confirm({ title: "Yozuvni o'chirasizmi?", text: "Xato qayta uchrasa, yangi yozuv sifatida yana paydo bo'ladi.", confirmLabel: "O'chirish", danger: true }))) return;
    try {
      const d = await adminApi<{ counts: Counts }>(`/api/admin/xatolar?id=${encodeURIComponent(r.id)}`, { method: "DELETE" });
      applyCounts(d.counts);
      setRows((l) => l?.filter((x) => x.id !== r.id) ?? l);
      showToast("O'chirildi");
    } catch (e) {
      showToast(errText(e), "error");
    }
  }

  async function clear(scope: "resolved" | "all") {
    const all = scope === "all";
    const ok = await confirm({
      title: all ? "Butun jurnalni tozalaysizmi?" : "Hal qilinganlarni tozalaysizmi?",
      text: all ? "Ochiq xatolar ham o'chadi. Xato qayta uchrasa, yangidan yoziladi — lekin tarix (necha marta, birinchi marta qachon) yo'qoladi." : "Faqat «hal qilindi» deb belgilangan yozuvlar o'chiriladi.",
      confirmLabel: "Tozalash",
      danger: true,
    });
    if (!ok) return;
    try {
      const d = await adminApi<{ deleted: number; counts: Counts }>(`/api/admin/xatolar?scope=${scope}`, { method: "DELETE" });
      applyCounts(d.counts);
      showToast(d.deleted ? `${d.deleted} ta yozuv o'chirildi` : "O'chiradigan yozuv yo'q");
      void load();
    } catch (e) {
      showToast(errText(e), "error");
    }
  }

  async function copy(r: Row) {
    try {
      await navigator.clipboard.writeText([r.message, `${r.method} ${r.path}`.trim(), r.stack].filter(Boolean).join("\n"));
      showToast("Nusxalandi");
    } catch {
      showToast("Nusxalab bo'lmadi", "error");
    }
  }

  const open = counts?.open ?? initialOpen;
  const STATUS: Array<[Status, string, number | null]> = [
    ["open", "Ochiq", open],
    ["resolved", "Hal qilingan", counts?.resolved ?? null],
    ["all", "Hammasi", null],
  ];
  const KIND: Array<[Kind, string, number | null]> = [
    ["all", "Barcha tur", null],
    ["server", "Server", counts?.openServer ?? null],
    ["client", "Klient", counts?.openClient ?? null],
  ];

  return (
    <div className="card @container overflow-visible">
      <div className="flex flex-col gap-2.5 border-b border-line p-3 @5xl:flex-row @5xl:items-center sm:p-4">
        {/* Tor konteynerda ikki segment ustma-ust va to'liq kenglikda (yashirin gorizontal scroll yo'q); kengida — yonma-yon */}
        <div className="flex flex-col gap-2 @xl:flex-row">
          <div className="segment flex @xl:inline-flex" role="radiogroup" aria-label="Holat">
            {STATUS.map(([v, label, n]) => (
              <button key={v} type="button" role="radio" aria-checked={status === v} data-active={status === v} onClick={() => setStatus(v)} className="segment-item inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 !px-2.5 @xl:flex-none @xl:!px-[0.95rem]">
                <span className="truncate">{label}</span>
                {n != null && n > 0 && <span className="text-[11px] tabular-nums opacity-70">{n}</span>}
              </button>
            ))}
          </div>
          <div className="segment flex @xl:inline-flex" role="radiogroup" aria-label="Tur">
            {KIND.map(([v, label, n]) => (
              <button key={v} type="button" role="radio" aria-checked={kind === v} data-active={kind === v} onClick={() => setKind(v)} className="segment-item inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 !px-2.5 @xl:flex-none @xl:!px-[0.95rem]">
                <span className="truncate">{label}</span>
                {n != null && n > 0 && <span className="text-[11px] tabular-nums opacity-70">{n}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <label className="relative block min-w-0 flex-1">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-4" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Xabar yoki yo'l bo'yicha" className="field !h-10 !min-h-0 w-full !rounded-full !py-0 pl-9 text-[13.5px]" aria-label="Xatolarni qidirish" type="search" autoComplete="off" maxLength={80} />
          </label>
          <button type="button" onClick={() => void load()} disabled={busy} aria-label="Jurnalni yangilash" title="Yangilash" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line-2 text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-50">
            <RefreshCw size={15} className={cn(busy && "animate-spin")} />
          </button>
          <AdminRowMenu
            label="Jurnalni tozalash"
            size="md"
            className="shrink-0 [&>button]:!h-10 [&>button]:!w-10"
            items={[
              { key: "resolved", label: "Hal qilinganlarni tozalash", icon: Eraser, onSelect: () => void clear("resolved") },
              { key: "all", label: "Hammasini tozalash", icon: Trash2, danger: true, divider: true, onSelect: () => void clear("all") },
            ]}
          />
        </div>
      </div>

      {counts && counts.open > 0 && status === "open" && (
        <p className="border-b border-line px-4 py-2 text-[12px] text-fg-3" aria-live="polite">
          {counts.open} ta ochiq xato{counts.open24h > 0 ? ` · ${counts.open24h} tasi so'nggi 24 soatda uchragan` : " · so'nggi 24 soatda yangisi yo'q"}
        </p>
      )}
      {error && (
        <p role="alert" className="border-b border-line bg-danger-soft px-4 py-2 text-[12.5px] font-medium text-danger-text">
          {error}
        </p>
      )}

      {rows === null ? (
        <ul aria-busy="true" aria-label="Yuklanmoqda">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 border-b border-line p-4 last:border-0">
              <span className="h-8 w-8 shrink-0 rounded-full skeleton" />
              <span className="flex-1 space-y-2">
                <span className="block h-3.5 w-2/3 skeleton" />
                <span className="block h-3 w-1/3 skeleton" />
              </span>
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-success-soft text-success-text">
            {status === "open" ? <Check size={18} /> : <Bug size={18} />}
          </span>
          <p className="text-[14px] font-semibold text-fg">{q.trim().length >= 2 ? "Hech narsa topilmadi" : status === "open" ? "Ochiq xato yo'q" : status === "resolved" ? "Hal qilingan yozuv yo'q" : "Jurnal bo'sh"}</p>
          <p className="max-w-sm text-[12.5px] leading-relaxed text-fg-3">{status === "open" && q.trim().length < 2 ? "Server yoki brauzerda xato chiqsa, shu yerda guruhlangan holda ko'rinadi." : "Filtrni o'zgartirib ko'ring."}</p>
        </div>
      ) : (
        <ul className="skeleton-swap divide-y divide-line">
          {rows.map((r) => {
            const isOpen = openId === r.id;
            const Icon = r.kind === "server" ? Server : Monitor;
            const extras = Object.entries(r.extra).filter(([, v]) => v !== "" && v != null);
            return (
              <li key={r.id}>
                <button type="button" onClick={() => setOpenId(isOpen ? null : r.id)} aria-expanded={isOpen} aria-controls={`xato-${r.id}`} className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-fg/3 sm:px-4">
                  <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full", r.kind === "server" ? "bg-danger-soft text-danger-text" : "bg-warning-soft text-warning-text")} title={r.kind === "server" ? "Server xatosi" : "Brauzer (klient) xatosi"}>
                    <Icon size={15} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block break-words font-mono text-[12.5px] leading-snug text-fg", !isOpen && "line-clamp-2")} data-no-auto>
                      {r.message}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-fg-3">
                      <span className="font-semibold text-fg-2">{r.kind === "server" ? "Server" : "Klient"}</span>
                      {(r.method || r.path) && (
                        <code className="max-w-full truncate rounded bg-fg/6 px-1 font-mono text-[11px] text-fg-2" data-no-auto>
                          {[r.method, r.path].filter(Boolean).join(" ")}
                        </code>
                      )}
                      {r.status ? <span className="tabular-nums">{r.status}</span> : null}
                      <time dateTime={new Date(r.lastAt).toISOString()} title={formatDateTime(r.lastAt)} suppressHydrationWarning>
                        <Ago at={r.lastAt} />
                      </time>
                      {r.resolvedAt && <span className="rounded-full bg-success-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-success-text">hal qilingan</span>}
                    </span>
                  </span>
                  <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold tabular-nums", r.count >= 10 ? "bg-danger-soft text-danger-text" : "bg-fg/6 text-fg-2")} title={`${r.count} marta uchragan`}>
                    ×{r.count > 9999 ? "9999+" : r.count}
                  </span>
                  <ChevronDown size={16} className={cn("mt-1 shrink-0 text-fg-4 transition-transform duration-200", isOpen && "rotate-180")} aria-hidden="true" />
                </button>

                {isOpen && (
                  <div id={`xato-${r.id}`} className="expand-in border-t border-line bg-fg/[0.02] px-3 py-3 sm:px-4">
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[12.5px] @xl:grid-cols-2">
                      <Meta label="Birinchi marta" value={formatDateTime(r.firstAt)} />
                      <Meta label="Oxirgi marta" value={formatDateTime(r.lastAt)} />
                      {r.device && <Meta label="Qurilma" value={r.device} />}
                      {r.user && <Meta label="Foydalanuvchi" value={r.user.name ? `${r.user.name}${r.user.email ? ` · ${r.user.email}` : ""}` : `O'chirilgan (${r.user.id.slice(0, 8)})`} />}
                      {extras.map(([k, v]) => (
                        <Meta key={k} label={EXTRA_LABEL[k] ?? k} value={k === "type" ? (EVENT_LABEL[String(v)] ?? String(v)) : String(v)} mono={k !== "type"} />
                      ))}
                      <Meta label="Guruh" value={r.fingerprint} mono />
                    </dl>
                    {r.stack ? (
                      <pre className="mt-3 max-h-72 overflow-auto rounded-[var(--r-sm)] border border-line bg-surface p-3 font-mono text-[11.5px] leading-relaxed text-fg-2" tabIndex={0} aria-label="Stek" data-no-auto>
                        {r.stack}
                      </pre>
                    ) : (
                      <p className="mt-3 text-[12px] text-fg-4">Stek yo'q — brauzer faqat xabarni bergan.</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {r.resolvedAt ? (
                        <button type="button" onClick={() => void resolve(r, false)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[12.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
                          <RotateCcw size={14} /> Qayta ochish
                        </button>
                      ) : (
                        <button type="button" onClick={() => void resolve(r, true)} className="btn-ink inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold">
                          <Check size={14} /> Hal qilindi
                        </button>
                      )}
                      <button type="button" onClick={() => void copy(r)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[12.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
                        <Copy size={14} /> Nusxalash
                      </button>
                      <button type="button" onClick={() => void remove(r)} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-danger/40 px-3.5 text-[12.5px] font-semibold text-danger-text transition hover:bg-danger-soft">
                        <Trash2 size={14} /> O&apos;chirish
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {cursor && rows && rows.length > 0 && (
        <div className="border-t border-line p-3 text-center">
          <button type="button" onClick={() => void load(cursor)} disabled={busy} className="inline-flex h-9 items-center rounded-full border border-line-2 px-4 text-[12.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-50">
            {busy ? "Yuklanmoqda…" : "Yana ko'rsatish"}
          </button>
        </div>
      )}
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 gap-2">
      <dt className="w-28 shrink-0 text-fg-4">{label}</dt>
      <dd className={cn("min-w-0 break-words text-fg-2", mono && "font-mono text-[12px]")} data-no-auto>
        {value}
      </dd>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Ago } from "@/components/ui/Ago";
import { CheckCircle2, ChevronDown, CircleDashed, RefreshCw, TriangleAlert, Wrench, XCircle } from "lucide-react";
import { adminApi, errText } from "@/components/admin/admin-api";
import { cn, timeAgo } from "@/lib/utils";

/**
 * Admin «Tizim» tabi (eng tepada): «ISHGA TUSHIRISHGA TAYYORLIK» — ochilishdan oldingi tekshiruv ro'yxati.
 * GET /api/admin/tayyorlik (lib/admin/readiness.ts). Har band: holat, bir qatorli izoh, «qanday tuzatiladi».
 * Muhim muammo (fail) ko'rsatmasi doim ochiq; ogohlantirishniki — bosilganda. Env qiymatlari bu yerga kelmaydi.
 */
type Status = "ok" | "warn" | "fail";
interface Check {
  key: string;
  group: string;
  status: Status;
  title: string;
  detail: string;
  fix?: string;
  optional?: boolean;
}
interface Report {
  ts: number;
  production: boolean;
  environment: string;
  checks: Check[];
  groups: Array<{ key: string; label: string }>;
  summary: { total: number; ok: number; warn: number; fail: number; percent: number };
}

/** Halqa: foiz + holat rangi (muammo bor — qizil, ogohlantirish — sariq, toza — yashil) */
function Ring({ pct, tone, label }: { pct: number; tone: Status; label: string }) {
  const size = 64;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = tone === "fail" ? "var(--danger)" : tone === "warn" ? "var(--warning)" : "var(--success)";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-2)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, Math.max(0, pct)) / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} className="transition-[stroke-dashoffset] duration-500" />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-fg font-semibold tabular-nums" style={{ fontSize: 17 }}>
        {pct}%
      </text>
    </svg>
  );
}

function StatusIcon({ c }: { c: Check }) {
  if (c.status === "ok") return <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-success" aria-label="Tayyor" />;
  if (c.status === "fail") return <XCircle size={17} className="mt-0.5 shrink-0 text-danger" aria-label="Muhim muammo" />;
  if (c.optional) return <CircleDashed size={17} className="mt-0.5 shrink-0 text-fg-4" aria-label="Ixtiyoriy — sozlanmagan" />;
  return <TriangleAlert size={17} className="mt-0.5 shrink-0 text-warning" aria-label="Ogohlantirish" />;
}

export function AdminReadiness() {
  const [data, setData] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"issues" | "all">("issues");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const d = await adminApi<Report>("/api/admin/tayyorlik");
      setData(d);
      setError(null);
      // Hammasi joyida bo'lsa «muammolar» ko'rinishi bo'sh qoladi — to'liq ro'yxatni ko'rsatamiz
      if (d.summary.fail + d.summary.warn === 0) setView("all");
    } catch (e) {
      setError(errText(e, "Tekshiruvni yuklab bo'lmadi"));
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (key: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  if (!data) {
    return (
      <div className="card p-4 sm:p-5" aria-busy={!error}>
        {error ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="alert" className="text-[13px] font-medium text-danger-text">
              {error}
            </p>
            <button type="button" onClick={() => void load()} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[12.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
              <RefreshCw size={14} /> Qayta urinish
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <span className="h-16 w-16 shrink-0 rounded-full skeleton" />
              <span className="flex-1 space-y-2">
                <span className="block h-4 w-1/3 skeleton" />
                <span className="block h-3 w-1/2 skeleton" />
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-11 skeleton" />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  const { summary: s } = data;
  const tone: Status = s.fail ? "fail" : s.warn ? "warn" : "ok";
  const issues = s.fail + s.warn;
  const headline = s.fail ? `${s.fail} ta muhim muammo` : s.warn ? "Muhim muammo yo'q" : "Hammasi tayyor";
  // «Muammolar» — faqat haqiqiy muammolar; ixtiyoriy sozlanmagan imkoniyatlar «Hammasi»da ko'rinadi
  const shown = view === "issues" ? data.checks.filter((c) => c.status !== "ok" && !c.optional) : data.checks;

  return (
    <div className="card skeleton-swap overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:p-5">
        <Ring pct={s.percent} tone={tone} label={`Tayyorlik ${s.percent}%`} />
        <div className="min-w-0 flex-1 basis-48">
          <p className={cn("font-display text-[17px] font-semibold leading-tight", s.fail ? "text-danger-text" : "text-fg")}>{headline}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-fg-3">
            {s.ok} ta tayyor · {s.warn} ta ogohlantirish · {s.fail} ta muhim muammo
            <span className="text-fg-4"> — {data.environment}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="segment" role="radiogroup" aria-label="Ko'rinish">
            <button type="button" role="radio" aria-checked={view === "issues"} data-active={view === "issues"} onClick={() => setView("issues")} className="segment-item inline-flex items-center gap-1.5">
              Muammolar {issues > 0 && <span className="text-[11px] tabular-nums opacity-70">{issues}</span>}
            </button>
            <button type="button" role="radio" aria-checked={view === "all"} data-active={view === "all"} onClick={() => setView("all")} className="segment-item inline-flex items-center gap-1.5">
              Hammasi <span className="text-[11px] tabular-nums opacity-70">{s.total}</span>
            </button>
          </div>
          <button type="button" onClick={() => void load()} disabled={busy} aria-label="Qayta tekshirish" title={`Tekshirildi ${timeAgo(data.ts)}`} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line-2 text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-50">
            <RefreshCw size={15} className={cn(busy && "animate-spin")} />
          </button>
        </div>
      </div>

      {!data.production && (
        <p className="border-t border-line bg-fg/[0.02] px-4 py-2 text-[12px] leading-relaxed text-fg-3 sm:px-5">
          Bu — sinov muhiti (production emas): productionga xos talablar bu yerda ogohlantirish bo&apos;lib ko&apos;rinadi. Yakuniy tekshiruvni jonli saytning admin panelida o&apos;tkazing.
        </p>
      )}
      {error && (
        <p role="alert" className="border-t border-line bg-danger-soft px-4 py-2 text-[12.5px] font-medium text-danger-text sm:px-5">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="border-t border-line px-4 py-8 text-center text-[13.5px] text-fg-3">Muammo yo&apos;q — barcha {s.total} ta band tayyor.</p>
      ) : (
        data.groups.map((g) => {
          const list = shown.filter((c) => c.group === g.key);
          if (!list.length) return null;
          const all = data.checks.filter((c) => c.group === g.key);
          const okN = all.filter((c) => c.status === "ok").length;
          return (
            <section key={g.key} className="border-t border-line" aria-label={g.label}>
              <h3 className="flex items-center justify-between gap-3 bg-fg/[0.02] px-4 py-2 text-[12px] font-semibold text-fg-3 sm:px-5">
                {g.label}
                <span className={cn("tabular-nums", okN === all.length ? "text-success-text" : "text-fg-4")}>
                  {okN}/{all.length} tayyor
                </span>
              </h3>
              <ul className="divide-y divide-line">
                {list.map((c) => {
                  const canToggle = Boolean(c.fix) && c.status !== "fail";
                  const showFix = Boolean(c.fix) && (c.status === "fail" || open.has(c.key));
                  return (
                    <li key={c.key} className="px-4 py-3 sm:px-5">
                      <div className="flex items-start gap-3">
                        <StatusIcon c={c} />
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13.5px] font-semibold text-fg">
                            <span className="min-w-0 break-words">{c.title}</span>
                            {c.optional && c.status !== "ok" && <span className="rounded-full border border-line px-1.5 py-0.5 text-[10.5px] font-medium text-fg-3">ixtiyoriy</span>}
                          </p>
                          <p className={cn("mt-0.5 break-words text-[12.5px] leading-relaxed", c.status === "fail" ? "text-danger-text" : "text-fg-3")}>{c.detail}</p>
                        </div>
                        {canToggle && (
                          <button type="button" onClick={() => toggle(c.key)} aria-expanded={open.has(c.key)} aria-controls={`tayyorlik-${c.key}`} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[12px] font-semibold text-fg-2 transition-colors hover:bg-fg/6 hover:text-fg">
                            <span className="max-[430px]:sr-only">Tuzatish</span>
                            <ChevronDown size={14} className={cn("transition-transform duration-200", open.has(c.key) && "rotate-180")} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                      {showFix && (
                        <p id={`tayyorlik-${c.key}`} className={cn("ml-[29px] mt-2 flex gap-2 rounded-[var(--r-sm)] px-3 py-2 text-[12.5px] leading-relaxed", c.status === "fail" ? "bg-danger-soft text-fg" : "expand-in bg-fg/[0.04] text-fg-2")}>
                          <Wrench size={14} className="mt-0.5 shrink-0 text-fg-3" aria-hidden="true" />
                          <span className="min-w-0 break-words">{c.fix}</span>
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

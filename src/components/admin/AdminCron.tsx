"use client";

import { useCallback, useEffect, useState } from "react";
import { Ago } from "@/components/ui/Ago";
import { CheckCircle2, CircleAlert, Clock3, FlaskConical, Play, RefreshCw, TriangleAlert } from "lucide-react";
import { adminApi, errText } from "@/components/admin/admin-api";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { showToast } from "@/components/ui/toast";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

/**
 * Admin «Tizim» tabi: CRON HOLATI — kunlik fon vazifasining har qadami (nima qiladi, oxirgi safar nechta yozuvga tegdi,
 * xato bo'lganmi), oxirgi ishlashlar tarixi va «Hozir ishga tushirish» (tasdiq bilan; «Sinov» — hech narsa o'zgartirmaydi).
 * GET/POST /api/admin/cron. Sir (CRON_SECRET) brauzerga kelmaydi — server o'zi chaqiradi.
 */
interface Run {
  at: number;
  ms: number | null;
  errors: number;
  source: "schedule" | "admin";
}
interface Step {
  key: string;
  title: string;
  desc: string;
  values: Array<{ label: string; value: string }>;
  errors: string[];
}
interface Status {
  configured: boolean;
  production: boolean;
  lastRun: Run | null;
  stale: boolean;
  runs: Run[];
  steps: Step[];
  otherErrors: string[];
}
interface RunResult {
  ok: boolean;
  dry: boolean;
  ms: number;
  counts: Record<string, unknown>;
  errors: string[];
}

const dur = (ms: number | null) => (ms == null ? "" : ms < 1000 ? `${ms} ms` : `${Math.round(ms / 100) / 10} s`);

/** Sinov (dry) javobidagi sonlarni o'qiladigan qatorlarga aylantirish */
function dryLines(c: Record<string, unknown>): string[] {
  const n = (v: unknown) => (typeof v === "number" ? v : 0);
  const sub = (c.subscriptions ?? {}) as { sent?: Record<string, number>; expiredInvoices?: number };
  const dig = (c.digests ?? {}) as { due?: number };
  return [
    `Topshirish muddati eslatmasi: ${n(c.dueReminded)} ta buyurtma`,
    `SLA eslatmasi (24 soat javobsiz): ${n(c.slaReminded)} ta`,
    `SLA bo'yicha avtomatik bekor: ${n(c.slaCancelled)} ta`,
    `Vakansiya muddati eslatmasi: ${n(c.vacanciesReminded)} ta`,
    `Obuna eslatmalari: ${Object.values(sub.sent ?? {}).reduce((a, b) => a + n(b), 0)} ta · bekor qilinadigan hisob: ${n(sub.expiredInvoices)} ta`,
    `Jamlama xabarnoma navbati: ${n(dig.due)} ta foydalanuvchi`,
  ];
}

export function AdminCron() {
  const confirm = useConfirm();
  const [st, setSt] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"load" | "run" | "dry" | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  const load = useCallback(async () => {
    setBusy("load");
    try {
      setSt(await adminApi<Status>("/api/admin/cron"));
      setError(null);
    } catch (e) {
      setError(errText(e, "Cron holatini yuklab bo'lmadi"));
    } finally {
      setBusy(null);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function run(dry: boolean) {
    if (!dry && !(await confirm({ title: "Kunlik cron'ni hozir ishga tushirasizmi?", text: "Barcha qadamlar bajariladi: eslatmalar va jamlamalar foydalanuvchilarga yuboriladi, muddati o'tgan to'lovlar o'tkaziladi, eski ma'lumot tozalanadi. Bir daqiqagacha davom etishi mumkin.", confirmLabel: "Ishga tushirish" }))) return;
    setBusy(dry ? "dry" : "run");
    setError(null);
    try {
      const d = await adminApi<{ result: RunResult; status: Status }>("/api/admin/cron", { method: "POST", json: { dry } });
      setResult(d.result);
      setSt(d.status);
      showToast(dry ? "Sinov tugadi — hech narsa o'zgarmadi" : d.result.ok ? "Cron xatosiz bajarildi" : `Cron tugadi: ${d.result.errors.length} ta xato`, dry || d.result.ok ? "success" : "error");
    } catch (e) {
      setError(errText(e, "Ishga tushirib bo'lmadi"));
    } finally {
      setBusy(null);
    }
  }

  if (!st) {
    return (
      <div className="card p-4 sm:p-5" aria-busy={!error}>
        {error ? (
          <p role="alert" className="text-[13px] font-medium text-danger-text">
            {error}
          </p>
        ) : (
          <div className="space-y-2">
            <div className="h-5 w-1/3 skeleton" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 skeleton" />
            ))}
          </div>
        )}
      </div>
    );
  }

  const last = st.lastRun;
  const tone = !last || st.stale ? "warn" : last.errors ? "warn" : "ok";
  const running = busy === "run" || busy === "dry";

  return (
    <div className="card skeleton-swap @container overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:p-5">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", tone === "ok" ? "bg-success-soft text-success-text" : "bg-warning-soft text-warning-text")}>
          {tone === "ok" ? <CheckCircle2 size={18} aria-hidden="true" /> : <Clock3 size={18} aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-[14.5px] font-semibold text-fg" aria-live="polite">
            {!last ? "Hali biror marta ishlamagan" : (
              <>
                Oxirgi marta{" "}
                <time dateTime={new Date(last.at).toISOString()} title={formatDateTime(last.at)} suppressHydrationWarning>
                  <Ago at={last.at} />
                </time>
              </>
            )}
          </p>
          <p className={cn("mt-0.5 text-[12.5px]", tone === "ok" ? "text-fg-3" : "text-warning-text")}>
            {!last
              ? "Jadval ulanmagan bo'lishi mumkin — «Hozir ishga tushirish» bilan tekshiring"
              : [st.stale ? "36 soatdan ko'p o'tdi — jadval ishlamayapti" : null, last.errors ? `${last.errors} ta qadam xato bilan tugadi` : st.stale ? null : "xatosiz", dur(last.ms) || null, last.source === "admin" ? "qo'lda ishga tushirilgan" : "jadval bo'yicha"].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button type="button" onClick={() => void run(true)} disabled={running || !st.configured} title="Hech narsa o'zgartirmaydi: eslatma qadamlari nechta yozuvga tegishini ko'rsatadi" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-50">
            <FlaskConical size={14} className={cn(busy === "dry" && "animate-pulse")} /> {busy === "dry" ? "Tekshirilmoqda…" : "Sinov"}
          </button>
          <button type="button" onClick={() => void run(false)} disabled={running || !st.configured} className="btn-ink inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold disabled:opacity-50">
            {busy === "run" ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />} {busy === "run" ? "Ishlamoqda…" : "Hozir ishga tushirish"}
          </button>
        </div>
      </div>

      {!st.configured && (
        <p className="flex items-start gap-2 border-t border-line bg-danger-soft px-4 py-2.5 text-[12.5px] leading-relaxed text-fg sm:px-5">
          <CircleAlert size={15} className="mt-0.5 shrink-0 text-danger-text" aria-hidden="true" />
          <span>
            <b className="font-semibold">CRON_SECRET sozlanmagan</b> — productionda kunlik cron butunlay o&apos;chiq (jadval ham, bu tugma ham ishlamaydi). Hostingda <code className="font-mono text-[12px]">CRON_SECRET</code> qo&apos;ying va qayta deploy qiling.
          </span>
        </p>
      )}
      {error && (
        <p role="alert" className="border-t border-line bg-danger-soft px-4 py-2 text-[12.5px] font-medium text-danger-text sm:px-5">
          {error}
        </p>
      )}

      {result && (
        <div className="expand-in border-t border-line bg-fg/[0.02] px-4 py-3 sm:px-5" role="status">
          <p className="flex flex-wrap items-center gap-x-2 text-[13px] font-semibold text-fg">
            {result.dry ? <FlaskConical size={15} className="text-fg-3" aria-hidden="true" /> : result.ok ? <CheckCircle2 size={15} className="text-success" aria-hidden="true" /> : <TriangleAlert size={15} className="text-warning" aria-hidden="true" />}
            {result.dry ? "Sinov natijasi (hech narsa o'zgarmadi)" : result.ok ? "Bajarildi — xatosiz" : `Bajarildi — ${result.errors.length} ta xato`}
            <span className="font-normal text-fg-4">{dur(result.ms)}</span>
          </p>
          {result.dry && (
            <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[12.5px] text-fg-2">
              {dryLines(result.counts).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
          {result.errors.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {result.errors.map((e, i) => (
                <li key={i} className="break-words font-mono text-[11.5px] text-danger-text" data-no-auto>
                  {e}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Qadamlar: nima qiladi + oxirgi ishlash natijasi */}
      <ul className="divide-y divide-line border-t border-line">
        {st.steps.map((s) => (
          <li key={s.key} className="flex flex-col gap-1.5 px-4 py-3 @2xl:flex-row @2xl:items-start @2xl:gap-4 sm:px-5">
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              <span aria-hidden="true" className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full", s.errors.length ? "bg-danger" : last ? "bg-success" : "bg-line-2")} />
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-fg">{s.title}</p>
                <p className="text-[12.5px] leading-relaxed text-fg-3">{s.desc}</p>
                {s.errors.map((e, i) => (
                  <p key={i} className="mt-1 break-words font-mono text-[11.5px] text-danger-text" data-no-auto>
                    {e}
                  </p>
                ))}
              </div>
            </div>
            {s.values.length > 0 && (
              <p className="flex shrink-0 flex-wrap gap-1.5 pl-4 @2xl:max-w-[44%] @2xl:justify-end @2xl:pl-0">
                {s.values.map((v) => (
                  <span key={v.label} className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-medium tabular-nums", v.value !== "0" ? "bg-fg/8 text-fg" : "bg-fg/4 text-fg-4")}>
                    {v.label}: <b className="font-semibold">{v.value}</b>
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>

      {st.otherErrors.length > 0 && (
        <div className="border-t border-line px-4 py-3 sm:px-5">
          <p className="text-[12px] font-semibold text-danger-text">Boshqa xatolar</p>
          {st.otherErrors.map((e, i) => (
            <p key={i} className="mt-1 break-words font-mono text-[11.5px] text-danger-text" data-no-auto>
              {e}
            </p>
          ))}
        </div>
      )}

      {st.runs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-4 py-3 sm:px-5">
          <span className="mr-1 text-[12px] font-semibold text-fg-3">Oxirgi ishlashlar</span>
          {st.runs.map((r) => (
            <span key={r.at} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] tabular-nums", r.errors ? "border-warning/40 text-warning-text" : "border-line text-fg-3")} title={`${r.source === "admin" ? "Qo'lda" : "Jadval"}${r.ms != null ? ` · ${dur(r.ms)}` : ""}${r.errors ? ` · ${r.errors} ta xato` : " · xatosiz"}`}>
              {formatDateTime(r.at)}
              {r.source === "admin" && <span className="text-fg-4">· qo&apos;lda</span>}
              {r.errors > 0 && <span>· {r.errors} xato</span>}
            </span>
          ))}
          <button type="button" onClick={() => void load()} disabled={busy !== null} aria-label="Cron holatini yangilash" className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-fg-3 transition-colors hover:bg-fg/6 hover:text-fg disabled:opacity-50">
            <RefreshCw size={14} className={cn(busy === "load" && "animate-spin")} />
          </button>
        </div>
      )}
    </div>
  );
}

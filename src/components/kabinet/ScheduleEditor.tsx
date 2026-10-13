"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, CalendarOff, CalendarX, CheckCircle2, ChevronLeft, ChevronRight, Clock3, TreePalm, X } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { WEEKDAYS, type WeekdayKey } from "@/lib/constants";
import type { Schedule } from "@/lib/db/schema";
import { emptySchedule, isOnVacation, presetSchedule, scheduleStatus, scheduleStatusLabel, scheduleSummary, tashkentNow, toMinutes } from "@/lib/privacy";
import { cn, formatDate } from "@/lib/utils";

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

const PRESETS = [
  { key: "weekdays", label: "Hafta ichi 9–18" },
  { key: "everyday", label: "Har kuni 10–20" },
  { key: "weekend", label: "Faqat dam olish kunlari" },
] as const;

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="switch" />;
}

/* ---------- Band kunlar kalendari (F41) ---------- */
const BLOCK_WINDOW_DAYS = 90;
const MONTH_NAMES = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
function addDaysIso(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(new Date(Date.UTC(y, m - 1, d + days)));
}

/**
 * Oy to'ri: bugundan keyingi 90 kun ichidagi kunlarni bosib band/bo'sh qilish. Oy almashtirish — strelkalar.
 * Har bir kun — 40px+ tugma (aria-pressed), o'tgan va oynadan tashqari kunlar o'chirilgan.
 */
function BlockedDatesCalendar({ today, value, onChange }: { today: string; value: string[]; onChange: (next: string[]) => void }) {
  const last = addDaysIso(today, BLOCK_WINDOW_DAYS - 1);
  const [ty, tm] = today.split("-").map(Number);
  const [ly, lm] = last.split("-").map(Number);
  const totalMonths = (ly - ty) * 12 + (lm - tm) + 1;
  const [offset, setOffset] = useState(0);
  const y = ty + Math.floor((tm - 1 + offset) / 12);
  const m = ((tm - 1 + offset) % 12) + 1;
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Dushanbadan boshlanadi
  const set = new Set(value);
  const cells: Array<string | null> = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => `${y}-${pad2(m)}-${pad2(i + 1)}`)];
  const toggle = (iso: string) => onChange(set.has(iso) ? value.filter((d) => d !== iso) : [...value, iso].sort());

  return (
    <div className="rounded-[var(--r-md)] border border-line p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
          disabled={offset === 0}
          aria-label="Oldingi oy"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-[14px] font-semibold text-fg" aria-live="polite">
          {MONTH_NAMES[m - 1]} {y}
        </p>
        <button
          type="button"
          onClick={() => setOffset((o) => Math.min(totalMonths - 1, o + 1))}
          disabled={offset >= totalMonths - 1}
          aria-label="Keyingi oy"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label={`${MONTH_NAMES[m - 1]} ${y} — band kunlar`}>
        {WEEKDAYS.map((d) => (
          <span key={d.key} className="pb-1 text-[11px] font-bold uppercase tracking-wide text-fg-4" aria-hidden="true">
            {d.short}
          </span>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <span key={`e${i}`} aria-hidden="true" />;
          const day = Number(iso.slice(8));
          const outside = iso < today || iso > last;
          const on = set.has(iso);
          return (
            <button
              key={iso}
              type="button"
              disabled={outside}
              aria-pressed={on}
              aria-label={`${day}-${MONTH_NAMES[m - 1].toLowerCase()}${on ? " — band" : ""}`}
              onClick={() => toggle(iso)}
              className={cn(
                "flex h-10 items-center justify-center rounded-[10px] text-[13px] font-semibold tabular-nums transition active:scale-95",
                outside ? "text-fg-4/60" : on ? "bg-danger-soft text-danger-text ring-1 ring-danger/40" : "text-fg hover:bg-fg/6",
                iso === today && !on && "ring-1 ring-accent/60",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function normalize(s: Schedule | null): Schedule | null {
  if (!s) return null;
  return { days: s.days, note: s.note ?? "" };
}

export function ScheduleEditor({
  initial,
  vacationUntil: initialVacation,
  blockedDates: initialBlocked = [],
}: {
  initial: Schedule | null;
  vacationUntil: string | null;
  /** Band kunlar (F41) */
  blockedDates?: string[];
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(Boolean(initial));
  const [schedule, setSchedule] = useState<Schedule>(() => normalize(initial) ?? presetSchedule("weekdays"));
  const [vacation, setVacation] = useState(initialVacation ?? "");
  const [blocked, setBlocked] = useState<string[]>(() => [...initialBlocked].sort());
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  // Vaqtni faqat klientda o'qiymiz (server va brauzer soati farq qilib hydration xatosi bermasin)
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), 4000);
    return () => window.clearTimeout(t);
  }, [saved]);

  const effective: Schedule | null = enabled ? schedule : null;
  const baseline = useMemo(() => JSON.stringify({ s: normalize(initial), v: initialVacation ?? "", b: [...initialBlocked].sort() }), [initial, initialVacation, initialBlocked]);
  const dirty = JSON.stringify({ s: effective, v: vacation, b: blocked }) !== baseline;

  const status = now != null ? scheduleStatus(effective, now) : null;
  const todayKey = now != null ? tashkentNow(now).dayKey : null;
  const onVacation = now != null && isOnVacation(vacation || null, now);
  const summary = scheduleSummary(effective);

  const setDay = (key: WeekdayKey, patch: Partial<Schedule["days"][WeekdayKey]>) =>
    setSchedule((s) => ({ ...s, days: { ...s.days, [key]: { ...s.days[key], ...patch } } }));

  const validate = () => {
    const out: Record<string, string> = {};
    if (effective) {
      for (const d of WEEKDAYS) {
        const day = effective.days[d.key];
        if (day.enabled && toMinutes(day.from) >= toMinutes(day.to)) out[d.key] = "Tugash vaqti boshlanishdan keyin bo'lsin";
      }
      if (!WEEKDAYS.some((d) => effective.days[d.key].enabled)) out._days = "Kamida bitta ish kunini yoqing yoki jadvalni o'chiring";
    }
    if (vacation && now != null && vacation < tashkentNow(now).date) out.vacationUntil = "Sana o'tib ketgan";
    return out;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !dirty) return;
    setError(null);
    const local = validate();
    setErrors(local);
    if (Object.keys(local).length) {
      setError("Ba'zi maydonlarni tekshiring");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: {}, schedule: effective, vacationUntil: vacation || null, blockedDates: blocked }),
      });
      const json = (await res.json()) as ApiResponse<{ schedule: Schedule | null; vacationUntil: string | null; blockedDates: string[] }>;
      if (!json.ok) {
        setError(json.error);
        if (json.fields) {
          const mapped: Record<string, string> = {};
          for (const [k, msg] of Object.entries(json.fields)) mapped[k.replace(/^schedule\.days\./, "")] = msg;
          setErrors(mapped);
        }
        return;
      }
      setBlocked(json.data.blockedDates ?? blocked);
      setSaved(true);
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  const todayDate = now != null ? tashkentNow(now).date : undefined;

  return (
    <form onSubmit={submit} id="ish-vaqti" className="card scroll-mt-28 p-5 sm:p-7" noValidate>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="btn-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
            <Clock3 size={20} />
          </span>
          <div>
            <h2 className="font-display text-[20px] font-semibold tracking-tight text-fg">Ish vaqti</h2>
            <p className="mt-0.5 text-[13px] text-fg-3">Mijozlar sizga qachon bog'lanish mumkinligini ko'radi. Toshkent vaqti (UTC+5).</p>
          </div>
        </div>
        {status && (
          <span
            className={cn(
              "inline-flex min-h-9 shrink-0 items-center gap-2 self-start rounded-full px-3.5 py-1.5 text-[12px] font-semibold",
              onVacation ? "bg-accent-soft text-accent" : status.state === "open" ? "bg-ios-green/14 text-[#15803d] dark:text-ios-green" : "bg-surface-3 text-fg-2",
            )}
            aria-live="polite"
          >
            <span className={cn("h-2 w-2 rounded-full", onVacation ? "bg-accent" : status.state === "open" ? "bg-ios-green" : "bg-fg-4")} />
            {onVacation ? "Ta'tilda" : scheduleStatusLabel(status)}
          </span>
        )}
      </div>

      {/* Yoqish / o'chirish */}
      <div className="mt-6 flex items-center justify-between gap-4 rounded-[18px] bg-surface-2 px-4 py-3">
        <div>
          <p className="text-[14px] font-semibold text-fg">Ish vaqtini ko'rsatish</p>
          <p className="mt-0.5 text-[12px] text-fg-3">{enabled ? summary || "Kunlarni belgilang" : "Profilda ish vaqti bo'limi ko'rinmaydi"}</p>
        </div>
        <Switch checked={enabled} onChange={setEnabled} label="Ish vaqtini ko'rsatish" />
      </div>

      {enabled && (
        <>
          {/* Andozalar */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[12px] font-semibold text-fg-3">Tez to'ldirish:</span>
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setSchedule((s) => ({ ...presetSchedule(p.key), note: s.note }))}
                className="inline-flex min-h-8 items-center rounded-full border border-line px-3 text-[12px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg active:scale-95"
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSchedule((s) => ({ ...emptySchedule(), note: s.note }))}
              className="inline-flex min-h-8 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-fg-3 transition hover:bg-fg/6 hover:text-fg"
            >
              <X size={12} /> Tozalash
            </button>
          </div>

          {/* Kunlar */}
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {WEEKDAYS.map((d) => {
              const day = schedule.days[d.key];
              const isToday = d.key === todayKey;
              const err = errors[d.key];
              return (
                <li key={d.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                  <Switch checked={day.enabled} onChange={(on) => setDay(d.key, { enabled: on })} label={`${d.label} — ish kuni`} />
                  <span className={cn("w-24 text-[14px] font-semibold sm:w-32", day.enabled ? "text-fg" : "text-fg-3")}>
                    {d.label}
                    {isToday && <span className="ml-1.5 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent-text">bugun</span>}
                  </span>
                  {day.enabled ? (
                    <div className="flex basis-full items-center gap-2 sm:ml-auto sm:basis-auto">
                      <label className="sr-only" htmlFor={`sch-${d.key}-from`}>
                        {d.label} boshlanishi
                      </label>
                      <input
                        id={`sch-${d.key}-from`}
                        type="time"
                        step={300}
                        className={cn("field !w-[136px] !py-2 tabular-nums", err && "!border-ios-red")}
                        value={day.from}
                        onChange={(e) => setDay(d.key, { from: e.target.value })}
                        aria-invalid={Boolean(err)}
                      />
                      <span className="text-fg-4">–</span>
                      <label className="sr-only" htmlFor={`sch-${d.key}-to`}>
                        {d.label} tugashi
                      </label>
                      <input
                        id={`sch-${d.key}-to`}
                        type="time"
                        step={300}
                        className={cn("field !w-[136px] !py-2 tabular-nums", err && "!border-ios-red")}
                        value={day.to}
                        onChange={(e) => setDay(d.key, { to: e.target.value })}
                        aria-invalid={Boolean(err)}
                      />
                    </div>
                  ) : (
                    <span className="ml-auto text-[12px] text-fg-4">Dam olish kuni</span>
                  )}
                  {err && <p className="field-error basis-full !mt-0">{err}</p>}
                </li>
              );
            })}
          </ul>
          {errors._days && <p className="field-error">{errors._days}</p>}

          {/* Izoh */}
          <div className="mt-5">
            <label htmlFor="sch-note" className="field-label">
              Izoh <span className="font-normal text-fg-4">(ixtiyoriy)</span>
            </label>
            <input
              id="sch-note"
              className="field"
              value={schedule.note ?? ""}
              onChange={(e) => setSchedule((s) => ({ ...s, note: e.target.value.slice(0, 200) }))}
              maxLength={200}
              placeholder="Masalan: To'y mavsumida dam olish kunlari ham ishlayman"
            />
            <div className="mt-1 flex justify-end text-[12px] tabular-nums text-fg-4">{(schedule.note ?? "").length}/200</div>
          </div>
        </>
      )}

      {/* Ta'til */}
      <div className="mt-6 border-t border-line pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]", vacation ? "bg-accent-soft text-accent" : "bg-surface-3 text-fg-3")}>
              <TreePalm size={16} />
            </span>
            <div>
              <label htmlFor="sch-vacation" className="text-[14px] font-semibold text-fg">
                Ta'tilda shu sanagacha
              </label>
              <p className="mt-0.5 text-[12px] text-fg-3">
                {onVacation && vacation ? `Profilda «Ta'tilda — ${formatDate(`${vacation}T00:00:00+05:00`)} gacha» banneri ko'rinadi.` : "Belgilansa, profilda ta'til banneri chiqadi; buyurtmalar navbatga qo'yiladi."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:pl-0">
            <input
              id="sch-vacation"
              type="date"
              className={cn("field !w-auto !py-2", errors.vacationUntil && "!border-ios-red")}
              value={vacation}
              min={todayDate}
              onChange={(e) => setVacation(e.target.value)}
              aria-invalid={Boolean(errors.vacationUntil)}
            />
            {vacation && (
              <button type="button" onClick={() => setVacation("")} className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-fg-3 transition hover:bg-fg/6 hover:text-fg" aria-label="Ta'tilni bekor qilish">
                <CalendarOff size={13} /> Bekor
              </button>
            )}
          </div>
        </div>
        {errors.vacationUntil && <p className="field-error">{errors.vacationUntil}</p>}
      </div>

      {/* Band kunlar (F41) */}
      <div className="mt-6 border-t border-line pt-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]", blocked.length ? "bg-danger-soft text-danger-text" : "bg-surface-3 text-fg-3")}>
              <CalendarX size={16} />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-fg">Band kunlar</p>
              <p className="mt-0.5 text-[12px] text-fg-3">Kelgusi {BLOCK_WINDOW_DAYS} kun ichida band bo'lgan kunlarni bosing — profilda «Band kunlar» ro'yxatida ko'rinadi (ish vaqti ko'rinishiga bog'liq).</p>
            </div>
          </div>
          {blocked.length > 0 && (
            <button type="button" onClick={() => setBlocked([])} className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-fg-3 transition hover:bg-fg/6 hover:text-fg">
              <X size={13} /> Tozalash ({blocked.length})
            </button>
          )}
        </div>
        {todayDate ? <BlockedDatesCalendar today={todayDate} value={blocked} onChange={setBlocked} /> : <div className="h-[330px] skeleton" aria-hidden="true" />}
        {errors.blockedDates && <p className="field-error">{errors.blockedDates}</p>}
      </div>

      {error && (
        <div role="alert" className="mt-5 inline-flex items-center gap-2 rounded-full bg-ios-red/12 px-3.5 py-2 text-[13px] font-medium text-ios-red">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse items-stretch gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[13px]" aria-live="polite">
          {saved ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#15803d] dark:text-ios-green">
              <CheckCircle2 size={15} /> Saqlandi
            </span>
          ) : dirty ? (
            <span className="text-fg-3">O'zgarishlar hali saqlanmagan</span>
          ) : (
            <span className="text-fg-4">Hammasi saqlangan</span>
          )}
        </div>
        <Button type="submit" disabled={busy || !dirty} className="sm:min-w-[160px]">
          {busy ? <Spinner /> : "Saqlash"}
        </Button>
      </div>
    </form>
  );
}

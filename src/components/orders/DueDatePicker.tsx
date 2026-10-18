"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

/** Toshkent vaqti (UTC+5) bo'yicha bugungi sana YYYY-MM-DD — server (privacy.tashkentNow) bilan bir xil */
export function tashkentToday(now = Date.now()): string {
  return new Date(now + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
/** `from` dan boshlab band bo'lmagan eng yaqin kun */
export function nextFreeDate(from: string, blocked: ReadonlySet<string>, max: string): string | null {
  let d = from;
  for (let i = 0; i < 400 && d <= max; i++) {
    if (!blocked.has(d)) return d;
    d = addDays(d, 1);
  }
  return null;
}

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const WEEK = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const QUICK = [
  { label: "3 kun", days: 3 },
  { label: "1 hafta", days: 7 },
  { label: "2 hafta", days: 14 },
  { label: "1 oy", days: 30 },
];
const MAX_DAYS = 365;

/**
 * Topshirish sanasi tanlagich (F37): bugundan oldingi va mutaxassis band kunlari (blockedDates) tanlanmaydi.
 * Tez tanlovlar (3 kun / 1 hafta / ...) band kunni chetlab, eng yaqin bo'sh kunni oladi.
 */
export function DueDatePicker({
  id,
  value,
  onChange,
  blocked = [],
  error,
  describedBy,
}: {
  id: string;
  value: string | null;
  onChange: (v: string | null) => void;
  blocked?: string[];
  error?: string;
  describedBy?: string;
}) {
  const today = tashkentToday();
  const max = addDays(today, MAX_DAYS);
  const blockedSet = useMemo(() => new Set(blocked), [blocked]);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => (value ?? today).slice(0, 7)); // YYYY-MM

  const [cy, cm] = cursor.split("-").map(Number);
  const first = new Date(Date.UTC(cy, cm - 1, 1));
  const daysInMonth = new Date(Date.UTC(cy, cm, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // dushanbadan
  const cells: Array<string | null> = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${cursor}-${String(i + 1).padStart(2, "0")}`)];
  const canPrev = cursor > today.slice(0, 7);
  const canNext = cursor < max.slice(0, 7);
  const shift = (n: number) => {
    const d = new Date(Date.UTC(cy, cm - 1 + n, 1));
    setCursor(d.toISOString().slice(0, 7));
  };
  const monthBlocked = blocked.filter((d) => d.startsWith(cursor) && d >= today);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Muddat tez tanlovi">
        {QUICK.map((q) => {
          const d = nextFreeDate(addDays(today, q.days), blockedSet, max);
          const on = Boolean(d && value === d);
          return (
            <button
              key={q.label}
              type="button"
              aria-pressed={on}
              disabled={!d}
              onClick={() => {
                onChange(on ? null : d);
                if (d) setCursor(d.slice(0, 7));
              }}
              className={cn(
                "inline-flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition active:scale-[0.97] disabled:opacity-40",
                on ? "btn-ink border-transparent" : "border-line bg-surface text-fg-2 hover:border-line-2 hover:text-fg",
              )}
            >
              {on && <Check size={13} />}
              {q.label}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          id={id}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`${id}-cal`}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={cn("field inline-flex !w-auto min-w-[220px] items-center gap-2 text-left", error && "!border-danger")}
        >
          <CalendarDays size={16} className="shrink-0 text-fg-3" />
          <span className={cn("flex-1", value ? "text-fg" : "text-fg-4")}>{value ? formatDate(value) : "Kalendardan tanlash"}</span>
          <ChevronRight size={15} className={cn("shrink-0 text-fg-3 transition-transform", open && "rotate-90")} />
        </button>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-fg-3 transition hover:bg-fg/6 hover:text-fg">
            <X size={14} /> Tozalash
          </button>
        )}
      </div>

      {open && (
        <div id={`${id}-cal`} className="pop-in card-outline mt-2 w-full max-w-[360px] !rounded-[16px] p-3">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} disabled={!canPrev} className="flex h-10 w-10 items-center justify-center rounded-full text-fg-2 transition hover:bg-fg/6 disabled:opacity-30" aria-label="Oldingi oy">
              <ChevronLeft size={17} />
            </button>
            <p className="text-[14px] font-semibold text-fg" aria-live="polite">
              {MONTHS[cm - 1]} {cy}
            </p>
            <button type="button" onClick={() => shift(1)} disabled={!canNext} className="flex h-10 w-10 items-center justify-center rounded-full text-fg-2 transition hover:bg-fg/6 disabled:opacity-30" aria-label="Keyingi oy">
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label={`${MONTHS[cm - 1]} ${cy}`}>
            {WEEK.map((w) => (
              <span key={w} className="pb-1 text-[11px] font-semibold text-fg-4" role="columnheader">
                {w}
              </span>
            ))}
            {cells.map((d, i) => {
              if (!d) return <span key={`e${i}`} aria-hidden="true" />;
              const past = d < today || d > max;
              const busy = blockedSet.has(d);
              const sel = value === d;
              return (
                <button
                  key={d}
                  type="button"
                  disabled={past || busy}
                  onClick={() => {
                    onChange(d);
                    setOpen(false);
                  }}
                  aria-pressed={sel}
                  aria-label={`${formatDate(d)}${busy ? " — mutaxassis band" : ""}`}
                  title={busy ? "Mutaxassis bu kunda band" : undefined}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-[10px] text-[13px] font-medium tabular-nums transition",
                    sel ? "btn-ink" : busy ? "bg-danger-soft text-danger-text line-through opacity-80" : past ? "text-fg-4 opacity-40" : "text-fg hover:bg-fg/8",
                    d === today && !sel && "ring-1 ring-line-2",
                  )}
                >
                  {Number(d.slice(8))}
                </button>
              );
            })}
          </div>
          {monthBlocked.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-fg-3">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-danger-soft ring-1 ring-danger/30" /> Mutaxassis band kunlar — tanlab bo'lmaydi
            </p>
          )}
        </div>
      )}
    </div>
  );
}

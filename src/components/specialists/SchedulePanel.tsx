import { CalendarClock, Clock3, Lock, TreePalm } from "lucide-react";
import Link from "next/link";
import { WEEKDAYS } from "@/lib/constants";
import type { Schedule } from "@/lib/db/schema";
import { LOCK_LABEL, isOnVacation, scheduleStatus, scheduleStatusLabel, tashkentNow, type LockReason } from "@/lib/privacy";
import { cn, formatDate } from "@/lib/utils";

/**
 * Ommaviy profildagi "Ish vaqti" bo'limi: holat (hozir ochiq / yopiq — Toshkent vaqti),
 * haftalik jadval va ta'til banneri. Server komponent — vaqt so'rov paytida hisoblanadi.
 */
export function SchedulePanel({
  schedule,
  vacationUntil,
  lock,
  loginHref,
  className,
  now = Date.now(),
}: {
  schedule: Schedule | null;
  vacationUntil: string | null;
  /** Ko'rinish cheklangan bo'lsa — sababi */
  lock?: LockReason | null;
  loginHref: string;
  className?: string;
  now?: number;
}) {
  const vacation = isOnVacation(vacationUntil, now);
  if (!schedule && !lock && !vacation) return null;

  const status = schedule ? scheduleStatus(schedule, now) : { state: "none" as const };
  const today = tashkentNow(now).dayKey;
  const open = status.state === "open" && !vacation;

  return (
    <section className={cn("card p-5 sm:p-6", className)} aria-labelledby="ish-vaqti-title" id="ish-vaqti">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="eyebrow">Ish vaqti</span>
          <h2 id="ish-vaqti-title" className="mt-2 font-display text-[20px] font-semibold tracking-tight text-fg">
            Qachon <span className="accent-serif text-accent">bog'lanish</span> mumkin
          </h2>
        </div>
        {schedule && !vacation && (
          <span
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-semibold",
              open ? "bg-ios-green/14 text-[#15803d] dark:text-ios-green" : "bg-surface-3 text-fg-2",
            )}
          >
            <span className={cn("relative flex h-2 w-2", open && "animate-pulse")}>
              <span className={cn("inline-flex h-2 w-2 rounded-full", open ? "bg-ios-green" : "bg-fg-4")} />
            </span>
            {scheduleStatusLabel(status)}
          </span>
        )}
      </div>

      {vacation && vacationUntil && (
        <div className="mt-4 flex items-start gap-3 rounded-[18px] bg-accent-soft p-4 text-accent">
          <TreePalm size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-[14px] font-semibold">Ta'tilda — {formatDate(`${vacationUntil}T00:00:00+05:00`)} gacha</p>
            <p className="mt-0.5 text-[13px] opacity-90">Shu sanagacha yangi buyurtmalar qabul qilinmasligi mumkin. Buyurtma yuborsangiz, navbatga qo'yiladi.</p>
          </div>
        </div>
      )}

      {lock ? (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-[18px] border border-dashed border-line-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2 text-[13px] text-fg-2">
            <Lock size={14} className="text-fg-3" /> {LOCK_LABEL[lock]}
          </p>
          {lock === "login" && (
            <Link href={loginHref} className="inline-flex h-9 items-center rounded-full border border-line-2 px-4 text-[12px] font-semibold text-fg transition hover:border-fg hover:bg-fg/4">
              Kirish
            </Link>
          )}
        </div>
      ) : schedule ? (
        <>
          <ul className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2" aria-label="Haftalik jadval">
            {WEEKDAYS.map((d) => {
              const day = schedule.days[d.key];
              const isToday = d.key === today;
              const on = Boolean(day?.enabled);
              return (
                <li
                  key={d.key}
                  className={cn(
                    "flex min-h-[72px] flex-col items-center justify-center rounded-[14px] border px-1 py-2 text-center",
                    on ? "border-line bg-surface-2" : "border-transparent bg-surface-3/60 text-fg-4",
                    isToday && "ring-2 ring-accent/60",
                  )}
                  aria-label={`${d.label}: ${on ? `${day.from}–${day.to}` : "dam"}${isToday ? " (bugun)" : ""}`}
                >
                  <span className={cn("text-[11px] font-bold uppercase tracking-wide", isToday ? "text-accent" : on ? "text-fg-2" : "text-fg-4")}>{d.short}</span>
                  {on ? (
                    <span className="mt-1 text-[11px] font-semibold leading-tight text-fg tabular-nums sm:text-[12px]">
                      {day.from}
                      <br />
                      {day.to}
                    </span>
                  ) : (
                    <span className="mt-1 text-[11px] text-fg-4">dam</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-fg-3">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={12} /> Toshkent vaqti (UTC+5)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock size={12} /> Bugun — {WEEKDAYS.find((w) => w.key === today)?.label}
            </span>
          </p>
          {schedule.note?.trim() && <p className="mt-3 rounded-[14px] bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-fg-2">{schedule.note}</p>}
        </>
      ) : null}
    </section>
  );
}

import { CalendarClock, CalendarX, Clock3, Lock, TreePalm } from "lucide-react";
import Link from "next/link";
import { WEEKDAYS } from "@/lib/constants";
import type { Schedule } from "@/lib/db/schema";
import { tr, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { HAFTA_KUNI, HAFTA_KUNI_RU_QACHON, LOCK_SABAB, PROFIL } from "@/lib/i18n/dict/profile";
import { isOnVacation, scheduleStatus, tashkentNow, type LockReason, type ScheduleStatus } from "@/lib/privacy";
import { cn, formatDate } from "@/lib/utils";

const MONTHS_SHORT: Record<Locale, string[]> = {
  uz: ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"],
  ru: ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
};
/** "2026-10-16" → { day: "16-okt", weekday: "Ju" } (UTC sana — vaqt mintaqasidan qat'i nazar bir xil) */
function shortDate(til: Locale, iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const key = WEEKDAYS[(wd + 6) % 7]?.key;
  const month = MONTHS_SHORT[til][m - 1] ?? "";
  return { day: til === "ru" ? `${d} ${month}` : `${d}-${month}`, weekday: key && HAFTA_KUNI[key] ? tr(til, HAFTA_KUNI[key].short) : "" };
}

/** privacy.scheduleStatusLabel'ning til-mos varianti: "Hozir ochiq · 18:00 gacha" / "Закрыто · откроется завтра в 09:00" */
function statusLabel(til: Locale, status: ScheduleStatus): string {
  if (status.state === "none") return tr(til, PROFIL.noSchedule);
  if (status.state === "open") return PROFIL.openNowUntil[til](status.closesAt);
  if (!status.opensAt || !status.opensDay) return tr(til, PROFIL.closed);
  const when =
    status.opensDay === "today"
      ? tr(til, PROFIL.today)
      : status.opensDay === "tomorrow"
        ? tr(til, PROFIL.tomorrow)
        : til === "ru"
          ? (HAFTA_KUNI_RU_QACHON[status.opensDay] ?? "")
          : (HAFTA_KUNI[status.opensDay] ? tr(til, HAFTA_KUNI[status.opensDay].full).toLowerCase() : "");
  // ru: "Закрыто · откроется завтра в 09:00" / "… в пятницу в 09:00"; uz: "Yopiq · ertaga 09:00 da ochiladi"
  return til === "ru" ? `Закрыто · откроется ${when} в ${status.opensAt}` : `Yopiq · ${when} ${status.opensAt} da ochiladi`;
}

/**
 * Ommaviy profildagi "Ish vaqti" bo'limi: holat (hozir ochiq / yopiq — Toshkent vaqti),
 * haftalik jadval va ta'til banneri. Server komponent — vaqt so'rov paytida hisoblanadi.
 */
export async function SchedulePanel({
  schedule,
  vacationUntil,
  lock,
  loginHref,
  className,
  now = Date.now(),
  blockedDates = [],
}: {
  schedule: Schedule | null;
  vacationUntil: string | null;
  /** Band kunlar (F41) — maxfiylik filtridan o'tgan (jadval yashirin bo'lsa bo'sh) */
  blockedDates?: string[];
  /** Ko'rinish cheklangan bo'lsa — sababi */
  lock?: LockReason | null;
  loginHref: string;
  className?: string;
  now?: number;
}) {
  const til = await getLocale();
  const vacation = isOnVacation(vacationUntil, now);
  const todayIso = tashkentNow(now).date;
  const upcoming = [...new Set(blockedDates)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= todayIso).sort();
  if (!schedule && !lock && !vacation && upcoming.length === 0) return null;

  const status = schedule ? scheduleStatus(schedule, now) : { state: "none" as const };
  const today = tashkentNow(now).dayKey;
  const open = status.state === "open" && !vacation;

  return (
    <section className={cn("card p-5 sm:p-6", className)} aria-labelledby="ish-vaqti-title" id="ish-vaqti">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="eyebrow">{tr(til, PROFIL.scheduleEyebrow)}</span>
          <h2 id="ish-vaqti-title" className="mt-2 font-display text-[20px] font-semibold tracking-tight text-fg">
            {tr(til, PROFIL.scheduleTitleStart)} <span className="accent-serif text-accent">{tr(til, PROFIL.scheduleTitleAccent)}</span>
            {tr(til, PROFIL.scheduleTitleEnd) && <> {tr(til, PROFIL.scheduleTitleEnd)}</>}
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
            {statusLabel(til, status)}
          </span>
        )}
      </div>

      {vacation && vacationUntil && (
        <div className="mt-4 flex items-start gap-3 rounded-[18px] bg-accent-soft p-4 text-accent">
          <TreePalm size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-[14px] font-semibold">{PROFIL.vacationUntil[til](formatDate(`${vacationUntil}T00:00:00+05:00`))}</p>
            <p className="mt-0.5 text-[13px] opacity-90">{tr(til, PROFIL.vacationDesc)}</p>
          </div>
        </div>
      )}

      {lock ? (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-[18px] border border-dashed border-line-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2 text-[13px] text-fg-2">
            <Lock size={14} className="text-fg-3" /> {tr(til, LOCK_SABAB[lock])}
          </p>
          {lock === "login" && (
            <Link href={loginHref} className="inline-flex h-9 items-center rounded-full border border-line-2 px-4 text-[12px] font-semibold text-fg transition hover:border-fg hover:bg-fg/4">
              {tr(til, PROFIL.login)}
            </Link>
          )}
        </div>
      ) : schedule ? (
        <>
          <ul className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2" aria-label={tr(til, PROFIL.weeklyAria)}>
            {WEEKDAYS.map((d) => {
              const day = schedule.days[d.key];
              const isToday = d.key === today;
              const on = Boolean(day?.enabled);
              const dayName = HAFTA_KUNI[d.key] ? tr(til, HAFTA_KUNI[d.key].full) : d.label;
              const dayShort = HAFTA_KUNI[d.key] ? tr(til, HAFTA_KUNI[d.key].short) : d.short;
              return (
                <li
                  key={d.key}
                  className={cn(
                    "flex min-h-[72px] flex-col items-center justify-center rounded-[14px] border px-1 py-2 text-center",
                    on ? "border-line bg-surface-2" : "border-transparent bg-surface-3/60 text-fg-4",
                    isToday && "ring-2 ring-accent/60",
                  )}
                  aria-label={`${dayName}: ${on ? `${day.from}–${day.to}` : tr(til, PROFIL.dayOff)}${isToday ? tr(til, PROFIL.dayAriaToday) : ""}`}
                >
                  <span className={cn("text-[11px] font-bold uppercase tracking-wide", isToday ? "text-accent-text" : on ? "text-fg-2" : "text-fg-4")}>{dayShort}</span>
                  {on ? (
                    <span className="mt-1 text-[11px] font-semibold leading-tight text-fg tabular-nums sm:text-[12px]">
                      {day.from}
                      <br />
                      {day.to}
                    </span>
                  ) : (
                    <span className="mt-1 text-[11px] text-fg-4">{tr(til, PROFIL.dayOff)}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-fg-3">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={12} /> {tr(til, PROFIL.tashkentTime)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock size={12} /> {PROFIL.todayIs[til](HAFTA_KUNI[today] ? tr(til, HAFTA_KUNI[today].full) : (WEEKDAYS.find((w) => w.key === today)?.label ?? ""))}
            </span>
          </p>
          {schedule.note?.trim() && <p className="mt-3 rounded-[14px] bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-fg-2">{schedule.note}</p>}
        </>
      ) : null}

      {/* Band kunlar (F41): keyingi 8 tasi */}
      {!lock && upcoming.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-fg-3">
            <CalendarX size={13} aria-hidden="true" /> {tr(til, PROFIL.blockedDays)}
          </h3>
          <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label={tr(til, PROFIL.blockedAria)}>
            {upcoming.slice(0, 8).map((d) => {
              const f = shortDate(til, d);
              return (
                <li key={d} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-line bg-surface-2 px-3 text-[12.5px] font-semibold text-fg-2 tabular-nums">
                  {f.day} <span className="font-medium text-fg-4">{f.weekday}</span>
                </li>
              );
            })}
            {upcoming.length > 8 && <li className="inline-flex min-h-8 items-center px-2 text-[12px] text-fg-3">{PROFIL.moreDays[til](upcoming.length - 8)}</li>}
          </ul>
          <p className="mt-2 text-[12px] text-fg-3">{tr(til, PROFIL.blockedNote)}</p>
        </div>
      )}
    </section>
  );
}

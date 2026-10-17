"use client";

import { CalendarPlus } from "lucide-react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
/** UTC format: 20261018T160800Z */
function utc(ms: number) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** Efirni kalendarga qo'shish: Google Calendar havolasi va .ics fayl (Apple/Outlook) — 1 soatlik tadbir */
export function CalendarLinks({ title, at, url, details, compact = false }: { title: string; at: number; url?: string | null; details?: string; compact?: boolean }) {
  const end = at + 60 * 60 * 1000;
  const text = `Kasb Egalari: ${title}`.slice(0, 120);
  const desc = [details, url ? `Havola: ${url}` : ""].filter(Boolean).join("\n");
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(text)}&dates=${utc(at)}/${utc(end)}&details=${encodeURIComponent(desc)}${url ? `&location=${encodeURIComponent(url)}` : ""}`;
  function ics() {
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kasb Egalari//Efir//UZ", "BEGIN:VEVENT", `UID:${at}-${Math.random().toString(36).slice(2)}@kasbegalari`, `DTSTAMP:${utc(Date.now())}`, `DTSTART:${utc(at)}`, `DTEND:${utc(end)}`, `SUMMARY:${esc(text)}`, desc ? `DESCRIPTION:${esc(desc)}` : "", url ? `URL:${url}` : "", "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", `DESCRIPTION:${esc(text)}`, "END:VALARM", "END:VEVENT", "END:VCALENDAR"].filter(Boolean).join("\r\n");
    const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "efir.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const cls = compact ? "inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold text-fg-2 hover:bg-fg/6 hover:text-fg" : "inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3 text-[12.5px] font-semibold text-fg-2 hover:text-fg";
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <a href={google} target="_blank" rel="noopener noreferrer" className={cls}>
        <CalendarPlus size={13} /> Google Calendar
      </a>
      <button type="button" onClick={ics} className={cls}>
        .ics
      </button>
    </span>
  );
}

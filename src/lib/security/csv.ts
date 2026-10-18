/**
 * CSV eksport yordamchisi (admin). Formula injection'dan himoya: = + - @ \t \r bilan boshlangan katak
 * oldiga ' qo'yiladi (Excel/Sheets formulani bajarmasin), so'ng kerak bo'lsa qo'shtirnoqqa olinadi.
 * UTF-8 BOM — Excel kirill/o'zbek harflarini to'g'ri ochsin.
 */
export const csvCell = (v: unknown): string => {
  const raw = v == null ? "" : v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Tayyor javob: fayl nomi `<name>-<sana>.csv`, kesh yo'q */
export function csvResponse(name: string, header: string[], rows: unknown[][]): Response {
  const body = `﻿${header.join(",")}\n${rows.map((r) => r.map(csvCell).join(",")).join("\n")}\n`;
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

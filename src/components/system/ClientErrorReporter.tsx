"use client";

import { useEffect } from "react";
import { reportClientError } from "./report-error";

/**
 * Brauzerdagi ushlanmagan xatolarni admin «Xatolar» jurnaliga yuboradi (layout'da bir marta o'rnatiladi):
 * `window.error` (skript xatolari) va `unhandledrejection` (ushlanmagan promise). Hech narsa chizmaydi —
 * server DOM'iga tegmaydi. Chegaralar va maxfiylik qoidalari — `report-error.ts`.
 * React xato chegarasi ushlagan xatolar bu hodisalarga TUSHMAYDI — ularni xatolik ekranlari o'zi yuboradi.
 */
export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      // Resurs (rasm/skript) yuklanmadi — xabar ham, xato obyekti ham yo'q: bu xato jurnali ishi emas
      if (!e.error && !e.message) return;
      reportClientError(e.error ?? e.message, { type: "error", source: e.filename, line: e.lineno, col: e.colno });
    };
    const onRejection = (e: PromiseRejectionEvent) => reportClientError(e.reason, { type: "rejection" });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}

import type { Instrumentation } from "next";

/**
 * Next.js instrumentation (2026-11-10, «Xatolar jurnali»).
 *
 * `onRequestError` — server tomonda USHLANMAGAN xatolar: sahifa/layout renderi (server komponent), server action,
 * `handler()` bilan o'ralmagan route (cron, webhook). `handler()` ichidagi xatolar bu yerga YETMAYDI — ularni
 * `handler()`ning o'zi `captureError` bilan yozadi (ikki marta yozilmaydi).
 *
 * Faqat Node muhitida: jurnal bazaga yozadi, Edge (middleware) muhitida esa baza klienti yo'q. `NEXT_RUNTIME` build
 * paytida almashtiriladi — Edge to'plamiga bu import umuman kirmaydi.
 */
export function register(): void {
  /* Ishga tushishda bajariladigan ish yo'q — fayl onRequestError uchun */
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { captureError } = await import("@/lib/observability/errors");
      // Sarlavhalardan faqat kerakligi (sessiya cookie'si → foydalanuvchi, user-agent → qurilma) olinadi
      const pick = (name: string): string | undefined => {
        const v = request.headers[name];
        return Array.isArray(v) ? v.join("; ") : (v ?? undefined);
      };
      const headers = new Headers();
      const cookie = pick("cookie");
      const ua = pick("user-agent");
      if (cookie) headers.set("cookie", cookie);
      if (ua) headers.set("user-agent", ua);
      // `request.path` so'rov satri bilan keladi — captureError faqat pathname'ni oladi va tozalaydi
      const req = new Request(new URL(request.path || "/", "http://internal.invalid"), { method: request.method || "GET", headers });
      await captureError(error, {
        req,
        kind: "server",
        status: 500,
        extra: { manba: "onRequestError", routeType: context.routeType, routePath: context.routePath, renderSource: context.renderSource },
      });
    } catch {
      /* jurnal hech qachon so'rovni buzmasin */
    }
  }
};

/**
 * Brauzer xatosini serverga yuborish (POST /api/xato → admin «Xatolar» jurnali). React'siz oddiy modul —
 * `ClientErrorReporter` (window hodisalari) va xatolik ekranlari (error.tsx, global-error.tsx, SectionError) chaqiradi.
 *
 * Qoidalar:
 *  · hech qachon xato tashlamaydi va foydalanuvchiga hech narsa ko'rsatmaydi;
 *  · sahifa yuklanishida bir xil xato BIR marta, jami ≤5 ta; sessiyada (tab) ≤12 ta — xato sikli serverni bombardimon qilmaydi;
 *  · server rad etsa (429/403/413) shu sahifada boshqa yuborilmaydi;
 *  · shaxsiy ma'lumot yuborilmaydi: faqat xabar, stek va sahifa YO'LI (query/hash'siz); matndagi URL so'rov satrlari va
 *    emaillar shu yerning o'zida kesiladi (server ham qayta tozalaydi);
 *  · brauzer kengaytmalari va zararsiz shovqin («Script error.», ResizeObserver, tarmoq uzilishi) yuborilmaydi.
 * DIQQAT: bu fayl brauzerga ketadi — lookbehind regex ISHLATILMASIN (eski Safari butun chunk'ni o'qiy olmay qoladi);
 * shu sababli server tozalagichi (lib/observability/sanitize.ts) bu yerga import qilinmaydi.
 */
const ENDPOINT = "/api/xato";
const MAX_PER_PAGE = 5;
const MAX_PER_SESSION = 12;
const SESSION_KEY = "ke_xato_n";

export interface ClientErrorInfo {
  type?: "error" | "rejection" | "boundary" | "global";
  /** window.onerror: fayl manzili, qator, ustun */
  source?: string;
  line?: number;
  col?: number;
  /** Server render xatosi belgisi — bunday xato serverda (onRequestError) to'liq yozilgan, brauzerdan qayta yuborilmaydi */
  digest?: string;
}

const seen = new Set<string>();
let sentThisPage = 0;
let disabled = false;

const NOISE_SOURCE = /(?:chrome|moz|safari|safari-web|ms-browser|webkit-masked)-(?:extension|url):\/\//i;
const NOISE_MESSAGE = [/^script error\.?$/i, /resizeobserver loop/i, /^non-error promise rejection captured/i, /^aborterror/i, /aborted/i, /load failed$/i, /^failed to fetch$/i, /^networkerror when attempting to fetch/i, /^cancell?ed$/i];

/** URL so'rov satri/hash va emaillarni kesish (yengil — to'liq tozalash serverda) */
function strip(s: string): string {
  return s
    .replace(/(https?:\/\/[^\s"'<>()?#]+)[?#][^\s"'<>():]*/g, "$1")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, "[email]");
}

function normalize(error: unknown): { name: string; message: string; stack: string } {
  if (error && typeof error === "object") {
    const e = error as { name?: unknown; message?: unknown; stack?: unknown };
    const message = typeof e.message === "string" ? e.message : "";
    if (message || typeof e.stack === "string") {
      return { name: typeof e.name === "string" ? e.name : "", message, stack: typeof e.stack === "string" ? e.stack : "" };
    }
    try {
      return { name: "", message: JSON.stringify(error).slice(0, 300), stack: "" };
    } catch {
      return { name: "", message: "", stack: "" };
    }
  }
  return { name: "", message: typeof error === "string" ? error : error == null ? "" : String(error), stack: "" };
}

function sessionCount(): number {
  try {
    return Number(sessionStorage.getItem(SESSION_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}
function bumpSession(n: number): void {
  try {
    sessionStorage.setItem(SESSION_KEY, String(n));
  } catch {
    /* yopiq rejim — sahifa bo'yicha chegara baribir ishlaydi */
  }
}

export function reportClientError(error: unknown, info: ClientErrorInfo = {}): void {
  try {
    if (typeof window === "undefined" || disabled) return;
    // Server tomonda chiqqan xato (digest bor) — serverning o'zi to'liq stek bilan yozgan; brauzerdagi nusxasi umumiy matn
    if (info.digest) return;
    const { name, message, stack } = normalize(error);
    const msg = message.trim();
    if (!msg) return;
    if (NOISE_SOURCE.test(stack) || NOISE_SOURCE.test(info.source ?? "") || NOISE_MESSAGE.some((re) => re.test(msg))) return;

    const key = `${msg}|${(stack.split("\n")[1] ?? "").trim()}`.slice(0, 300);
    if (seen.has(key)) return;
    seen.add(key);
    if (sentThisPage >= MAX_PER_PAGE) return;
    const n = sessionCount();
    if (n >= MAX_PER_SESSION) return;
    sentThisPage += 1;
    bumpSession(n + 1);

    const body = JSON.stringify({
      name: name.slice(0, 80) || undefined,
      message: strip(msg).slice(0, 1000),
      stack: stack ? strip(stack).slice(0, 6000) : undefined,
      path: window.location.pathname.slice(0, 400),
      source: info.source ? strip(info.source).slice(0, 400) : undefined,
      line: typeof info.line === "number" && info.line >= 0 ? Math.floor(info.line) : undefined,
      col: typeof info.col === "number" && info.col >= 0 ? Math.floor(info.col) : undefined,
      type: info.type ?? "error",
    });
    void fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "same-origin" })
      .then((r) => {
        if (r.status === 429 || r.status === 403 || r.status === 413) disabled = true;
      })
      .catch(() => undefined);
  } catch {
    /* hisobot yuborish hech qachon sahifani buzmasin */
  }
}

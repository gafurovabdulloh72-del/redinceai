import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { cleanMessage } from "@/lib/observability/sanitize";

/**
 * CRON HOLATI (2026-11-10) — kunlik fon vazifasi (`/api/cron/daily`) qadamlari va oxirgi ishlash natijalari.
 *
 * Manba: cron har ishlaganda audit jurnaliga `cron_daily` yozadi (meta — har qadam sanog'i, `errors[]`, `ms`, `source`).
 * Bu modul shu yozuvlarni o'qib, qadamlar ro'yxatiga yoyadi. `CRON_STEPS` — route'dagi qadamlarning tavsifi:
 * route'ga YANGI QADAM qo'shsangiz shu ro'yxatga ham yozing (sanoq kaliti va xato prefiksi bilan), aks holda uning
 * natijasi kartada «boshqa xatolar»ga tushadi yoki ko'rinmaydi.
 */
export interface CronStepDef {
  key: string;
  title: string;
  desc: string;
  /** Audit meta'dagi sanoqlar: `path` — nuqtali yo'l (masalan `digests.sent`) */
  counts: Array<{ path: string; label: string }>;
  /** `errors[]` satrlari shu so'zlardan biri bilan boshlansa — shu qadamniki (`<prefiks>:` yoki `<prefiks> <id>:`) */
  errors: string[];
}

export const CRON_STEPS: CronStepDef[] = [
  { key: "payments", title: "Eskirgan to'lov urinishlari", desc: "12 soatdan beri «kutilmoqda» turgan Payme/Click tranzaksiyalari bekor qilinadi.", counts: [{ path: "expiredPayments", label: "bekor qilindi" }], errors: ["expire"] },
  { key: "escrow", title: "Eskrou: avtomatik o'tkazma", desc: "Ish qabul qilingach muddati o'tgan to'lovlar mutaxassisga o'tkaziladi (nizo bo'lmasa).", counts: [{ path: "autoReleased", label: "o'tkazildi" }, { path: "autoReleaseScheduled", label: "muddat belgilandi" }], errors: ["schedule", "release", "autoRelease"] },
  { key: "orders", title: "Buyurtma eslatmalari va SLA", desc: "Topshirish muddati yaqin — eslatma; 24 soat javobsiz — eslatma; 72 soat — avtomatik bekor.", counts: [{ path: "dueReminded", label: "muddat eslatmasi" }, { path: "slaReminded", label: "SLA eslatmasi" }, { path: "slaCancelled", label: "bekor qilindi" }], errors: ["reminders", "due", "sla", "slaCancel"] },
  { key: "jobs", title: "Muddati o'tgan e'lonlar", desc: "Ochiq e'lonlar muddati tugagach yopiladi, egasiga xabar ketadi.", counts: [{ path: "jobsClosed", label: "yopildi" }], errors: ["jobs"] },
  { key: "vacancies", title: "Vakansiyalar", desc: "Muddati 3 kun ichida tugaydiganlarga eslatma; saqlangan qidiruvlarga yangi mos vakansiyalar.", counts: [{ path: "vacanciesReminded", label: "eslatma" }, { path: "vacancyAlerts.notified", label: "ogohlantirish" }], errors: ["vacancies", "vacancyAlerts"] },
  { key: "scheduled", title: "Rejalashtirilgan postlar", desc: "Vaqti kelgan postlar joylanadi.", counts: [{ path: "scheduledPublished", label: "joylandi" }, { path: "scheduledFailed", label: "xato" }], errors: ["scheduled"] },
  { key: "cleanup", title: "Vaqtinchalik ma'lumotni tozalash", desc: "Ko'rishlar jurnali (30 kun), ko'rish tarixi (90 kun), eskirgan push obunalari, muddati o'tgan DM va story'lar, tuzoq jurnali.", counts: [{ path: "viewsPurged", label: "ko'rish" }, { path: "historyPurged", label: "tarix" }, { path: "pushPurged", label: "push" }, { path: "dmsExpired", label: "DM" }, { path: "storiesPurged", label: "story" }], errors: ["views", "history", "push", "dmTtl", "stories", "honeypot"] },
  { key: "challenges", title: "Konkurslar", desc: "Muddati tugagan konkurslarga g'olib aniqlanadi.", counts: [{ path: "challengesClosed", label: "yakunlandi" }], errors: ["konkurs"] },
  { key: "top", title: "Oylik TOP", desc: "Oyning oxirgi kunida g'oliblar e'lon qilinadi (boshqa kunlarda bo'sh).", counts: [{ path: "monthlyTop.month", label: "oy" }], errors: ["monthlyTop"] },
  { key: "digests", title: "Jamlama xabarnomalar", desc: "Kunlik/haftalik jamlama: obunachi, reaksiya, izoh, ko'rish — yangilik bo'lsa yuboriladi.", counts: [{ path: "digests.sent", label: "yuborildi" }, { path: "digests.skipped", label: "o'tkazildi" }], errors: ["digests", "digest"] },
  { key: "indexnow", title: "IndexNow", desc: "So'nggi sutkada o'zgargan sahifalar Yandex/Bing'ga bildiriladi.", counts: [{ path: "indexNow.sent", label: "manzil" }], errors: ["indexnow"] },
  { key: "adminReport", title: "Admin kunlik hisoboti", desc: "Kechagi kun statistikasi adminlarning Telegramiga (bir kunda bir marta).", counts: [{ path: "adminReport.sent", label: "yuborildi" }], errors: ["adminReport"] },
  { key: "savedSearches", title: "Saqlangan qidiruvlar", desc: "Yangi mos mutaxassislar haqida ogohlantirish.", counts: [{ path: "savedSearches.notified", label: "ogohlantirish" }], errors: ["savedSearches"] },
  { key: "subscriptions", title: "Obuna eslatmalari", desc: "3 kun / 1 kun qolganda va tugaganda eslatma; eskirgan obuna hisoblari bekor qilinadi.", counts: [{ path: "subscriptions.sent.d3", label: "3 kun qoldi" }, { path: "subscriptions.sent.d1", label: "1 kun qoldi" }, { path: "subscriptions.sent.expired", label: "tugadi" }, { path: "subscriptions.expiredInvoices", label: "hisob bekor" }], errors: ["subscriptions"] },
  { key: "housekeeping", title: "Xizmat jadvallari", desc: "Eskirgan rate-limit qatorlari, 180 kundan eski oddiy audit yozuvlari, yopilgan sessiyalar va eski xato yozuvlari o'chiriladi.", counts: [{ path: "rateLimitsDeleted", label: "limit" }, { path: "auditDeleted", label: "audit" }, { path: "sessionsDeleted", label: "sessiya" }, { path: "errorLogsPurged", label: "xato yozuvi" }], errors: ["rateLimits", "audit", "sessions", "errorLogs"] },
];

export interface CronRun {
  at: number;
  /** Davomiyligi (ms) — eski yozuvlarda yo'q */
  ms: number | null;
  errors: number;
  /** Kim ishga tushirgan: jadval yoki admin (qo'lda) */
  source: "schedule" | "admin";
}

export interface CronStatus {
  /** Productionda CRON_SECRET bormi (bo'lmasa cron butunlay o'chiq) */
  configured: boolean;
  production: boolean;
  lastRun: CronRun | null;
  /** 36 soatdan ko'p ishlamagan (yoki umuman ishlamagan) */
  stale: boolean;
  runs: CronRun[];
  steps: Array<{ key: string; title: string; desc: string; values: Array<{ label: string; value: string }>; errors: string[] }>;
  /** Hech bir qadamga tegishli deb topilmagan xatolar */
  otherErrors: string[];
}

const STALE_MS = 36 * 60 * 60 * 1000;

function pick(meta: Record<string, unknown>, path: string): unknown {
  let cur: unknown = meta;
  for (const k of path.split(".")) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function toRun(row: { createdAt: Date; meta: Record<string, unknown> | null }): CronRun {
  const meta = row.meta ?? {};
  return {
    at: row.createdAt.getTime(),
    ms: typeof meta.ms === "number" && Number.isFinite(meta.ms) ? Math.round(meta.ms) : null,
    errors: Array.isArray(meta.errors) ? meta.errors.length : 0,
    source: meta.source === "admin" ? "admin" : "schedule",
  };
}

export async function cronStatus(now = Date.now()): Promise<CronStatus> {
  const rows = await db.query.auditLogs.findMany({ where: eq(auditLogs.action, "cron_daily"), orderBy: [desc(auditLogs.createdAt)], limit: 10, columns: { createdAt: true, meta: true } });
  const last = rows[0];
  const meta = last?.meta ?? {};
  // Xato matni server ichki xabari — admin ko'radi, lekin baribir tozalanadi (email/telefon/token yo'q)
  const errors = (Array.isArray(meta.errors) ? meta.errors : []).filter((e): e is string => typeof e === "string").map((e) => cleanMessage(e, 240));
  const claimed = new Set<number>();

  const steps = CRON_STEPS.map((s) => {
    const own: string[] = [];
    errors.forEach((e, i) => {
      if (s.errors.some((p) => e.startsWith(`${p}:`) || e.startsWith(`${p} `))) {
        own.push(e);
        claimed.add(i);
      }
    });
    const values = last
      ? s.counts
          .map((c) => ({ label: c.label, raw: pick(meta, c.path) }))
          .filter((v) => typeof v.raw === "number" || typeof v.raw === "string")
          .map((v) => ({ label: v.label, value: String(v.raw) }))
      : [];
    return { key: s.key, title: s.title, desc: s.desc, values, errors: own };
  });

  const prod = process.env.NODE_ENV === "production";
  return {
    configured: Boolean(process.env.CRON_SECRET?.trim()) || !prod,
    production: prod,
    lastRun: last ? toRun(last) : null,
    stale: last ? now - last.createdAt.getTime() > STALE_MS : true,
    runs: rows.map(toRun),
    steps,
    otherErrors: errors.filter((_, i) => !claimed.has(i)),
  };
}

/* ------------------------------------------------------------------ */
/* Qo'lda ishga tushirish                                               */
/* ------------------------------------------------------------------ */
export class CronRunError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Bitta server nusxasida bir vaqtda bitta qo'lda ishga tushirish (ikki marta bosishdan himoya) */
const g = globalThis as { __keCronRunning?: boolean };

export interface CronRunResult {
  ok: boolean;
  dry: boolean;
  ms: number;
  /** Cron javobidagi sanoqlar (errors alohida) */
  counts: Record<string, unknown>;
  errors: string[];
}

/**
 * Kunlik cron'ni server ICHIDAN chaqiradi — aynan jadval ishlatadigan kod yo'li (`GET /api/cron/daily`), tarmoq so'rovisiz.
 * Ruxsat: serverning o'z CRON_SECRET'i (klientga hech qachon chiqmaydi); dev'da sir bo'lmasa `x-vercel-cron` belgisi.
 * `dry` — hech narsa o'zgartirmaydi, faqat eslatma/obuna qadamlari nechta yozuvga tegishini qaytaradi.
 */
export async function runDailyCron(opts: { dry?: boolean } = {}): Promise<CronRunResult> {
  const secret = process.env.CRON_SECRET?.trim();
  const headers = new Headers({ "x-cron-source": "admin" });
  if (secret) headers.set("authorization", `Bearer ${secret}`);
  else if (process.env.NODE_ENV !== "production") headers.set("x-vercel-cron", "1");
  else throw new CronRunError(503, "CRON_SECRET sozlanmagan — productionda kunlik cron o'chiq. Hostingda CRON_SECRET qo'ying");

  if (g.__keCronRunning) throw new CronRunError(409, "Cron hozir ishlayapti — tugashini kuting");
  g.__keCronRunning = true;
  const t0 = Date.now();
  try {
    const { GET } = await import("@/app/api/cron/daily/route");
    const res = await GET(new Request(`http://internal.invalid/api/cron/daily${opts.dry ? "?dry=1" : ""}`, { headers }));
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (res.status === 401 || !body) throw new CronRunError(502, "Cron ishga tushmadi — ruxsat yoki javob xatosi");
    const { errors, ok: _ok, ts: _ts, dry: _dry, ...counts } = body;
    void _ok;
    void _ts;
    void _dry;
    const errs = (Array.isArray(errors) ? errors : []).filter((e): e is string => typeof e === "string").map((e) => cleanMessage(e, 240));
    return { ok: errs.length === 0, dry: Boolean(opts.dry), ms: Date.now() - t0, counts, errors: errs };
  } finally {
    g.__keCronRunning = false;
  }
}

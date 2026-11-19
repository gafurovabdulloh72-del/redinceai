import { timingSafeEqual } from "node:crypto";
import { runVacancyImport } from "@/lib/vacancies/import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ochiq Telegram kanallaridan vakansiya importi (lib/vacancies/import.ts). Har 15 daqiqada:
 * GitHub Actions `.github/workflows/vacancy-import.yml` (yoki istalgan tashqi cron) `Authorization: Bearer <CRON_SECRET>` bilan chaqiradi.
 * Har kanal ~12 daqiqada bir martadan ko'p o'qilmaydi (tez-tez chaqirilsa ham t.me'ga ortiqcha so'rov ketmaydi).
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const m = /^Bearer\s+(.+)$/i.exec((req.headers.get("authorization") ?? "").trim());
  if (!secret) return process.env.NODE_ENV !== "production" && Boolean(req.headers.get("x-vercel-cron"));
  if (!m) return false;
  const a = Buffer.from(m[1].trim());
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!authorized(req)) return Response.json({ ok: false, error: "Ruxsat yo'q" }, { status: 401, headers });
  const result = await runVacancyImport({ budgetMs: 50_000 });
  return Response.json({ ok: true, data: result }, { headers });
}

export const GET = run;
export const POST = run;

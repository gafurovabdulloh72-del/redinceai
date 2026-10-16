import { handler, ok, requireSession, ApiError } from "@/lib/api";
import { isR2Enabled, r2Config, r2Put, r2PublicUrl } from "@/lib/storage/r2";
import { audit } from "@/lib/security/audit";

/**
 * Admin: R2 saqlash holati va o'z-o'zini sinash.
 * GET — env to'liqligi (qaysi qiymat yetishmayotgani nomma-nom); POST — test fayl yuklab,
 * ommaviy manzildan o'qib ko'radi (butun zanjir: kalitlar → bucket → public URL).
 */

const R2_ENV_KEYS = ["R2_ENDPOINT", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_BASE"] as const;
/** Sinov fayli kaliti — har safar ustiga yoziladi, saqlashni iflos qilmaydi */
const TEST_KEY = "diagnostika/selftest.txt";

function status() {
  const missing = R2_ENV_KEYS.filter((k) => !process.env[k]?.trim());
  const cfg = r2Config();
  return {
    enabled: isR2Enabled(),
    missing,
    bucket: cfg?.bucket ?? null,
    endpointHost: cfg ? new URL(cfg.endpoint).host : null,
    publicBase: cfg?.publicBase ?? null,
  };
}

export const GET = handler(async () => {
  await requireSession(["admin"]);
  return ok(status());
});

/** O'z-o'zini sinash: yuklash (S3 PUT) + ommaviy o'qish (R2_PUBLIC_BASE orqali) */
export const POST = handler(async (req) => {
  const session = await requireSession(["admin"]);
  if (!isR2Enabled()) {
    const { missing } = status();
    throw new ApiError(503, `R2 sozlanmagan — Vercel'da yetishmayotgan qiymatlar: ${missing.join(", ")}`);
  }
  const body = Buffer.from(`Kasb Egalari R2 diagnostika · ${new Date().toISOString()}`, "utf8");

  let uploadOk = false;
  let uploadError: string | null = null;
  try {
    await r2Put(TEST_KEY, body, "text/plain; charset=utf-8");
    uploadOk = true;
  } catch (e) {
    uploadError = e instanceof Error ? e.message : String(e);
  }

  // Ommaviy o'qish: Public Development URL / custom domen ulanganini tekshiradi
  let publicOk = false;
  let publicError: string | null = null;
  const publicUrl = r2PublicUrl(TEST_KEY);
  if (uploadOk) {
    try {
      const res = await fetch(publicUrl, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      publicOk = res.ok;
      if (!res.ok) publicError = `HTTP ${res.status} — bucket'da "Public Development URL" yoqilmagan yoki R2_PUBLIC_BASE noto'g'ri`;
    } catch (e) {
      publicError = e instanceof Error ? e.message : String(e);
    }
  }

  await audit(session.sub, "admin_settings", { meta: { action: "r2_selftest", uploadOk, publicOk } }, req);
  return ok({ ...status(), uploadOk, uploadError, publicOk, publicError, publicUrl });
});

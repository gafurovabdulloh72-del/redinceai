export const dynamic = "force-dynamic";

/**
 * Android ilovasi (TWA — Trusted Web Activity) uchun Digital Asset Links. Google Play ilovasi saytni shu fayl orqali
 * «o'zimniki» deb tasdiqlaydi va saytni brauzer panelisiz, to'liq ekranda ochadi. Fayl bo'lmasa ilova ishlaydi,
 * lekin tepada manzil paneli ko'rinadi.
 *
 * Env: `ANDROID_PACKAGE` (standart `uz.kasbegalari.app`), `ANDROID_CERT_SHA256` — imzo sertifikatining SHA-256 barmoq
 * izi(lari), vergul bilan (Play Console → Ilova yaxlitligi → «App signing key» va yuklash kaliti — ikkalasini ham).
 */
export function GET() {
  const pkg = (process.env.ANDROID_PACKAGE || "uz.kasbegalari.app").trim();
  const prints = (process.env.ANDROID_CERT_SHA256 || "")
    .split(/[,\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
  const body = prints.length
    ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: prints } }]
    : [];
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" } });
}

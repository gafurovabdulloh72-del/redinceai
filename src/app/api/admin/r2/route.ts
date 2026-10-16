import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { put, del } from "@vercel/blob";
import { handler, ok, requireSession, ApiError } from "@/lib/api";
import { isR2Enabled, r2Config, r2Put, r2PublicUrl } from "@/lib/storage/r2";
import { uploadDir } from "@/lib/uploads";
import { audit } from "@/lib/security/audit";
import { uid } from "@/lib/utils";

/**
 * Admin: fayl saqlash diagnostikasi.
 * GET — qaysi usul faol (R2 → Vercel Blob → disk; Vercel'da disk ishlamaydi) va env holati.
 * POST — FAOL usul orqali test fayl yuklab, o'qib ko'radi: saqlash chindan ishlayaptimi.
 */

const R2_ENV_KEYS = ["R2_ENDPOINT", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_BASE"] as const;
/** R2 sinov fayli — har safar ustiga yoziladi */
const R2_TEST_KEY = "diagnostika/selftest.txt";

type Backend = "r2" | "blob" | "disk" | "none";

function activeBackend(): Backend {
  if (isR2Enabled()) return "r2";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (process.env.VERCEL) return "none"; // Vercel'da disk read-only — saqlash YO'Q
  return "disk";
}

function status() {
  const cfg = r2Config();
  return {
    backend: activeBackend(),
    onVercel: Boolean(process.env.VERCEL),
    blobTokenSet: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    r2Missing: R2_ENV_KEYS.filter((k) => !process.env[k]?.trim()),
    bucket: cfg?.bucket ?? null,
    endpointHost: cfg ? new URL(cfg.endpoint).host : null,
    publicBase: cfg?.publicBase ?? null,
  };
}

export const GET = handler(async () => {
  await requireSession(["admin"]);
  return ok(status());
});

/** O'z-o'zini sinash: faol usul orqali yuklash + o'qish */
export const POST = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const backend = activeBackend();
  if (backend === "none") {
    throw new ApiError(503, "Saqlash sozlanmagan: Vercel'da disk ishlamaydi. Eng oson yo'l — Vercel → Storage → Create → Blob → loyihaga ulang → Redeploy (hech narsa nusxalash shart emas). Arzon muqobil — quyidagi R2.");
  }
  const body = Buffer.from(`Kasb Egalari saqlash diagnostikasi · ${new Date().toISOString()}`, "utf8");

  let uploadOk = false;
  let uploadError: string | null = null;
  let publicOk = false;
  let publicError: string | null = null;
  let publicUrl = "";

  try {
    if (backend === "r2") {
      await r2Put(R2_TEST_KEY, body, "text/plain; charset=utf-8");
      uploadOk = true;
      publicUrl = r2PublicUrl(R2_TEST_KEY);
      const res = await fetch(publicUrl, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      publicOk = res.ok;
      if (!res.ok) publicError = `HTTP ${res.status} — bucket'da "Public Development URL" yoqilmagan yoki R2_PUBLIC_BASE noto'g'ri`;
    } else if (backend === "blob") {
      const name = `diagnostika/selftest-${uid()}.txt`;
      const blob = await put(name, body, { access: "public", contentType: "text/plain", addRandomSuffix: false });
      uploadOk = true;
      publicUrl = blob.url;
      const res = await fetch(blob.url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      publicOk = res.ok;
      if (!res.ok) publicError = `HTTP ${res.status}`;
      await del(blob.url).catch(() => undefined); // sinov faylini tozalash
    } else {
      // disk (faqat dev/VPS): yozish + qayta o'qish
      const dir = uploadDir();
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, "selftest.txt");
      await writeFile(file, body);
      uploadOk = true;
      publicOk = (await readFile(file)).equals(body);
      publicUrl = "/uploads/selftest.txt";
      if (!publicOk) publicError = "Yozilgan fayl qayta o'qilmadi";
    }
  } catch (e) {
    let msg = e instanceof Error ? e.message : String(e);
    // Blob store Private qilib yaratilgan — access rejimini keyin o'zgartirib BO'LMAYDI, yangi store kerak
    if (/private store|public access/i.test(msg)) {
      msg =
        "Blob store PRIVATE rejimda yaratilgan — buni keyin o'zgartirib bo'lmaydi. Yangi store oching: Vercel → Storage → Create → Blob → Access: PUBLIC ni tanlang → loyihaga Connect qiling; eski store'ni Projects bo'limida Disconnect qilib, redeploy qiling.";
    }
    if (!uploadOk) uploadError = msg;
    else publicError = msg;
  }

  await audit(session.sub, "admin_settings", { meta: { action: "storage_selftest", backend, uploadOk, publicOk } }, req);
  return ok({ ...status(), uploadOk, uploadError, publicOk, publicError, publicUrl });
});

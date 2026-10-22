import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 (S3-mos) saqlash qatlami — o'z VPS'da fayllarni saqlash uchun.
 *
 * Env (barchasi to'liq bo'lsa R2 yoqiladi, aks holda hozirgi oqim o'zgarmaydi):
 *  - R2_ENDPOINT          https://<account-id>.r2.cloudflarestorage.com (S3 API, yuklash uchun)
 *  - R2_BUCKET            masalan kasbegalari-media
 *  - R2_ACCESS_KEY_ID     R2 API token (Object Read & Write)
 *  - R2_SECRET_ACCESS_KEY
 *  - R2_PUBLIC_BASE       ommaviy o'qish bazasi: https://media.kasbegalari.uz yoki
 *                         https://pub-xxxx.r2.dev (bucket'ning public domeni)
 *
 * Saqlash tanlovi (ustuvorlik) /api/upload va /api/upload/presign'da:
 *  R2 (isR2Enabled) → Vercel Blob (BLOB_READ_WRITE_TOKEN) → lokal disk (UPLOAD_DIR / public/uploads).
 * Diqqat: bu modul faqat server/skript muhitida ishlatiladi (klient bundle'iga kirmasin).
 */

export interface R2Config {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Oxiridagi "/" belgilarisiz saqlanadi */
  publicBase: string;
}

/** Barcha R2 env'lari to'liq bo'lsa konfiguratsiya, aks holda null */
export function r2Config(): R2Config | null {
  const endpoint = process.env.R2_ENDPOINT?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const publicBase = process.env.R2_PUBLIC_BASE?.trim().replace(/\/+$/, "");
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBase) return null;
  if (!endpoint.startsWith("https://") || !publicBase.startsWith("https://")) return null;
  return { endpoint, bucket, accessKeyId, secretAccessKey, publicBase };
}

export function isR2Enabled(): boolean {
  return r2Config() !== null;
}

// Dev HMR'da klient nusxalari ko'payib ketmasligi uchun globalda saqlaymiz (db/index.ts naqshi)
const globalForR2 = globalThis as unknown as { __redinceR2?: S3Client };

/** S3-mos klient (lazy singleton). Chaqirishdan oldin isR2Enabled() tekshirilgan bo'lishi kerak. */
export function getR2Client(): S3Client {
  const cfg = r2Config();
  if (!cfg) throw new Error("R2 sozlanmagan — R2_ENDPOINT/R2_BUCKET/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_PUBLIC_BASE env'larini to'ldiring");
  if (!globalForR2.__redinceR2) {
    globalForR2.__redinceR2 = new S3Client({
      region: "auto",
      endpoint: cfg.endpoint,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      // R2 virtual-host uslubini ham qo'llaydi, lekin custom endpoint bilan path-style ishonchliroq
      forcePathStyle: true,
      // AWS SDK v3.729+ standart CRC32 checksum qo'shadi — R2 buni presigned PUT'da buzadi
      // (x-amz-checksum-crc32 bo'sh tana uchun imzolanib, haqiqiy yuklash rad etiladi). R2 tavsiyasi:
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return globalForR2.__redinceR2;
}

/** Kalitning ommaviy o'qish URL'i: R2_PUBLIC_BASE + / + kalit */
export function r2PublicUrl(key: string): string {
  const cfg = r2Config();
  if (!cfg) throw new Error("R2 sozlanmagan");
  return `${cfg.publicBase}/${key.replace(/^\/+/, "")}`;
}

/** Obyekt mavjudmi (migratsiya idempotentligi uchun) */
export async function r2Has(key: string): Promise<boolean> {
  const cfg = r2Config();
  if (!cfg) return false;
  try {
    await getR2Client().send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Faylni server tomondan yuklash (≤ 5 MB rasm/hujjat oqimi) — ommaviy URL qaytaradi */
export async function r2Put(key: string, body: Buffer | Uint8Array, contentType: string): Promise<string> {
  const cfg = r2Config();
  if (!cfg) throw new Error("R2 sozlanmagan");
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      // Fayllar o'zgarmas (nom — UUID): brauzer/CDN uzoq keshlashi mumkin
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return r2PublicUrl(key);
}

/**
 * Brauzerdan to'g'ridan-to'g'ri yuklash uchun presigned PUT URL (video oqimi, ≤ 600 MB — MAX_VIDEO_BYTES).
 * ContentType va ContentLength imzoga kiradi — klient boshqa tur/hajm yuborsa R2 so'rovni rad etadi,
 * ya'ni server bergan limitlarni chetlab o'tib bo'lmaydi.
 */
export async function r2PresignPut(key: string, contentType: string, contentLength: number, expiresInSeconds = 600): Promise<string> {
  const cfg = r2Config();
  if (!cfg) throw new Error("R2 sozlanmagan");
  const cmd = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
    CacheControl: "public, max-age=31536000, immutable",
  });
  return getSignedUrl(getR2Client(), cmd, {
    expiresIn: expiresInSeconds,
    // Presigner content-type'ni sukut bo'yicha imzodan chiqaradi — MIME cheklovi ishlashi uchun majburan imzolaymiz
    signableHeaders: new Set(["content-type", "content-length"]),
  });
}

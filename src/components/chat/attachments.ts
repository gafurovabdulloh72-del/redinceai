import { showToast } from "@/components/ui/toast";
import type { FileAttachment } from "@/lib/db/schema";

/**
 * Biriktirmalar (buyurtma, chat xabari, sharh rasmlari) — klient va server uchun umumiy sof yordamchilar.
 * Fayllar faqat /api/upload orqali yuklanadi (rasm: JPG/PNG/WEBP/GIF; buyurtma/chat'da hujjat: PDF/DOC/DOCX/ZIP — 5 MB gacha):
 *  - disk:  /uploads/<uuid>.<ext>
 *  - Vercel Blob: https://<store>.public.blob.vercel-storage.com/uploads/<uuid>.<ext>
 *  - Cloudflare R2: <R2_PUBLIC_BASE>/uploads/<uuid>.<ext> (server R2_* env'lari to'liq bo'lsa)
 * Boshqa tashqi havolalar biriktirma sifatida qabul qilinmaydi (kuzatuv pikseli / fishing havolasi bo'lmasin).
 */
export type Attachment = FileAttachment;

/** Buyurtma formasida va bitta chat xabarida */
export const MAX_ATTACHMENTS = 5;
/** Buyurtmaga jami (keyin qo'shilganlari bilan) */
export const MAX_ORDER_ATTACHMENTS = 15;
/** Sharh rasmlari */
export const MAX_REVIEW_MEDIA = 4;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/**
 * Video chegarasi. R2 (presigned PUT, brauzer → R2 to'g'ridan-to'g'ri, server orqali o'tmaydi) — 200 MB gacha.
 * Zaxira yo'llar (Vercel Blob client-upload, server diski) — 50 MB: Blob'da katta fayl qotib qolardi.
 */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const MAX_VIDEO_BYTES_FALLBACK = 50 * 1024 * 1024;
const mbOf = (n: number) => Math.round(n / (1024 * 1024));
export const UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
/** Buyurtma/chat biriktirmalari: rasmlar + hujjatlar (PDF, DOC, DOCX, ZIP) + video (MP4, WebM, MOV) */
export const UPLOAD_ACCEPT_DOCS = `${UPLOAD_ACCEPT},application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,application/x-zip-compressed,video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.zip,.mp4,.webm,.mov`;

/**
 * R2 ommaviy bazasi — faqat server muhitida mavjud (klient bundle'ida process.env bo'sh shim).
 * Bu regexlar serverdagi zod tekshiruvlarida ishlatiladi, shuning uchun klientda R2 bo'lagi yo'qligi zarar qilmaydi.
 */
const R2_BASE = (typeof process !== "undefined" && process.env?.R2_PUBLIC_BASE ? process.env.R2_PUBLIC_BASE : "").trim().replace(/\/+$/, "");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Ruxsatli yuklama URL naqshi: /uploads/<nom> | Vercel Blob | (bo'lsa) R2_PUBLIC_BASE/uploads/<nom> */
function uploadUrlRe(exts: string): RegExp {
  const alts = [`\\/uploads\\/[\\w-]+\\.(?:${exts})`, `https:\\/\\/[a-z0-9-]+\\.public\\.blob\\.vercel-storage\\.com\\/uploads\\/[\\w-]+\\.(?:${exts})`];
  if (R2_BASE.startsWith("https://")) alts.push(`${escapeRe(R2_BASE)}\\/uploads\\/[\\w-]+\\.(?:${exts})`);
  return new RegExp(`^(?:${alts.join("|")})$`, "i");
}

export const UPLOAD_URL_RE = uploadUrlRe("jpe?g|png|webp|gif|pdf|docx?|zip|mp4|webm|mov|weba|m4a|ogg");
/** Faqat rasm (sharh rasmlari, avatar) — hujjat URL o'tmaydi */
export const IMAGE_URL_RE = uploadUrlRe("jpe?g|png|webp|gif");

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  zip: "application/zip",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  weba: "audio/webm",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
};

/** Ovozli xabar: ko'pi bilan 3 daqiqa; MediaRecorder formatlari (brauzer qaysi birini qo'llasa) */
export const VOICE_MAX_SECONDS = 180;
export const VOICE_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** URL kengaytmasidan haqiqiy tur (mijoz bergan `type`ga ishonmaymiz) */
export function mimeFromUrl(url: string): string | null {
  const m = /\.([a-z0-9]+)$/i.exec(url);
  return m ? (EXT_MIME[m[1].toLowerCase()] ?? null) : null;
}

/** Fayl nomi URL'dan: /uploads/<nom> — upload audit yozuvidagi targetId bilan bir xil */
export function uploadName(url: string): string {
  return url.slice(url.lastIndexOf("/") + 1);
}

export function isImageAttachment(a: Pick<Attachment, "url" | "type">): boolean {
  return a.type.startsWith("image/") || /\.(?:jpe?g|png|webp|gif)$/i.test(a.url);
}

export function isVideoAttachment(a: Pick<Attachment, "url" | "type">): boolean {
  return a.type.startsWith("video/") || /\.(?:mp4|webm|mov)$/i.test(a.url);
}

/** Ovozli xabar (audio) — .weba (WebM/Opus), .m4a (Safari), .ogg */
export function isAudioAttachment(a: Pick<Attachment, "url" | "type">): boolean {
  return a.type.startsWith("audio/") || /\.(?:weba|m4a|ogg)$/i.test(a.url);
}

/** Fayl kengaytmasi (yorliq uchun): "PDF", "ZIP", "DOCX"… */
export function attachmentExt(a: Pick<Attachment, "url" | "name">): string {
  const m = /\.([a-z0-9]{2,5})$/i.exec(a.name) ?? /\.([a-z0-9]{2,5})$/i.exec(a.url);
  return m ? m[1].toUpperCase() : "FAYL";
}

export function formatDuration(sec: number | undefined): string {
  const s = Math.max(0, Math.round(sec ?? 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
}

type UploadResponse = { ok: true; data: { url: string } } | { ok: false; error: string };

const VIDEO_EXT_RE = /\.(mp4|webm|mov)$/i;
const VIDEO_MIME: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };

/** Yuklash parametrlari: jarayon (0..1) va bekor qilish signali */
export interface UploadProgressOpts {
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
}

/** Bekor qilingan yuklash — chaqiruvchi ajrata oladi (`e.name === "AbortError"`) */
function abortError(): Error {
  const e = new Error("Yuklash bekor qilindi");
  e.name = "AbortError";
  return e;
}

/** 429 javobidagi Retry-After'ni foydalanuvchiga tushunarli qilib qo'shadi */
export function withRetryAfter(message: string, retryAfter: string | null): string {
  const s = Number(retryAfter);
  if (!Number.isFinite(s) || s <= 0) return message;
  return s < 60 ? `${message} (${Math.ceil(s)} soniyadan keyin)` : `${message} (${Math.ceil(s / 60)} daqiqadan keyin)`;
}

/**
 * Oddiy (multipart) yuklash — rasm/hujjat va dev'dagi video fallback.
 * XHR orqali: yuklash jarayoni (onProgress) va bekor qilish (signal) uchun — fetch'da upload progress yo'q.
 */
function uploadViaApi(file: File, purpose: "" | "attachment" | "voice", p: UploadProgressOpts = {}, endpoint = "/api/upload"): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (p.signal?.aborted) return reject(abortError());
    const fd = new FormData();
    fd.append("file", file);
    if (purpose) fd.append("purpose", purpose);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.responseType = "json";
    // Qotib qolishdan himoya: 60 soniya davomida umuman siljish bo'lmasa — uzamiz (0% da cheksiz turib qolmaslik uchun)
    let stalled = false;
    let lastTick = Date.now();
    const STALL_MS = 60_000;
    const watch = window.setInterval(() => {
      if (Date.now() - lastTick > STALL_MS) {
        stalled = true;
        xhr.abort();
      }
    }, 5_000);
    const cleanup = () => {
      window.clearInterval(watch);
      p.signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => xhr.abort();
    p.signal?.addEventListener("abort", onAbort, { once: true });
    xhr.upload.onprogress = (e) => {
      lastTick = Date.now();
      if (e.lengthComputable) p.onProgress?.(Math.min(1, e.loaded / e.total));
    };
    xhr.onload = () => {
      cleanup();
      const json = (xhr.response ?? null) as UploadResponse | null;
      if (!json) return reject(new Error("Server javob bermadi"));
      if (!json.ok) return reject(new Error(xhr.status === 429 ? withRetryAfter(json.error, xhr.getResponseHeader("Retry-After")) : json.error));
      p.onProgress?.(1);
      resolve(json.data.url);
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error("Tarmoq xatosi — internetni tekshirib, qayta urinib ko'ring"));
    };
    xhr.onabort = () => {
      cleanup();
      reject(stalled ? new Error("Yuklash to'xtab qoldi — internetni tekshirib, qayta urinib ko'ring") : abortError());
    };
    xhr.send(fd);
  });
}

type PresignResponse = { ok: true; data: { mode: "r2"; uploadUrl: string; publicUrl: string; contentType: string } | { mode: "fallback"; blob?: boolean } } | { ok: false; error: string };

/**
 * Video: avval R2 presigned PUT (server R2 sozlagan bo'lsa — /api/upload/presign), aks holda
 * brauzerdan to'g'ridan-to'g'ri Vercel Blob'ga (server tanasi 4.5 MB bilan cheklangani uchun).
 * Ikkalasi ham sozlanmagan muhitda (dev) oddiy /api/upload orqali yuklanadi.
 */
async function uploadVideo(file: File, p: UploadProgressOpts = {}): Promise<string> {
  const ext = (VIDEO_EXT_RE.exec(file.name)?.[1] ?? (file.type === "video/webm" ? "webm" : file.type === "video/quicktime" ? "mov" : "mp4")).toLowerCase();

  // Hajmni BARCHA yo'ldan (R2/Blob/disk) oldin tekshiramiz — katta fayl 60 s qotib turmasin, darhol aniq xabar
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(`«${file.name}» — ${mbOf(file.size)} MB, chegara ${mbOf(MAX_VIDEO_BYTES)} MB. Videoni biroz siqib (masalan 1080p, H.264) qayta yuboring.`);
  }

  // 1) Cloudflare R2: server qisqa muddatli presigned PUT URL beradi (nom serverda yaratiladi).
  //    Endpoint ishlamasa (eski server, tarmoq) — null, eski oqimga o'tamiz; aniq xato (kvota, sessiya) foydalanuvchiga.
  const presign = (await fetch("/api/upload/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ext, size: file.size }),
    signal: p.signal,
  })
    .then((r) => r.json())
    .catch(() => null)) as PresignResponse | null;
  if (p.signal?.aborted) throw abortError();
  if (presign && !presign.ok) throw new Error(presign.error);
  if (presign?.ok && presign.data.mode === "r2") {
    const { uploadUrl, publicUrl, contentType } = presign.data;
    const put = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": contentType }, body: file, signal: p.signal }).catch(() => null);
    if (p.signal?.aborted) throw abortError();
    if (!put?.ok) throw new Error(`«${file.name}»: video saqlashga yuklanmadi — internetni tekshirib, qayta urinib ko'ring`);
    p.onProgress?.(1);
    return publicUrl;
  }

  // R2 yo'q — zaxira yo'llar (Blob/disk) faqat 50 MB gacha
  if (file.size > MAX_VIDEO_BYTES_FALLBACK) {
    throw new Error(`«${file.name}» — ${mbOf(file.size)} MB. Hozir ${mbOf(MAX_VIDEO_BYTES_FALLBACK)} MB gacha video yuklanadi (katta fayl saqlash R2 ulanganda ishlaydi). Videoni siqib qayta yuboring.`);
  }

  // 1.5) R2 ham, Blob ham yo'q (dev yoki o'z serveri/VPS) — to'g'ridan-to'g'ri server diskiga (Blob urinib 500 bermaydi)
  if (presign?.ok && presign.data.mode === "fallback" && presign.data.blob === false) {
    return uploadViaApi(file, "", p, "/api/upload/video");
  }

  // 2) Vercel Blob client upload (R2 yo'q, lekin Blob bor — yoki presign aniqlab bermadi)
  // Qotib qolishdan himoya: 60 soniya umuman siljish bo'lmasa (token olinmasa yoki PUT to'xtasa) — uzamiz,
  // 0% da cheksiz turib qolmaslik uchun. Ichki AbortController tashqi p.signal bilan birlashtiriladi.
  const ac = new AbortController();
  let stalled = false;
  let lastTick = Date.now();
  // Sekin tarmoq (UZ→Blob) + token olish fazasi uchun 90 s: shu vaqt umuman siljish bo'lmasa uzamiz
  const STALL_MS = 90_000;
  const watch = typeof window !== "undefined" ? window.setInterval(() => {
    if (Date.now() - lastTick > STALL_MS) {
      stalled = true;
      ac.abort();
    }
  }, 5_000) : 0;
  const onExtAbort = () => ac.abort();
  p.signal?.addEventListener("abort", onExtAbort, { once: true });
  try {
    const { upload } = await import("@vercel/blob/client");
    const blob = await upload(`uploads/${crypto.randomUUID()}.${ext}`, file, {
      access: "public",
      handleUploadUrl: "/api/upload/video",
      contentType: VIDEO_MIME[ext],
      onUploadProgress: (ev) => {
        lastTick = Date.now();
        p.onProgress?.(Math.min(1, ev.percentage / 100));
      },
      abortSignal: ac.signal,
    });
    return blob.url;
  } catch (e) {
    if (stalled) throw new Error(`«${file.name}»: video yuklash to'xtab qoldi — internetni tekshirib, qayta urinib ko'ring`);
    if (p.signal?.aborted || (e instanceof Error && e.name === "AbortError")) throw abortError();
    // Blob/R2 yo'q muhit (dev yoki o'z serveri/VPS) — video to'g'ridan-to'g'ri server diskiga (50 MB gacha).
    // Vercel'da disk yozilmaydi: u yerda Blob ulangan bo'lishi kerak (ulanmagan bo'lsa route aniq xato beradi).
    return uploadViaApi(file, "", p, "/api/upload/video");
  } finally {
    if (watch) window.clearInterval(watch);
    p.signal?.removeEventListener("abort", onExtAbort);
  }
}

/** Brauzerda: faylni yuklab, biriktirma obyektini qaytaradi (xato bo'lsa Error tashlaydi; bekor — name="AbortError") */
/** Videoning haqiqiy o'lchamini o'qiydi (metadata) — o'qib bo'lmasa null */
export function readVideoSize(file: File): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(null);
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    const done = (r: { w: number; h: number } | null) => {
      URL.revokeObjectURL(url);
      v.removeAttribute("src");
      resolve(r);
    };
    const timer = window.setTimeout(() => done(null), 4000);
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      window.clearTimeout(timer);
      done(v.videoWidth && v.videoHeight ? { w: v.videoWidth, h: v.videoHeight } : null);
    };
    v.onerror = () => {
      window.clearTimeout(timer);
      done(null);
    };
    v.src = url;
  });
}

/** HD (720p) dan past videoga: «xira ko'rinishi mumkin» ogohlantirishi. Qisqa tomon 720 dan kichik bo'lsa past hisoblanadi */
async function warnLowResolution(file: File): Promise<void> {
  const size = await readVideoSize(file);
  if (!size) return;
  if (Math.min(size.w, size.h) < 720) {
    showToast(`Video sifati past (${size.w}×${size.h}) — ekranda xira ko'rinishi mumkin. Kamida 1280×720 (HD) tavsiya etiladi.`, "info", { duration: 9000 });
  }
}

export async function uploadAttachment(file: File, opts?: { docs?: boolean; voice?: { duration: number } } & UploadProgressOpts): Promise<Attachment> {
  const p: UploadProgressOpts = { onProgress: opts?.onProgress, signal: opts?.signal };
  // Ovozli xabar: brauzer yozib bergan audio blob (purpose="voice" — server .weba/.m4a/.ogg nom beradi)
  if (opts?.voice) {
    if (!/^audio\//.test(file.type) && !/\.(?:weba|webm|m4a|mp4|ogg)$/i.test(file.name)) throw new Error("Ovozli xabar formati qo'llab-quvvatlanmaydi");
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("Ovozli xabar 5 MB dan katta — qisqaroq yozing");
    const url = await uploadViaApi(file, "voice", p);
    return { url, name: "Ovozli xabar", size: file.size, type: mimeFromUrl(url) ?? file.type, duration: Math.max(1, Math.round(opts.voice.duration)) };
  }
  const isImage = /^image\/(?:jpeg|png|webp|gif)$/.test(file.type);
  const isDoc = /\.(?:pdf|docx?|zip)$/i.test(file.name) || /^application\/(?:pdf|msword|zip|x-zip-compressed|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/.test(file.type);
  const isVideo = VIDEO_EXT_RE.test(file.name) || /^video\/(?:mp4|webm|quicktime)$/.test(file.type);
  if (!isImage && !(opts?.docs && (isDoc || isVideo))) {
    throw new Error(opts?.docs ? `«${file.name}»: faqat rasm (JPG, PNG, WEBP, GIF), hujjat (PDF, DOC, DOCX, ZIP) yoki video (MP4, WebM, MOV)` : `«${file.name}»: hozircha faqat JPG, PNG, WEBP yoki GIF rasm yuklanadi`);
  }
  if (opts?.docs && isVideo && !isImage) {
    if (file.size > MAX_VIDEO_BYTES) throw new Error(`«${file.name}» ${mbOf(MAX_VIDEO_BYTES)} MB dan katta`);
    // Past o'lchamli video ekranda (ayniqsa to'liq ekran/katta displeyda) xira ko'rinadi — yuklashdan oldin ogohlantiramiz (yuklash to'xtatilmaydi)
    void warnLowResolution(file);
    const url = await uploadVideo(file, p);
    return { url, name: file.name.slice(0, 120) || "video", size: file.size, type: mimeFromUrl(url) ?? file.type };
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`«${file.name}» 5 MB dan katta`);
  const url = await uploadViaApi(file, opts?.docs ? "attachment" : "", p);
  return { url, name: file.name.slice(0, 120) || "rasm", size: file.size, type: mimeFromUrl(url) ?? file.type };
}

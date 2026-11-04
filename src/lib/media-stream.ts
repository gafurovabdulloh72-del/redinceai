import "server-only";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { uploadDir } from "./uploads";

/**
 * Himoyalangan videoni server orqali oqimlash (4-audit): xom saqlash manzili (R2/Blob/uploads) mijozga chiqmaydi.
 *  - Lokal `/uploads/<nom>` → diskdan Range bilan (206) o'qiladi.
 *  - Tashqi https manzil (Vercel Blob, R2 public) → server `fetch` qiladi, Range sarlavhasini uzatadi va javob tanasini
 *    o'zgartirmasdan o'tkazadi (faqat video/audio MIME'lari, boshqa xost emas — manzil bazadan, foydalanuvchidan emas).
 * Javob keshsiz va `private` — CDN/brauzer uni ulashib bo'ladigan resurs sifatida saqlamaydi.
 */
const UPLOAD_NAME_RE = /^[\w-]+\.(mp4|webm|mov|weba|m4a|ogg|mp3)$/i;
/** 5-audit: yopiq fayllar (chat biriktirmasi, dars materiali, chek) — rasm va hujjatlar ham oqimlanadi */
const ANY_NAME_RE = /^[\w-]+\.(mp4|webm|mov|weba|m4a|ogg|mp3|jpe?g|png|webp|gif|pdf|docx?|zip)$/i;
const MIME: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  weba: "audio/webm",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  zip: "application/zip",
};
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Accept-Ranges": "bytes",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

function parseRange(h: string | null, size: number): { start: number; end: number } | null {
  if (!h) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(h.trim());
  if (!m) return null;
  let start = m[1] ? Number(m[1]) : NaN;
  let end = m[2] ? Number(m[2]) : size - 1;
  if (Number.isNaN(start)) {
    // "bytes=-500" — oxirgi 500 bayt
    const suffix = Number(m[2]);
    if (!suffix) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  }
  if (start >= size || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}

export interface StreamOpts {
  /** true — rasm/hujjat ham ruxsat (yopiq fayllar); standart — faqat video/audio (dars/efir) */
  any?: boolean;
  /** Ko'rsatiladigan fayl nomi (`Content-Disposition: inline; filename=…`) */
  name?: string;
}

/** `Content-Disposition` uchun xavfsiz nom: ASCII zaxira + RFC 5987 `filename*` (UTF-8) */
function disposition(name: string | undefined, fallbackExt: string): string {
  const raw = (name ?? "").replace(/[\u0000-\u001f"\\/]/g, "").trim().slice(0, 120);
  const ascii = raw.replace(/[^\x20-\x7e]/g, "_") || `fayl.${fallbackExt}`;
  return raw && raw !== ascii ? `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(raw)}` : `inline; filename="${ascii}"`;
}

/** Hujjat (PDF/DOC/ZIP) uchun CSP `sandbox` qo'yilmaydi — Chrome PDF ko'ruvchisi sandbox'da ochmaydi; `default-src 'none'` qoladi */
function headersFor(type: string, ext: string, opts: StreamOpts): Record<string, string> {
  const h: Record<string, string> = { ...PRIVATE_HEADERS, "Content-Type": type };
  if (type.startsWith("application/")) h["Content-Security-Policy"] = "default-src 'none'";
  if (opts.any) h["Content-Disposition"] = disposition(opts.name, ext);
  return h;
}

export async function streamProtectedMedia(sourceUrl: string, req: Request, opts: StreamOpts = {}): Promise<Response> {
  const method = req.method === "HEAD" ? "HEAD" : "GET";
  const nameRe = opts.any ? ANY_NAME_RE : UPLOAD_NAME_RE;
  // Lokal yuklama
  const local = /^\/uploads\/([^/?#]+)$/.exec(sourceUrl);
  if (local) {
    const name = local[1];
    if (!nameRe.test(name)) return new Response("Not found", { status: 404 });
    const file = path.join(uploadDir(), name);
    let s;
    try {
      s = await stat(file);
    } catch {
      return new Response("Not found", { status: 404 });
    }
    if (!s.isFile()) return new Response("Not found", { status: 404 });
    const ext = name.split(".").pop()!.toLowerCase();
    const type = MIME[ext] ?? "application/octet-stream";
    const base = headersFor(type, ext, opts);
    const range = parseRange(req.headers.get("range"), s.size);
    if (range) {
      const len = range.end - range.start + 1;
      return new Response(method === "HEAD" ? null : (Readable.toWeb(createReadStream(file, { start: range.start, end: range.end })) as ReadableStream), {
        status: 206,
        headers: { ...base, "Content-Length": String(len), "Content-Range": `bytes ${range.start}-${range.end}/${s.size}` },
      });
    }
    return new Response(method === "HEAD" ? null : (Readable.toWeb(createReadStream(file)) as ReadableStream), {
      status: 200,
      headers: { ...base, "Content-Length": String(s.size) },
    });
  }

  // Tashqi (Blob / R2 public) — faqat https; manzil bazadan keladi
  let u: URL;
  try {
    u = new URL(sourceUrl);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (u.protocol !== "https:") return new Response("Not found", { status: 404 });
  const fwd = new Headers();
  const range = req.headers.get("range");
  if (range) fwd.set("range", range);
  let up: Response;
  try {
    up = await fetch(u, { method, headers: fwd, redirect: "follow", signal: AbortSignal.timeout(30_000) });
  } catch {
    return new Response("Manba javob bermadi", { status: 502 });
  }
  if (!up.ok && up.status !== 206) return new Response("Not found", { status: up.status === 404 ? 404 : 502 });
  let type = up.headers.get("content-type") ?? "";
  const ext = (/\.([a-z0-9]+)$/i.exec(u.pathname)?.[1] ?? "").toLowerCase();
  if (opts.any) {
    // Yopiq fayl: turi URL kengaytmasidan (manzil bazada UPLOAD_URL_RE bilan tekshirilgan) — saqlash xizmati bergan
    // `octet-stream`/noto'g'ri turga ishonmaymiz; kengaytma noma'lum bo'lsa — 404
    const fromExt = MIME[ext];
    if (!fromExt) return new Response("Not found", { status: 404 });
    type = fromExt;
  } else if (!/^(video|audio)\//i.test(type)) return new Response("Not found", { status: 404 });
  const headers = new Headers(headersFor(type, ext, opts));
  for (const h of ["content-length", "content-range"]) {
    const v = up.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(method === "HEAD" ? null : up.body, { status: up.status, headers });
}

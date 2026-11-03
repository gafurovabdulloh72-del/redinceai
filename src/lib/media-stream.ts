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
const MIME: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", weba: "audio/webm", m4a: "audio/mp4", ogg: "audio/ogg", mp3: "audio/mpeg" };
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Accept-Ranges": "bytes",
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

export async function streamProtectedMedia(sourceUrl: string, req: Request): Promise<Response> {
  const method = req.method === "HEAD" ? "HEAD" : "GET";
  // Lokal yuklama
  const local = /^\/uploads\/([^/?#]+)$/.exec(sourceUrl);
  if (local) {
    const name = local[1];
    if (!UPLOAD_NAME_RE.test(name)) return new Response("Not found", { status: 404 });
    const file = path.join(uploadDir(), name);
    let s;
    try {
      s = await stat(file);
    } catch {
      return new Response("Not found", { status: 404 });
    }
    if (!s.isFile()) return new Response("Not found", { status: 404 });
    const type = MIME[name.split(".").pop()!.toLowerCase()] ?? "application/octet-stream";
    const range = parseRange(req.headers.get("range"), s.size);
    if (range) {
      const len = range.end - range.start + 1;
      return new Response(method === "HEAD" ? null : (Readable.toWeb(createReadStream(file, { start: range.start, end: range.end })) as ReadableStream), {
        status: 206,
        headers: { ...PRIVATE_HEADERS, "Content-Type": type, "Content-Length": String(len), "Content-Range": `bytes ${range.start}-${range.end}/${s.size}` },
      });
    }
    return new Response(method === "HEAD" ? null : (Readable.toWeb(createReadStream(file)) as ReadableStream), {
      status: 200,
      headers: { ...PRIVATE_HEADERS, "Content-Type": type, "Content-Length": String(s.size) },
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
  const type = up.headers.get("content-type") ?? "";
  if (!/^(video|audio)\//i.test(type)) return new Response("Not found", { status: 404 });
  const headers = new Headers(PRIVATE_HEADERS);
  headers.set("Content-Type", type);
  for (const h of ["content-length", "content-range"]) {
    const v = up.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(method === "HEAD" ? null : up.body, { status: up.status, headers });
}

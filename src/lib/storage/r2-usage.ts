import "server-only";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getR2Client, r2Config, r2PublicUrl } from "./r2";

/**
 * Admin uchun R2 hisobi: jami hajm, papkalar bo'yicha taqsimot va so'nggi yuklangan fayllar.
 * Bucket butunlay ro'yxatlanadi (ko'pi bilan `MAX_PAGES` × 1000 obyekt) — natija 5 daqiqa xotirada keshlanadi.
 * Cloudflare boshqaruv paneli havolasi endpoint'dagi akkaunt ID'dan quriladi (sir emas).
 */

export interface R2File {
  key: string;
  size: number;
  lastModified: number;
  url: string;
}
export interface R2Usage {
  totalBytes: number;
  count: number;
  byPrefix: Array<{ prefix: string; bytes: number; count: number }>;
  recent: R2File[];
  truncated: boolean;
  scannedAt: number;
  /** Cloudflare paneli: bucket fayllari */
  dashboardUrl: string | null;
  /** Ommaviy manzil r2.dev (sinov manzili — sekin, cheklangan) */
  devUrl: boolean;
  /** Cloudflare bepul tarifi — 10 GB */
  freeBytes: number;
}

const MAX_PAGES = 30;
const RECENT_LIMIT = 300;
const TTL_MS = 5 * 60_000;
let cache: { at: number; data: R2Usage } | null = null;

export function r2DashboardUrl(): string | null {
  const cfg = r2Config();
  if (!cfg) return null;
  const acct = /^([a-f0-9]{32})\./i.exec(new URL(cfg.endpoint).host)?.[1];
  return acct ? `https://dash.cloudflare.com/${acct}/r2/default/buckets/${encodeURIComponent(cfg.bucket)}` : "https://dash.cloudflare.com/?to=/:account/r2/overview";
}

export function r2IsDevUrl(): boolean {
  const cfg = r2Config();
  return Boolean(cfg && /\.r2\.dev$/i.test(new URL(cfg.publicBase).host));
}

export async function r2Usage(force = false): Promise<R2Usage | null> {
  const cfg = r2Config();
  if (!cfg) return null;
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const client = getR2Client();
  const prefixes = new Map<string, { bytes: number; count: number }>();
  let recent: R2File[] = [];
  let totalBytes = 0;
  let count = 0;
  let token: string | undefined;
  let pages = 0;
  do {
    const res = await client.send(new ListObjectsV2Command({ Bucket: cfg.bucket, ContinuationToken: token, MaxKeys: 1000 }));
    for (const o of res.Contents ?? []) {
      if (!o.Key) continue;
      const size = o.Size ?? 0;
      totalBytes += size;
      count += 1;
      const prefix = o.Key.includes("/") ? o.Key.slice(0, o.Key.indexOf("/")) : "(ildiz)";
      const p = prefixes.get(prefix) ?? { bytes: 0, count: 0 };
      p.bytes += size;
      p.count += 1;
      prefixes.set(prefix, p);
      recent.push({ key: o.Key, size, lastModified: o.LastModified?.getTime() ?? 0, url: r2PublicUrl(o.Key) });
    }
    // Xotirani cheklash: har sahifadan keyin eng yangilarini qoldiramiz
    if (recent.length > RECENT_LIMIT * 2) recent = recent.sort((a, b) => b.lastModified - a.lastModified).slice(0, RECENT_LIMIT);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
    pages += 1;
  } while (token && pages < MAX_PAGES);
  recent = recent.sort((a, b) => b.lastModified - a.lastModified).slice(0, RECENT_LIMIT);
  const data: R2Usage = {
    totalBytes,
    count,
    byPrefix: [...prefixes.entries()].map(([prefix, v]) => ({ prefix, ...v })).sort((a, b) => b.bytes - a.bytes),
    recent,
    truncated: Boolean(token),
    scannedAt: Date.now(),
    dashboardUrl: r2DashboardUrl(),
    devUrl: r2IsDevUrl(),
    freeBytes: 10 * 1024 ** 3,
  };
  cache = { at: Date.now(), data };
  return data;
}

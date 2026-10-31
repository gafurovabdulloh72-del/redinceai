import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import zlib from "node:zlib";

/**
 * SSRF'ga chidamli GET (2026-10-31, 3-audit). Foydalanuvchi bergan havolani server o'qishi kerak bo'lgan joylar
 * (havola prevyusi) shu orqali ishlaydi:
 *  - faqat https (ixtiyoriy http), standart port, login/parolsiz URL, `localhost`/`.local`/`.internal` yo'q;
 *  - IP manzil ULANISH PAYTIDA tekshiriladi (`lookup` ilgagi) — DNS «rebinding» (tekshiruvda ommaviy, ulanishda
 *    127.0.0.1) ishlamaydi; raqamli IP'li host oldindan tekshiriladi (Node unga lookup chaqirmaydi);
 *  - redirect qo'lda, har qadam qayta tekshiriladi (avtomatik `redirect: "follow"` ichki manzilga so'rov yuborib
 *    qo'yardi — javob o'qilmasa ham «ko'r» SSRF);
 *  - umumiy muddat, o'qish hajmi chegarasi (siqilgan javob ham ochilgandan keyingi hajm bo'yicha), `stopAt` belgisi.
 */

/** Xususiy, loopback, link-local, CGNAT, multicast va xizmat diapazonlari (IPv4 + IPv6, ::ffff: ko'rinishi ham) */
export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b, c] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64/10
      (a === 169 && b === 254) || // link-local (bulut metadata 169.254.169.254)
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 198 && (b === 18 || b === 19)) || // benchmark 198.18/15
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224 // multicast + zaxira
    );
  }
  if (v === 6) {
    const low = ip.toLowerCase().replace(/^\[|\]$/g, "");
    if (low === "::" || low === "::1") return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(low) ?? /^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/.exec(low);
    if (mapped) return isPrivateIp(mapped[1]);
    const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(low);
    if (hex) {
      const n = (parseInt(hex[1], 16) << 16) | parseInt(hex[2], 16);
      return isPrivateIp([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."));
    }
    return /^(fc|fd|fe[89ab]|ff)/.test(low) || low.startsWith("2001:db8") || low.startsWith("100:");
  }
  return true; // IP emas — bu funksiyaga kelmasligi kerak; ehtiyot uchun «xususiy»
}

export interface SafeFetchOptions {
  /** http ham ruxsat (standart: faqat https) */
  allowHttp?: boolean;
  timeoutMs?: number;
  /** Ochilgan (dekompressiyadan keyingi) javobdan o'qiladigan eng ko'p bayt */
  maxBytes?: number;
  maxHops?: number;
  accept?: string;
  /** Shu ifoda topilsa o'qish to'xtatiladi (masalan `</head>`) */
  stopAt?: RegExp;
}

export interface SafeFetchResult {
  url: URL;
  status: number;
  contentType: string;
  body: string;
}

type LookupCb = (err: NodeJS.ErrnoException | null, address?: string | LookupAddress[], family?: number) => void;
type LookupFn = (hostname: string, options: { all?: boolean; family?: number | string }, cb: LookupCb) => void;

export interface SafeFetchDeps {
  lookup?: LookupFn;
  isBlocked?: (ip: string) => boolean;
}

const UA = "Mozilla/5.0 (compatible; KasbEgalariBot/1.0; +https://kasbegalari.vercel.app)";

const blockedError = () => Object.assign(new Error("Manzil ruxsat etilmagan"), { code: "EBLOCKED" }) as NodeJS.ErrnoException;

/** Sinovlar uchun fabrika (lookup/isBlocked almashtiriladi); ilovada tayyor `safeFetchText` ishlatiladi */
export function createSafeFetcher(deps: SafeFetchDeps = {}) {
  const isBlocked = deps.isBlocked ?? isPrivateIp;
  const baseLookup: LookupFn =
    deps.lookup ?? ((host, opts, cb) => dnsLookup(host, { all: true, family: Number(opts.family) || 0 }, (e, a) => cb(e, a)));

  /** Ulanish paytidagi tekshiruv: DNS javobidagi BIRORTA manzil xususiy bo'lsa — rad */
  const guardedLookup: LookupFn = (hostname, options, cb) => {
    baseLookup(hostname, options, (err, address) => {
      if (err) return cb(err);
      const list: LookupAddress[] = Array.isArray(address) ? address : address ? [{ address, family: isIP(address) || 4 }] : [];
      if (!list.length || list.some((x) => isBlocked(x.address))) return cb(blockedError());
      if (options.all) cb(null, list);
      else cb(null, list[0].address, list[0].family);
    });
  };

  function checkUrl(raw: string | URL, allowHttp: boolean): URL | null {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      return null;
    }
    const okProto = u.protocol === "https:" || (allowHttp && u.protocol === "http:");
    if (!okProto || u.username || u.password) return null;
    if (u.port && u.port !== (u.protocol === "https:" ? "443" : "80")) return null;
    const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (isIP(host)) return isBlocked(host) ? null : u;
    if (!host.includes(".") || host === "localhost" || /\.(local|localhost|internal|lan|home|corp|intranet)$/.test(host)) return null;
    return u;
  }

  function requestOnce(u: URL, opts: Required<Pick<SafeFetchOptions, "accept">>, signal: AbortSignal): Promise<http.IncomingMessage> {
    const mod = u.protocol === "https:" ? https : http;
    return new Promise((resolve, reject) => {
      const req = mod.request(
        u,
        {
          method: "GET",
          signal,
          lookup: guardedLookup as unknown as typeof dnsLookup,
          agent: false,
          headers: { "user-agent": UA, accept: opts.accept, "accept-language": "uz,ru;q=0.8,en;q=0.5", "accept-encoding": "gzip, deflate, br" },
        },
        resolve,
      );
      req.on("error", reject);
      req.end();
    });
  }

  function readBody(res: http.IncomingMessage, maxBytes: number, stopAt?: RegExp): Promise<string> {
    const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
    const stream: NodeJS.ReadableStream =
      enc === "gzip" || enc === "x-gzip"
        ? res.pipe(zlib.createGunzip())
        : enc === "deflate"
          ? res.pipe(zlib.createInflate())
          : enc === "br"
            ? res.pipe(zlib.createBrotliDecompress())
            : res;
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      let total = 0;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        res.destroy();
        resolve(Buffer.concat(chunks).toString("utf8"));
      };
      stream.on("data", (c: Buffer) => {
        if (done) return;
        const left = maxBytes - total;
        chunks.push(c.length > left ? c.subarray(0, left) : c);
        total += Math.min(c.length, left);
        if (total >= maxBytes || (stopAt && stopAt.test(c.toString("utf8")))) finish();
      });
      stream.on("end", finish);
      stream.on("error", finish);
      res.on("error", finish);
      res.on("aborted", finish);
    });
  }

  /** Xato, taqiq, muddat tugashi — null. 2xx bo'lmagan javob ham qaytariladi (status bilan) */
  return async function safeFetchText(raw: string, o: SafeFetchOptions = {}): Promise<SafeFetchResult | null> {
    const allowHttp = o.allowHttp ?? false;
    const maxHops = o.maxHops ?? 3;
    const accept = o.accept ?? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1";
    const first = checkUrl(raw, allowHttp);
    if (!first) return null;
    let u: URL = first;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), o.timeoutMs ?? 4000);
    try {
      for (let hop = 0; hop <= maxHops; hop++) {
        const res = await requestOnce(u, { accept }, ctl.signal);
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          const loc = res.headers.location;
          const next: URL | null = loc ? checkUrl(new URL(loc, u), allowHttp) : null;
          res.destroy();
          if (!next) return null;
          u = next;
          continue;
        }
        const contentType = String(res.headers["content-type"] ?? "");
        const body = await readBody(res, o.maxBytes ?? 256 * 1024, o.stopAt);
        return { url: u, status, contentType, body };
      }
      return null; // juda ko'p redirect
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
}

export const safeFetchText = createSafeFetcher();

#!/usr/bin/env node
/**
 * Soxta Telegram Bot API — bot testlari uchun (scripts/bot.mjs, CI). Haqiqiy Telegram'ga HECH NARSA ketmaydi.
 *   node scripts/fake-telegram-api.mjs [port=8099]      env: FAKE_TG_LOG (standart /tmp/fake-bot.log)
 * Ilova `TELEGRAM_API_BASE=http://127.0.0.1:8099` bilan ishga tushiriladi; har chaqiruv jurnalga
 * `{method, body, at, ok, code}` JSON qatori bo'lib yoziladi — test shu jurnalni o'qiydi.
 *  - getMe → username (TELEGRAM_BOT_USERNAME), inline yoqilgan; getWebhookInfo → bo'sh url
 *  - getFile → file_path; /file/bot<token>/<path> → test PNG, soxta MP4 yoki PDF baytlari (bot orqali post / chek testi)
 *  - qolgan metodlar → {ok:true, result:{message_id}}
 *
 * BOSHQARUV (testlar ish vaqtida holatni almashtiradi): `POST /__control` JSON bilan, `GET /__control` — joriy holat.
 *   { reset: true }                         — hammasini standartga qaytarish
 *   { member: "member"|"left"|"error"|"down" } — getChatMember javobi (error — {ok:false}, down — 500); standart: env FAKE_TG_MEMBER yoki "left"
 *   { memberOf: { "<userId>": "left" } }    — alohida foydalanuvchi uchun (umumiy `member`dan ustun)
 *   { blocked: ["<chatId>", …] }            — shu chatlarga yuborish 403 «bot was blocked by the user»
 *   { flood: { times: 2, retryAfter: 1 } }  — keyingi N ta send* chaqiruvi 429 + parameters.retry_after
 *   { fail: { sendInvoice: "PAYMENT_PROVIDER_INVALID" } } — metod {ok:false, 400, description} qaytaradi (null — olib tashlash)
 *   { delayMs: 300 }                        — har javob oldidan kechikish (sekin tarmoq)
 * DIQQAT: productionda `TELEGRAM_API_BASE` bo'lMASLIGI shart (docs/DEPLOY.md).
 */
import http from "node:http";
import fs from "node:fs";
import zlib from "node:zlib";

const PORT = Number(process.argv[2] || 8099);
const LOG = process.env.FAKE_TG_LOG || "/tmp/fake-bot.log";
if (!fs.existsSync(LOG)) fs.writeFileSync(LOG, "");

/** Minimal to'g'ri PNG (64×64, marjon rang) — rasm yuklash oqimi uchun */
function png(w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = 255;
      raw[o + 1] = 90;
      raw[o + 2] = 54;
    }
  }
  const crc = (buf) => {
    let c = -1;
    for (const b of buf) {
      c ^= b;
      for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (c ^ -1) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const cc = Buffer.alloc(4);
    cc.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, cc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const PNG = png(64, 64);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]), Buffer.alloc(2000)]);
/** Minimal PDF (sarlavha + bo'sh katalog) — chek hujjati oqimi uchun */
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n", "latin1");

/** Ish vaqtidagi holat (`/__control` bilan o'zgaradi) */
const fresh = () => ({ member: process.env.FAKE_TG_MEMBER || "left", memberOf: {}, blocked: [], flood: { times: 0, retryAfter: 1 }, fail: {}, delayMs: 0 });
let state = fresh();
let nextMessageId = 1000;

const send = (res, code, obj) => res.writeHead(code, { "content-type": "application/json" }).end(JSON.stringify(obj));

/** Bitta chaqiruvga javob: [httpKod, tana] */
function respond(method, body) {
  if (state.fail[method]) return [400, { ok: false, error_code: 400, description: `Bad Request: ${state.fail[method]}` }];
  if (method === "getMe") return [200, { ok: true, result: { id: 111, is_bot: true, first_name: "Kasb Egalari", username: process.env.TELEGRAM_BOT_USERNAME || "KasbEgalariFakeBot", supports_inline_queries: true } }];
  if (method === "getWebhookInfo") return [200, { ok: true, result: { url: "", pending_update_count: 0 } }];
  if (method === "getChatMember") {
    const status = state.memberOf[String(body?.user_id)] ?? state.member;
    if (status === "down") return [500, { ok: false, error_code: 500, description: "Internal Server Error" }];
    if (status === "error") return [400, { ok: false, error_code: 400, description: "Bad Request: member list is inaccessible" }];
    return [200, { ok: true, result: { status, user: { id: body?.user_id ?? 0 } } }];
  }
  if (method === "getFile") {
    const id = String(body.file_id ?? "");
    const kind = id.startsWith("vid") ? "mp4" : id.startsWith("pdf") ? "pdf" : "png";
    const size = kind === "mp4" ? MP4.length : kind === "pdf" ? PDF.length : PNG.length;
    return [200, { ok: true, result: { file_id: id, file_path: kind === "mp4" ? "videos/test.mp4" : kind === "pdf" ? "documents/test.pdf" : "photos/test.png", file_size: size } }];
  }
  if (method.startsWith("send")) {
    if (state.flood.times > 0) {
      state.flood.times -= 1;
      const retry = state.flood.retryAfter || 1;
      return [429, { ok: false, error_code: 429, description: `Too Many Requests: retry after ${retry}`, parameters: { retry_after: retry } }];
    }
    if (state.blocked.map(String).includes(String(body?.chat_id))) return [403, { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" }];
  }
  return [200, { ok: true, result: { message_id: nextMessageId++ } }];
}

http
  .createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if ((req.url || "").startsWith("/__control")) {
        if (req.method === "POST") {
          let patch = {};
          try {
            patch = JSON.parse(raw || "{}");
          } catch {
            /* bo'sh tana */
          }
          if (patch.reset) state = fresh();
          if (typeof patch.member === "string") state.member = patch.member;
          if (patch.memberOf && typeof patch.memberOf === "object") Object.assign(state.memberOf, patch.memberOf);
          if (Array.isArray(patch.blocked)) state.blocked = patch.blocked.map(String);
          if (patch.flood && typeof patch.flood === "object") state.flood = { times: Number(patch.flood.times) || 0, retryAfter: Number(patch.flood.retryAfter) || 1 };
          if (patch.fail && typeof patch.fail === "object") for (const [k, v] of Object.entries(patch.fail)) v ? (state.fail[k] = String(v)) : delete state.fail[k];
          if (typeof patch.delayMs === "number") state.delayMs = Math.max(0, patch.delayMs);
        }
        return send(res, 200, { ok: true, state });
      }
      const f = /\/file\/bot[^/]+\/(.+)$/.exec(req.url || "");
      if (f) {
        const mp4 = f[1].endsWith(".mp4");
        const pdf = f[1].endsWith(".pdf");
        const body = mp4 ? MP4 : pdf ? PDF : PNG;
        res.writeHead(200, { "content-type": mp4 ? "video/mp4" : pdf ? "application/pdf" : "image/png", "content-length": body.length }).end(body);
        return;
      }
      const m = /\/bot[^/]+\/(\w+)/.exec(req.url || "");
      const method = m?.[1] ?? "?";
      let body = {};
      try {
        body = JSON.parse(raw || "{}");
      } catch {
        /* bo'sh tana */
      }
      const [code, out] = respond(method, body);
      fs.appendFileSync(LOG, JSON.stringify({ method, body, at: Date.now(), ok: Boolean(out.ok), code, ...(out.result?.message_id ? { message_id: out.result.message_id } : {}) }) + "\n");
      if (state.delayMs > 0) setTimeout(() => send(res, code, out), state.delayMs);
      else send(res, code, out);
    });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`soxta Telegram Bot API: http://127.0.0.1:${PORT} (jurnal: ${LOG})`));

#!/usr/bin/env node
/**
 * Soxta Telegram Bot API — bot testlari uchun (scripts/bot.mjs, CI). Haqiqiy Telegram'ga HECH NARSA ketmaydi.
 *   node scripts/fake-telegram-api.mjs [port=8099]      env: FAKE_TG_LOG (standart /tmp/fake-bot.log)
 * Ilova `TELEGRAM_API_BASE=http://127.0.0.1:8099` bilan ishga tushiriladi; har chaqiruv jurnalga
 * `{method, body}` JSON qatori bo'lib yoziladi — test shu jurnalni o'qiydi.
 *  - getMe → username (TELEGRAM_BOT_USERNAME), inline yoqilgan; getWebhookInfo → bo'sh url
 *  - getFile → file_path; /file/bot<token>/<path> → test PNG yoki soxta MP4 baytlari (bot orqali post testi)
 *  - qolgan metodlar → {ok:true, result:{message_id}}
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
const json = (res, obj) => res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(obj));

http
  .createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const f = /\/file\/bot[^/]+\/(.+)$/.exec(req.url || "");
      if (f) {
        const body = f[1].endsWith(".mp4") ? MP4 : PNG;
        res.writeHead(200, { "content-type": f[1].endsWith(".mp4") ? "video/mp4" : "image/png", "content-length": body.length }).end(body);
        return;
      }
      const m = /\/bot[^/]+\/(\w+)/.exec(req.url || "");
      const method = m?.[1] ?? "?";
      let body = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      } catch {
        /* bo'sh tana */
      }
      fs.appendFileSync(LOG, JSON.stringify({ method, body, at: Date.now() }) + "\n");
      if (method === "getMe") return json(res, { ok: true, result: { id: 111, is_bot: true, first_name: "Kasb Egalari", username: process.env.TELEGRAM_BOT_USERNAME || "KasbEgalariFakeBot", supports_inline_queries: true } });
      if (method === "getWebhookInfo") return json(res, { ok: true, result: { url: "", pending_update_count: 0 } });
      if (method === "getFile") {
        const id = String(body.file_id ?? "");
        const isVideo = id.startsWith("vid");
        return json(res, { ok: true, result: { file_id: id, file_path: isVideo ? "videos/test.mp4" : "photos/test.png", file_size: isVideo ? MP4.length : PNG.length } });
      }
      return json(res, { ok: true, result: { message_id: Math.floor(Math.random() * 1e6) } });
    });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`soxta Telegram Bot API: http://127.0.0.1:${PORT} (jurnal: ${LOG})`));

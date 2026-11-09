// Foydalanish: node render.mjs <chiqish.mp4> <shot.json yoki -> [w] [h] [fps]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const FONT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../src/fonts");
const [out, shotFile, w = "720", h = "1280", fps = "30"] = process.argv.slice(2);
const shot = shotFile && shotFile !== "-" ? JSON.parse(fs.readFileSync(shotFile, "utf8")) : {};
const dur = shot.dur || 4;

const types = { ".html": "text/html", ".js": "text/javascript", ".ttf": "font/ttf" };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  const file = u.startsWith("/font/") ? path.join(FONT, path.basename(u)) : path.join(ROOT, path.normalize(u));
  if (!file.startsWith(ROOT) && !file.startsWith(FONT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => { if (err) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" }); res.end(buf); });
}).listen(0, "127.0.0.1");
await new Promise((r) => srv.once("listening", r));
const port = srv.address().port;

const frames = path.join(ROOT, "frames-" + path.basename(out, ".mp4"));
fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true });
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await b.newPage({ viewport: { width: +w, height: +h } });
page.on("console", (m) => { if (m.type() === "error") console.log("[konsol]", m.text()); });
page.on("pageerror", (e) => console.log("[xato]", e.message));
await page.goto(`http://127.0.0.1:${port}/scene2.html?w=${w}&h=${h}&shot=${encodeURIComponent(JSON.stringify(shot))}`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
const total = Math.round(dur * +fps);
const t0 = Date.now();
for (let i = 0; i < total; i++) {
  await page.evaluate((t) => window.renderAt(t), i / +fps);
  await page.screenshot({ path: path.join(frames, String(i).padStart(5, "0") + ".jpg"), type: "jpeg", quality: 92 });
  if (i === 0) console.log("1-kadr:", Date.now() - t0, "ms");
}
console.log(`${total} kadr, ${((Date.now() - t0) / total).toFixed(0)} ms/kadr`);
await b.close(); srv.close();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", fps, "-i", path.join(frames, "%05d.jpg"), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
console.log("tayyor:", out);

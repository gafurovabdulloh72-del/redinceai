// node render3.mjs <cfg.json> <out.mp4> [w] [h] [fps] [--from s --to s]
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { execFileSync } from "node:child_process"; import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const FONT = [process.env.FONT_DIR, path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../src/fonts"), "/home/user/redinceai/src/fonts"].find(p => p && fs.existsSync(p));
const [cfgPath, out, w = "1080", h = "1920", fps = "30"] = process.argv.slice(2);
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")); const dur = cfg.dur || 16;
const types = { ".html": "text/html", ".js": "text/javascript", ".ttf": "font/ttf", ".woff2": "font/woff2", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg" };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  let file = u.startsWith("/font/") ? path.join(FONT, path.basename(u)) : u === "/cfg.json" ? path.resolve(cfgPath) : path.join(ROOT, path.normalize(u));
  if (!(file.startsWith(ROOT) || file.startsWith(FONT) || file === path.resolve(cfgPath))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" }); res.end(b); });
}).listen(0, "127.0.0.1"); await new Promise(r => srv.once("listening", r));
const frames = path.join(ROOT, "fr3-" + path.basename(out, ".mp4"));
fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true });
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await b.newPage({ viewport: { width: +w, height: +h } });
page.on("pageerror", e => console.log("[xato]", e.message)); page.on("console", m => { if (m.type() === "error") console.log("[konsol]", m.text()); });
await page.goto(`http://127.0.0.1:${srv.address().port}/scene3.html?w=${w}&h=${h}&cfg=/cfg.json`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
const only = process.env.ONLY ? process.env.ONLY.split(",").map(Number) : null;
const total = Math.round(dur * +fps); const t0 = Date.now(); let n = 0;
for (let i = 0; i < total; i++) {
  const t = i / +fps; if (only && !only.some(x => Math.abs(x - t) < .5 / +fps)) continue;
  await page.evaluate(t => window.renderAt(t), t);
  await page.screenshot({ path: path.join(frames, String(i).padStart(5, "0") + ".jpg"), type: "jpeg", quality: 94 }); n++;
  if (n === 1) console.log("1-kadr:", Date.now() - t0, "ms");
}
console.log(`${n} kadr, ${((Date.now() - t0) / n).toFixed(0)} ms/kadr`);
await b.close(); srv.close();
if (!only) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", fps, "-i", path.join(frames, "%05d.jpg"), "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-maxrate", "6M", "-bufsize", "12M", "-tune", "film", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
console.log("tayyor:", out);

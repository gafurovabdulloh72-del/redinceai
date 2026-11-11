// node comp.mjs flowDir cfg.json out.mp4
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process"; import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const [flowDir, cfgPath, out] = process.argv.slice(2);
const HERE = path.dirname(new URL(import.meta.url).pathname); const FONT = "/home/user/redinceai/src/fonts";
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")); const tj = JSON.parse(fs.readFileSync(path.join(flowDir, "marks.json")));
cfg.marks = tj; const END = cfg.endDur || 3.0; const dur = (cfg.intro ?? 2.4) + tj.frames / 30 + END;
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split("?")[0]); let f;
  if (u.startsWith("/font/")) f = path.join(FONT, path.basename(u)); else if (u.startsWith("/fl/")) f = path.join(flowDir, path.basename(u)); else f = path.join(HERE, "studio4.html");
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200); r.end(b); }); }).listen(0, "127.0.0.1");
await new Promise(r => srv.once("listening", r));
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await page.addInitScript(c => { window.CFG = c; }, cfg);
await page.goto(`http://127.0.0.1:${srv.address().port}/`); await page.waitForFunction(() => window.ready);
await page.evaluate(() => document.fonts.ready);
const fr = path.join(HERE, "cfx-" + path.basename(out, ".mp4")); fs.rmSync(fr, { recursive: true, force: true }); fs.mkdirSync(fr);
const only = process.env.ONLY ? process.env.ONLY.split(",").map(Number) : null;
const total = Math.round(dur * 30);
for (let i = 0; i < total; i++) { const t = i / 30; if (only && !only.some(x => Math.abs(x - t) < 1 / 60)) continue;
  await page.evaluate(t => window.renderAt(t), t); await page.screenshot({ path: path.join(fr, String(i).padStart(5, "0") + ".jpg"), type: "jpeg", quality: 93 }); }
await b.close(); srv.close();
if (!only) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "30", "-i", path.join(fr, "%05d.jpg"), "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-maxrate", "6M", "-bufsize", "12M", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
console.log("tayyor", out, total, "kadr", dur.toFixed(1), "s");

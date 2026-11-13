// node render2.mjs cfg.json out.mp4 [fps]  — neonT.html + CFG; kadrlar, ovoz (psynth2), motion blur (tmix)
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const [cfgPath, out, fpsArg] = process.argv.slice(2); const FPS = +(fpsArg || 60);
const CFG = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); const name = path.basename(out, '.mp4');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
p.on('pageerror', e => console.log('ERR', e.message));
await p.addInitScript(c => { window.CFG = c; }, CFG);
await p.goto('file://' + path.join(HERE, 'sty.html')); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800); await p.evaluate(() => window.setup());
const dur = await p.evaluate(() => window.DUR); const evs = await p.evaluate(() => window.EVENTS);
const work = path.join(HERE, 'w-' + name); fs.rmSync(work, { recursive: true, force: true }); fs.mkdirSync(work);
fs.writeFileSync(path.join(work, 'events.json'), JSON.stringify(evs));
const only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
if (only) { for (const t of only) { await p.evaluate(t => window.renderAt(t), t); await p.screenshot({ path: path.join(HERE, `pv-${name}-${t}.jpg`), type: 'jpeg', quality: 85 }); } await b.close(); process.exit(0); }
const n = Math.round(dur * FPS);
for (let i = 0; i < n; i++) { await p.evaluate(t => window.renderAt(t), i / FPS); await p.screenshot({ path: path.join(work, String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 93 }); }
await b.close();
execFileSync('python3', [path.join(HERE, 'psynth2.py'), path.join(work, 'events.json'), String(dur), path.join(work, 'a.wav')], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(work, '%05d.jpg'), '-i', path.join(work, 'a.wav'),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-af', 'loudnorm=I=-15:TP=-1.2:LRA=9', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', path.join(HERE, out)]);
fs.rmSync(work, { recursive: true, force: true });
console.log('DONE', out, dur);

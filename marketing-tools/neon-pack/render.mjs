import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const HERE = path.dirname(new URL(import.meta.url).pathname); const FPS = +(process.env.FPS||30);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('file://' + path.join(HERE, (process.env.HTML||'neon.html'))); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800); await p.evaluate(() => window.setup());
const dur = await p.evaluate(() => window.DUR); const evs = await p.evaluate(() => window.EVENTS);
fs.writeFileSync(path.join(HERE, 'events.json'), JSON.stringify(evs));
const fr = path.join(HERE, 'fr'); fs.rmSync(fr, { recursive: true, force: true }); fs.mkdirSync(fr);
const n = Math.round(dur * FPS);
for (let i = 0; i < n; i++) { await p.evaluate(t => window.renderAt(t), i / FPS); await p.screenshot({ path: path.join(fr, String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 93 }); if (i % 90 === 0) console.log('kadr', i, '/', n); }
await b.close();
execFileSync('python3', [path.join(HERE, process.env.SYNTH||'synth.py'), path.join(HERE, 'events.json'), String(dur), path.join(HERE, 'neon.wav')], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(fr, '%05d.jpg'), '-i', path.join(HERE, 'neon.wav'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', path.join(HERE, (process.env.OUT||'neon-pack.mp4'))]);
console.log('DONE', dur);

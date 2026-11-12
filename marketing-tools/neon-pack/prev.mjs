import { createRequire } from 'node:module'; import path from 'node:path'; const { chromium } = createRequire(import.meta.url)('playwright');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
p.on('console', m => console.log('console:', m.text())); p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('file://' + path.join(HERE, 'neon.html')); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500); await p.evaluate(() => window.setup());
const times = process.argv.slice(2).map(Number);
for (const t of times) { await p.evaluate(t => window.renderAt(t), t); await p.screenshot({ path: path.join(HERE, `pv-${t}.jpg`), type: 'jpeg', quality: 80 }); }
await b.close();

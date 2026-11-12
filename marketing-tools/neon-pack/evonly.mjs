import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright'); const HERE = path.dirname(new URL(import.meta.url).pathname);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto('file://' + path.join(HERE, process.env.HTML)); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500); await p.evaluate(() => window.setup());
fs.writeFileSync(path.join(HERE, 'events.json'), JSON.stringify(await p.evaluate(() => window.EVENTS))); console.log(await p.evaluate(() => window.DUR)); await b.close();

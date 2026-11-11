import { createRequire } from "node:module"; const { chromium } = createRequire(import.meta.url)("playwright");
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
await p.goto("file://"+process.argv[2]); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(300);
await p.screenshot({path:process.argv[3],type:"jpeg",quality:92}); await b.close();

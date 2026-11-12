import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
const B='http://127.0.0.1:3000';
const b = await chromium.launch();
async function ctxFor(email){ const c = await b.newContext({ viewport:{width:390,height:780}, deviceScaleFactor:3, isMobile:true, hasTouch:true, colorScheme:'light' });
  const p = await c.newPage(); await p.request.post(B+'/api/auth/login',{data:{email,password:'Demo-parol-2026!'},headers:{origin:B}}); return p; }
const m = await ctxFor('mijoz.demo1@example.com');
const s = await ctxFor('ijodkor.demo2@example.com');
async function shot(p, url, name, extra){ await p.goto(B+url,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3500); if (extra) await extra(p);
  await p.evaluate(()=>{ for (const el of document.querySelectorAll('body *')) { for (const n of el.childNodes) if (n.nodeType===3 && n.nodeValue.includes('127.0.0.1')) n.nodeValue=n.nodeValue.replace(/127\.0\.0\.1:3000/g,'kasbegalari.vercel.app'); } document.querySelectorAll('nextjs-portal').forEach(e=>e.remove()); });
  await p.screenshot({ path: name }); console.log('ok', name, p.url()); }
const me = await (await s.request.get(B+'/api/auth/me')).json().catch(()=>({}));
console.log(JSON.stringify(me).slice(0,200));
await shot(s, '/', 'c-feed.png');
await shot(m, '/lenta', 'c-reels.png');
await shot(m, '/top', 'c-top.png');
await shot(m, '/mutaxassislar', 'c-kat.png');
await b.close();

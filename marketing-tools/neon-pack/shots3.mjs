import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
const B='http://127.0.0.1:3000';
const b = await chromium.launch();
const c = await b.newContext({ viewport:{width:390,height:780}, deviceScaleFactor:3, isMobile:true, hasTouch:true, colorScheme:'light' });
const p = await c.newPage(); await p.request.post(B+'/api/auth/login',{data:{email:'mijoz.demo1@example.com',password:'Demo-parol-2026!'},headers:{origin:B}});
async function shot(url, name){ await p.goto(B+url,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000);
  await p.evaluate(()=>{ document.querySelectorAll('nextjs-portal').forEach(e=>e.remove()); });
  await p.screenshot({ path: name }); console.log('ok', name); }
await shot('/xarita','c-xarita.png');
await shot('/qidiruv','c-qidiruv.png');
await shot('/vakansiyalar','c-vak.png');
await b.close();

import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
const B='http://127.0.0.1:3000';
const b = await chromium.launch();
async function ctx(email){ const c = await b.newContext({ viewport:{width:1440,height:900}, deviceScaleFactor:2, colorScheme:'light' }); const p = await c.newPage();
  if (email) await p.request.post(B+'/api/auth/login',{data:{email,password:'Demo-parol-2026!'},headers:{origin:B}}); return p; }
async function shot(p, url, name, act){ await p.goto(B+url,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3500); if(act) { try { await act(p); } catch(e){ console.log('act err', name, e.message.slice(0,80)); } await p.waitForTimeout(1200); }
  await p.evaluate(()=>{ document.querySelectorAll('nextjs-portal').forEach(e=>e.remove()); for (const el of document.querySelectorAll('body *')) for (const n of el.childNodes) if (n.nodeType===3 && n.nodeValue.includes('127.0.0.1')) n.nodeValue=n.nodeValue.replace(/127\.0\.0\.1:3000/g,'kasbegalari.vercel.app'); });
  await p.screenshot({ path: 'd/'+name+'.png' }); console.log('ok', name); }
const g = await ctx(null);
await shot(g, '/auth/royxat', 'auth');
await shot(g, '/auth/royxat', 'auth-craft', async p => { await p.getByText('Mutaxassis', { exact: false }).first().click(); await p.waitForTimeout(800); });
const s = await ctx('ijodkor.demo2@example.com');
await shot(s, '/', 'home');
await shot(s, '/mentorlik', 'mentor');
await shot(s, '/kabinet/mentorlik', 'kmentor');
await shot(s, '/top', 'top');
await shot(s, '/kabinet/portfolio', 'kportfolio');
await shot(s, '/kabinet/profil', 'kprofil');
await shot(s, '/kabinet/profil?tab=mutaxassis', 'kprofil-mut');
await shot(s, '/kabinet', 'kabinet');
await shot(s, '/narxlar', 'narxlar');
await shot(s, '/vakansiyalar', 'vak');
await shot(s, '/rezyumelar', 'rez');
await b.close();

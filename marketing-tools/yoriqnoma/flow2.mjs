// node flow2.mjs flow.json outDir — haqiqiy saytda harakatlarni 30 fps yozadi; marks.json: taps/focus/caps
import fs from "node:fs"; import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const [fp, out] = process.argv.slice(2); const F = JSON.parse(fs.readFileSync(fp, "utf8"));
const B = "http://127.0.0.1:3000"; const FPS = 30, DESK = F.desktop !== false, W = DESK ? 1280 : 390, H = DESK ? 720 : 693;
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DESK ? 1920 / 1280 : 1080 / W, isMobile: !DESK, hasTouch: !DESK, locale: "en-GB" });
if (F.tgNudge !== true) await ctx.addInitScript(() => { try { localStorage.setItem("tg-nudge-yopildi", "1"); } catch {} });
if (F.saver) await ctx.addInitScript(() => { try { localStorage.setItem("redince-saver", "1"); } catch {} });
await ctx.addInitScript(() => { const fix = (n) => { const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) if (t.nodeValue.includes("127.0.0.1:3000")) t.nodeValue = t.nodeValue.replace(/(https?:\/\/)?127\.0\.0\.1:3000/g, "kasbegalari.vercel.app"); }; new MutationObserver(() => document.body && fix(document.body)).observe(document, { subtree: true, childList: true, characterData: true }); });
const page = await ctx.newPage();
if (F.login !== false) {
  await page.request.post(B + "/api/auth/login", { data: { email: "ijodkor.demo2@example.com", password: "Demo-parol-2026!" }, headers: { origin: B } });
  const ck = (await ctx.cookies()).map(c => ({ ...c, secure: false })); await ctx.clearCookies(); await ctx.addCookies(ck);
}
if (F.cleanPortfolio) { const { createClient } = createRequire("/home/user/redinceai/package.json")("@libsql/client"); const db = createClient({ url: "file:/home/user/redinceai/data/redince.db" });
  const r = await db.execute("select p.id from portfolio_items p join specialists s on s.id = p.specialist_id where s.slug = 'ijodkor'");
  for (const row of r.rows) { const d = await page.request.delete(B + "/api/portfolio/" + row.id, { headers: { origin: B } }); console.log("ish o'chirildi", d.status()); } }
if (F.cleanPosts) { const { createClient } = createRequire("/home/user/redinceai/package.json")("@libsql/client"); const db = createClient({ url: "file:/home/user/redinceai/data/redince.db" });
  const u = await db.execute("select id from users where email = 'ijodkor.demo2@example.com'"); const uid = u.rows[0]?.id;
  if (uid) { const r = await db.execute({ sql: "select id from posts where author_id = ? and group_id is null", args: [uid] }); for (const row of r.rows) { const d = await page.request.delete(B + "/api/posts/" + row.id, { headers: { origin: B } }); console.log("post o'chirildi", d.status()); }
    const st = await db.execute({ sql: "select id from stories where author_id = ?", args: [uid] }).catch(() => ({ rows: [] })); for (const row of st.rows) { const d = await page.request.delete(B + "/api/stories/" + row.id, { headers: { origin: B } }); console.log("story o'chirildi", d.status()); } } }
const css = (F.css || "") + "*{caret-color:#ff5a36}";
let n = 0; const marks = { taps: [], focus: [], caps: [], urls: [] };
const snap = async () => { await page.screenshot({ path: `${out}/${String(n).padStart(5, "0")}.jpg`, type: "jpeg", quality: 90 }); n++; };
const hold = async (sec) => { await snap(); const f = `${out}/${String(n - 1).padStart(5, "0")}.jpg`; for (let i = 1; i < Math.round(sec * FPS); i++) { fs.copyFileSync(f, `${out}/${String(n).padStart(5, "0")}.jpg`); n++; } };
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const loc = (t) => (typeof t === "string" ? (t.includes(' >> nth=') ? page.locator(t.split(' >> nth=')[0]).nth(+t.split(' >> nth=')[1]) : page.locator(t)) : page.getByText(t.text, { exact: !!t.exact })).filter({ visible: true }).first();
const toCenter = async (l) => {
  const off = await l.evaluate((e, H) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2 - H * 0.42; }, H).catch(() => null);
  if (off == null || Math.abs(off) < 60) return;
  // ichki scroll konteynerlar (modal) uchun ham ishlaydi: brauzerning o'z silliq scrolli
  await l.evaluate(e => e.scrollIntoView({ behavior: "smooth", block: "center" })).catch(() => {});
  for (let i = 0; i < 20; i++) await snap();
};
const center = async (l) => { const bb = await l.boundingBox(); return bb && { x: (bb.x + bb.width / 2) / W, y: (bb.y + bb.height / 2) / H }; };
for (const s of F.steps) {
  if (s.cap) marks.caps.push({ frame: n, text: s.cap, step: s.num, sub: s.sub || '' });
  if (s.goto) { marks.urls.push({ frame: n, path: s.goto.split('?')[0] }); await page.goto(B + s.goto, { waitUntil: "networkidle" }); await page.addStyleTag({ content: css }); await page.waitForTimeout(s.wait ?? 1000); }
  if (s.hold) await hold(s.hold);
  if (s.scroll !== undefined) {
    const y0 = await page.evaluate(() => scrollY);
    const y1 = typeof s.scroll === "number" ? s.scroll : await loc(s.scroll).evaluate((e, off) => e.getBoundingClientRect().top + scrollY - off, s.off ?? 200).catch(() => y0);
    const k = Math.round((s.dur || 1) * FPS);
    for (let i = 1; i <= k; i++) { await page.evaluate(y => window.scrollTo(0, y), y0 + (y1 - y0) * ease(i / k)); await snap(); }
  }
  if (s.focus) { const l = loc(s.focus); await toCenter(l); const c = await center(l); if (c) marks.focus.push({ frame: n, dur: s.fdur || 1.6, ...c, z: s.z || 1.6, zoom: s.zoom || null }); await hold(s.fdur || 1.6); }
  if (s.tap) {
    const l = loc(s.tap); await toCenter(l); await page.waitForTimeout(150);
    const c = await center(l);
    if (c) { marks.taps.push({ frame: n + 14, ...c, z: s.z || 1.5 }); await hold(0.6);
      if (s.file) { const [fc] = await Promise.all([page.waitForEvent("filechooser", { timeout: 8000 }), l.click()]); await fc.setFiles(s.file); }
      else if (DESK) await l.click({ force: !!s.force, timeout: 8000 }).catch(async e => { console.log("click", e.message.split('\n')[0]); const h = await l.getAttribute('href').catch(() => null); if (h) await page.goto(B + h, { waitUntil: 'networkidle' }); }); else await l.tap().catch(async () => l.click().catch(e => console.log("click", e.message)));
      if (!DESK) await page.mouse.move(1, 1).catch(() => {}); }
    else console.log("topilmadi", JSON.stringify(s.tap));
    await page.waitForTimeout(s.wait ?? 700); await page.addStyleTag({ content: css }).catch(() => {}); await hold(0.4);
  }
  if (s.type) {
    const l = loc(s.type.sel); await toCenter(l); const c = await center(l);
    if (c) marks.focus.push({ frame: n, dur: s.type.text.length * 2 / FPS + 0.8, ...c, z: s.z || 1.45, zoom: s.zoom || null });
    await l.click().catch(() => {}); await hold(0.3);
    for (const ch of s.type.text) { await page.keyboard.type(ch); await snap(); await snap(); }
    if (s.type.enter) { await page.keyboard.press("Enter"); await page.waitForTimeout(200); }
    await hold(0.5);
  }
  if (s.upload) { await page.locator(s.upload.sel).first().setInputFiles(s.upload.file); await page.waitForTimeout(s.wait ?? 2500); await page.addStyleTag({ content: css }).catch(() => {}); await hold(0.6); }
  if (s.select) { const l = loc(s.select.sel); await toCenter(l); const c = await center(l); if (c) marks.focus.push({ frame: n, dur: 1.4, ...c, z: 1.5 }); await hold(0.5); await l.selectOption({ label: s.select.label }).catch(e => console.log("select", e.message)); await hold(0.9); }
  if (s.blur) { await page.evaluate(() => document.activeElement?.blur()); }
  if (s.key) { await page.keyboard.press(s.key); await hold(0.6); }
}
fs.writeFileSync(`${out}/marks.json`, JSON.stringify({ frames: n, ...marks }));
console.log(out, n, "kadr", (n / 30).toFixed(1), "s");
await b.close();

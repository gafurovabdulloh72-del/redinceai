// node flow.mjs flow.json outDir  — haqiqiy saytda harakatlarni kadrma-kadr yozadi (30 fps), taps.json
import fs from "node:fs"; import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const [fp, out] = process.argv.slice(2); const F = JSON.parse(fs.readFileSync(fp, "utf8"));
const B = "http://127.0.0.1:3000"; const FPS = 30;
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2.77, isMobile: true, hasTouch: true, locale: "en-GB" });
const page = await ctx.newPage();
if (F.login) {
  await page.request.post(B + "/api/auth/login", { data: F.login, headers: { origin: B } });
  const ck = (await ctx.cookies()).map(c => ({ ...c, secure: false })); await ctx.clearCookies(); await ctx.addCookies(ck);
}
const css = F.css || "";
let n = 0; const taps = [];
const snap = async () => { await page.screenshot({ path: `${out}/${String(n).padStart(5, "0")}.jpg`, type: "jpeg", quality: 92 }); n++; };
const hold = async (sec) => { const k = Math.round(sec * FPS); await snap(); const f = `${out}/${String(n - 1).padStart(5, "0")}.jpg`; for (let i = 1; i < k; i++) { fs.copyFileSync(f, `${out}/${String(n).padStart(5, "0")}.jpg`); n++; } };
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
for (const s of F.steps) {
  if (s.goto) { await page.goto(B + s.goto, { waitUntil: "networkidle" }); if (css) await page.addStyleTag({ content: css }); await page.waitForTimeout(s.wait ?? 1200); }
  if (s.hold) await hold(s.hold);
  if (s.scroll !== undefined) {
    const y0 = await page.evaluate(() => scrollY); const y1 = typeof s.scroll === "string" ? await page.evaluate(([txt, off]) => { const e = document.evaluate(`//*[normalize-space(text())="${txt}"]`, document, null, 9, null).singleNodeValue; return e ? e.getBoundingClientRect().top + scrollY - off : scrollY; }, [s.scroll, s.off ?? 160]) : s.scroll;
    const k = Math.round((s.dur || 1) * FPS);
    for (let i = 1; i <= k; i++) { await page.evaluate(y => window.scrollTo(0, y), y0 + (y1 - y0) * ease(i / k)); await snap(); }
  }
  if (s.tap) {
    const loc = typeof s.tap === "string" ? page.locator(s.tap).first() : page.getByText(s.tap.text, { exact: !!s.tap.exact }).first();
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const bb = await loc.boundingBox();
    if (bb) { taps.push({ frame: n, x: (bb.x + bb.width / 2) / 390, y: (bb.y + bb.height / 2) / 844 }); await hold(0.35); await loc.tap().catch(async () => { await loc.click().catch(e => console.log("click", e.message)); }); await page.mouse.move(2, 2).catch(() => {}); }
    else console.log("tap topilmadi", JSON.stringify(s.tap));
    await page.waitForTimeout(s.wait ?? 900); if (css) await page.addStyleTag({ content: css }).catch(() => {});
  }
  if (s.type) { await page.locator(s.type.sel).first().click(); for (const ch of s.type.text) { await page.keyboard.type(ch); await snap(); await snap(); } }
}
fs.writeFileSync(`${out}/taps.json`, JSON.stringify({ frames: n, taps }));
console.log(out, n, "kadr", taps.length, "tap");
await b.close();
